import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { TasksService } from '../tasks/tasks.service';

const ADMIN_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'];

@Injectable()
export class TimesheetsService {
  private readonly logger = new Logger(TimesheetsService.name);

  constructor(
    private prisma: PrismaService,
    private tasksService: TasksService,
  ) {}

  async createOrUpdate(dto: CreateTimesheetDto, employeeId: string) {
    const weekStart = new Date(dto.weekStartDate);
    const weekEnd = new Date(dto.weekEndDate);
    const totalHours = dto.entries.reduce((sum, e) =>
      sum + e.monday + e.tuesday + e.wednesday + e.thursday + e.friday + e.saturday + e.sunday, 0);

    const existing = await this.prisma.timesheet.findUnique({
      where: { employeeId_weekStartDate: { employeeId, weekStartDate: weekStart } },
    });

    if (existing && existing.status === 'SUBMITTED') throw new BadRequestException('Cannot edit a submitted timesheet');
    if (existing && existing.status === 'APPROVED') throw new BadRequestException('Cannot edit an approved timesheet');

    // Validate all tasks are ACTIVE before saving
    await Promise.all(dto.entries.map(e => this.tasksService.validateTaskActive(e.taskId)));

    const entryData = dto.entries.map(e => ({
      projectId: e.projectId, taskId: e.taskId,
      monday: e.monday, tuesday: e.tuesday, wednesday: e.wednesday,
      thursday: e.thursday, friday: e.friday, saturday: e.saturday, sunday: e.sunday,
      totalHours: e.monday + e.tuesday + e.wednesday + e.thursday + e.friday + e.saturday + e.sunday,
      notes: e.notes,
    }));

    if (existing) {
      await this.prisma.timesheetEntry.deleteMany({ where: { timesheetId: existing.id } });
      // If the timesheet was REJECTED, reset it to DRAFT so it can be resubmitted.
      // DRAFT timesheets keep their status; status field is not changed for them.
      const statusReset = existing.status === 'REJECTED' ? { status: 'DRAFT' as any } : {};
      return this.prisma.timesheet.update({
        where: { id: existing.id },
        data: { totalHours, entries: { create: entryData }, ...statusReset },
        include: { entries: true },
      });
    }

    return this.prisma.timesheet.create({
      data: {
        employeeId, weekStartDate: weekStart, weekEndDate: weekEnd, totalHours,
        entries: { create: entryData },
      },
      include: { entries: true },
    });
  }

  async submit(id: string, employeeId: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!ts) throw new NotFoundException('Timesheet not found');
    if (ts.employeeId !== employeeId) throw new ForbiddenException();
    if (ts.status !== 'DRAFT') throw new BadRequestException('Only draft timesheets can be submitted');
    return this.prisma.timesheet.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
      include: { entries: true },
    });
  }

  async approve(id: string, approver: { id: string; role: string; employeeId?: string | null }) {
    const ts = await this.prisma.timesheet.findUnique({
      where: { id },
      include: { employee: { select: { id: true, employeeId: true } } },
    });
    if (!ts) throw new NotFoundException('Timesheet not found');
    if (ts.status !== 'SUBMITTED') throw new BadRequestException('Only submitted timesheets can be approved');
    if (ts.employeeId === approver.id) throw new ForbiddenException('You cannot approve your own timesheet');
    await this.assertCanApprove(ts, approver);
    return this.prisma.timesheet.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: approver.id },
      include: { employee: { select: { id: true, name: true, email: true } } },
    });
  }

  async reject(id: string, approver: { id: string; role: string; employeeId?: string | null }, reason?: string) {
    const ts = await this.prisma.timesheet.findUnique({
      where: { id },
      include: { employee: { select: { id: true, employeeId: true } } },
    });
    if (!ts) throw new NotFoundException('Timesheet not found');
    if (ts.status !== 'SUBMITTED') throw new BadRequestException('Only submitted timesheets can be rejected');
    if (ts.employeeId === approver.id) throw new ForbiddenException('You cannot reject your own timesheet');
    await this.assertCanApprove(ts, approver);
    return this.prisma.timesheet.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason },
      include: { employee: { select: { id: true, name: true, email: true } } },
    });
  }

  // ── Assert the actor is in the correct hierarchical position to approve/reject ─
  //
  // Rules:
  //   SUPER_ADMIN     → can approve anyone's timesheet
  //   COMPANY_ADMIN   → can approve anyone in their subtree (direct reports + their reports)
  //   PROJECT_MANAGER → can only approve their own direct reports
  //
  private async assertCanApprove(
    ts: any,
    actor: { id: string; role: string; employeeId?: string | null }
  ) {
    if (actor.role === 'SUPER_ADMIN') return; // Super Admin can approve anyone

    // Resolve actor employeeId — from token, fallback to DB
    let actorEmployeeId = actor.employeeId;
    if (!actorEmployeeId) {
      const dbUser = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { employeeId: true } });
      actorEmployeeId = dbUser?.employeeId ?? null;
    }
    if (!actorEmployeeId) {
      throw new ForbiddenException(
        'Your account has no Employee ID configured. Please contact a Super Admin to link your employee record.'
      );
    }

    const empCode = ts.employee?.employeeId;
    if (!empCode) return; // no EC record for this employee — allow (edge case)

    if (actor.role === 'PROJECT_MANAGER') {
      // PM: employee must be a direct report (managerEmployeeNo = actorEmployeeId)
      const rows = await this.prisma.$queryRawUnsafe<{ managerEmployeeNo: string | null }[]>(`
        SELECT "managerEmployeeNo"
        FROM   employee_configs
        WHERE  LOWER("employeeNo") = LOWER($1) AND active = true
        LIMIT  1
      `, empCode);
      if (!rows.length || !rows[0].managerEmployeeNo) {
        throw new ForbiddenException('This employee has no manager configured in the system.');
      }
      if (rows[0].managerEmployeeNo.toLowerCase() !== actorEmployeeId.toLowerCase()) {
        throw new ForbiddenException(
          'You are not the direct manager of this employee. ' +
          'Only their assigned manager or a Super Admin can approve this timesheet.'
        );
      }
      return; // ✅ PM direct report check passed
    }

    if (actor.role === 'COMPANY_ADMIN') {
      // CA: employee must be anywhere in actor's subtree (BFS traversal)
      const inSubtree = await this.isInSubtree(empCode, actorEmployeeId);
      if (!inSubtree) {
        throw new ForbiddenException(
          'This employee is not in your reporting hierarchy. ' +
          'Only their manager chain or a Super Admin can approve this timesheet.'
        );
      }
      return; // ✅ CA subtree check passed
    }
  }

  // ── BFS check: is targetEcCode anywhere in the subtree rooted at rootEcCode? ─
  private async isInSubtree(targetEcCode: string, rootEcCode: string): Promise<boolean> {
    const visited   = new Set<string>();
    let   frontier  = [rootEcCode.toLowerCase()];

    for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
      const placeholders = frontier.map((_: string, i: number) => `$${i + 1}`).join(', ');
      const rows = await this.prisma.$queryRawUnsafe<{ employeeNo: string }[]>(`
        SELECT "employeeNo"
        FROM   employee_configs
        WHERE  LOWER("managerEmployeeNo") IN (${placeholders})
          AND  active = true
      `, ...frontier);

      const nextCodes = rows
        .map((r: any) => r.employeeNo.toLowerCase())
        .filter((c: string) => !visited.has(c));

      for (const c of nextCodes) visited.add(c);

      if (nextCodes.includes(targetEcCode.toLowerCase())) return true;
      frontier = nextCodes;
    }
    return false;
  }

  // findAll — used by admins for reports/overview. Returns all (or own for TM).
  findAll(user: { id: string; role: string }) {
    const where = ADMIN_ROLES.includes(user.role) ? {} : { employeeId: user.id };
    return this.prisma.timesheet.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, employeeId: true } },
        entries: { include: { task: { include: { project: { select: { id: true, code: true, name: true } } } } } },
      },
      orderBy: { weekStartDate: 'desc' },
    });
  }

  // findMine — ALWAYS returns only the actor's own timesheets regardless of role.
  // Used by Enter Timesheet > My History tab so admins/managers only see their own.
  findMine(userId: string) {
    return this.prisma.timesheet.findMany({
      where: { employeeId: userId },
      include: {
        employee: { select: { id: true, name: true, email: true, employeeId: true } },
        entries: { include: { task: { include: { project: { select: { id: true, code: true, name: true } } } } } },
      },
      orderBy: { weekStartDate: 'desc' },
    });
  }

  async findOne(id: string, user: { id: string; role: string }) {
    const ts = await this.prisma.timesheet.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, email: true, employeeId: true } },
        entries: { include: { task: { include: { project: { select: { id: true, code: true, name: true } } } } } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (!ts) throw new NotFoundException('Timesheet not found');
    if (!ADMIN_ROLES.includes(user.role) && ts.employeeId !== user.id) throw new ForbiddenException();
    return ts;
  }

  // ── getPending — HIERARCHY-AWARE ──────────────────────────────────────────────
  //
  // The approval hierarchy mirrors the managerEmployeeNo chain in employee_configs:
  //
  //   Team Member      → submits to their manager (PM or CA set in EC upload)
  //   Project Manager  → submits to their manager (CA set in EC upload)
  //   Company Admin    → submits to Super Admin
  //   Super Admin      → top of hierarchy, approves all above them
  //
  // Rules enforced here:
  //   1. You NEVER see your OWN timesheet for approval.
  //   2. SUPER_ADMIN sees ALL submitted timesheets except their own.
  //   3. COMPANY_ADMIN / PROJECT_MANAGER see ONLY timesheets of employees
  //      whose managerEmployeeNo in employee_configs = actor's employeeId (EC code).
  //   4. These filtered timesheets are then enriched with the employee's manager name.
  //
  async getPending(actor: { id: string; role: string; employeeId?: string | null }) {
    if (actor.role === 'SUPER_ADMIN') {
      // Super Admin: all submitted timesheets EXCEPT their own
      const timesheets = await this.prisma.timesheet.findMany({
        where: {
          status: 'SUBMITTED',
          employeeId: { not: actor.id },   // never show own timesheet
        },
        include: {
          employee: { select: { id: true, name: true, email: true, employeeId: true } },
          entries:  { include: { task: { include: { project: { select: { id: true, code: true, name: true } } } } } },
        },
        orderBy: { submittedAt: 'asc' },
      });
      return this.enrichWithManagerInfo(timesheets);
    }

    if (actor.role === 'COMPANY_ADMIN' || actor.role === 'PROJECT_MANAGER') {
      // Resolve actor's employeeId (EC code) — comes from JWT, fallback to DB
      let actorEmployeeId = actor.employeeId;
      if (!actorEmployeeId) {
        this.logger.warn(`getPending: actor ${actor.id} (${actor.role}) has no employeeId in token — looking up from DB`);
        const dbUser = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { employeeId: true } });
        actorEmployeeId = dbUser?.employeeId ?? null;
      }
      if (!actorEmployeeId) {
        this.logger.warn(`getPending: actor ${actor.id} (${actor.role}) has no employeeId in DB either — returning empty list`);
        return [];
      }

      // ── CASCADING HIERARCHY ────────────────────────────────────────────────────
      // Rules by role:
      //   COMPANY_ADMIN  → sees timesheets of all employees in their subtree:
      //                    direct reports (managers) AND those managers' direct reports (team members)
      //   PROJECT_MANAGER → sees only their own direct reports (team members)
      //
      // Implementation: BFS traversal of employee_configs tree starting from actorEmployeeId.
      // Each iteration finds employees whose managerEmployeeNo = nodes from the previous level.
      // CA traverses 2+ levels; PM traverses 1 level.
      //
      const maxDepth = actor.role === 'COMPANY_ADMIN' ? 10 : 1; // CA: full subtree; PM: direct only
      const allSubordinateEcCodes = new Set<string>(); // EC codes of all subordinates
      let currentLevelCodes = [actorEmployeeId];        // start with actor's own EC code

      for (let depth = 0; depth < maxDepth && currentLevelCodes.length > 0; depth++) {
        // Find all EC rows whose managerEmployeeNo is in the current level
        const placeholders = currentLevelCodes.map((_: string, i: number) => `$${i + 1}`).join(', ');
        const lowerCodes   = currentLevelCodes.map((c: string) => c.toLowerCase());
        const nextRows = await this.prisma.$queryRawUnsafe<{ employeeNo: string }[]>(`
          SELECT "employeeNo"
          FROM   employee_configs
          WHERE  LOWER("managerEmployeeNo") IN (${placeholders})
            AND  active = true
        `, ...lowerCodes);

        const nextCodes = nextRows
          .map((r: any) => r.employeeNo)
          .filter((code: string) => !allSubordinateEcCodes.has(code.toLowerCase())); // prevent cycles

        nextCodes.forEach((code: string) => allSubordinateEcCodes.add(code.toLowerCase()));
        currentLevelCodes = nextCodes;
      }

      if (allSubordinateEcCodes.size === 0) return [];

      // Find all user IDs whose employeeId (EC code) is in the subordinate set
      const subordinateCodes = Array.from(allSubordinateEcCodes);
      const placeholders2    = subordinateCodes.map((_: string, i: number) => `$${i + 1}`).join(', ');
      const subordinateUsers = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
        SELECT id FROM users
        WHERE  LOWER("employeeId") IN (${placeholders2})
          AND  active = true
      `, ...subordinateCodes);

      const subordinateUserIds = subordinateUsers.map((u: any) => u.id)
        .filter((uid: string) => uid !== actor.id); // never include actor themselves

      if (subordinateUserIds.length === 0) return [];

      // Fetch submitted timesheets for all subordinates
      const timesheets = await this.prisma.timesheet.findMany({
        where: {
          status:     'SUBMITTED',
          employeeId: { in: subordinateUserIds },
        },
        include: {
          employee: { select: { id: true, name: true, email: true, employeeId: true } },
          entries:  { include: { task: { include: { project: { select: { id: true, code: true, name: true } } } } } },
        },
        orderBy: { submittedAt: 'asc' },
      });

      return this.enrichWithManagerInfo(timesheets);
    }

    // Any other role (TEAM_MEMBER) — return empty (controller guards this but defence-in-depth)
    return [];
  }

  // ── Enrich timesheet list with manager name (EC-to-EC join) ─────────────────
  private async enrichWithManagerInfo(timesheets: any[]): Promise<any[]> {
    return Promise.all(timesheets.map(async ts => {
      try {
        const rows = await this.prisma.$queryRawUnsafe<
          { managerName: string; managerEmployeeNo: string }[]
        >(`
          SELECT mgr.name          AS "managerName",
                 mgr."employeeNo"  AS "managerEmployeeNo"
          FROM   employee_configs ec
          JOIN   employee_configs mgr
                 ON LOWER(mgr."employeeNo") = LOWER(ec."managerEmployeeNo")
          WHERE  LOWER(ec."employeeNo") = LOWER($1)
            AND  ec.active = true
          LIMIT  1
        `, ts.employee?.employeeId ?? '');
        if (rows.length > 0) {
          return { ...ts, managerName: rows[0].managerName, managerEmployeeNo: rows[0].managerEmployeeNo };
        }
      } catch { /* ignore — manager info is best-effort */ }
      return { ...ts, managerName: null, managerEmployeeNo: null };
    }));
  }

  getMyWeek(employeeId: string, weekStartDate: string) {
    return this.prisma.timesheet.findUnique({
      where: { employeeId_weekStartDate: { employeeId, weekStartDate: new Date(weekStartDate) } },
      include: { entries: { include: { task: true } } },
    });
  }

  // Recall: SUBMITTED → DRAFT
  // - Employee can recall their own timesheet (to edit before re-submitting)
  // - Admins/Managers can recall on behalf of an employee (acts as "Send Back")
  async recall(id: string, actorId: string, actorRole?: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!ts) throw new NotFoundException('Timesheet not found');

    const isAdmin = ADMIN_ROLES.includes(actorRole ?? '');

    // Owner check — admins can recall any, employees only their own
    if (!isAdmin && ts.employeeId !== actorId) {
      throw new ForbiddenException('You can only recall your own timesheets');
    }
    if (ts.status === 'APPROVED')  throw new BadRequestException('This timesheet has already been approved and cannot be recalled');
    if (ts.status === 'REJECTED')  throw new BadRequestException('This timesheet was rejected — edit and resubmit instead of recalling');
    if (ts.status !== 'SUBMITTED') throw new BadRequestException('Only submitted timesheets can be recalled');
    return this.prisma.timesheet.update({
      where: { id },
      data:  { status: 'DRAFT', submittedAt: null },
      include: { entries: true },
    });
  }

  // Delete: permanently remove a DRAFT timesheet (owner only)
  async deleteDraft(id: string, employeeId: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!ts) throw new NotFoundException('Timesheet not found');
    if (ts.employeeId !== employeeId) throw new ForbiddenException('You can only delete your own timesheets');
    if (ts.status === 'SUBMITTED') throw new BadRequestException('Recall the timesheet first, then delete');
    if (ts.status === 'APPROVED')  throw new BadRequestException('Approved timesheets cannot be deleted');
    if (ts.status !== 'DRAFT')     throw new BadRequestException('Only draft timesheets can be deleted');
    await this.prisma.timesheetEntry.deleteMany({ where: { timesheetId: id } });
    await this.prisma.timesheet.delete({ where: { id } });
    return { deleted: true, id };
  }
}
