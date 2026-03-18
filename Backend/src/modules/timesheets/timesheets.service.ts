import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { TasksService } from '../tasks/tasks.service';

const ADMIN_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'];

@Injectable()
export class TimesheetsService {
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

  async approve(id: string, approverId: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!ts) throw new NotFoundException('Timesheet not found');
    if (ts.status !== 'SUBMITTED') throw new BadRequestException('Only submitted timesheets can be approved');
    return this.prisma.timesheet.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: approverId },
      include: { employee: { select: { id: true, name: true, email: true } } },
    });
  }

  async reject(id: string, approverId: string, reason?: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id } });
    if (!ts) throw new NotFoundException('Timesheet not found');
    if (ts.status !== 'SUBMITTED') throw new BadRequestException('Only submitted timesheets can be rejected');
    return this.prisma.timesheet.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason },
      include: { employee: { select: { id: true, name: true, email: true } } },
    });
  }

  async findAll(user: { id: string; role: string }) {
    const where = ADMIN_ROLES.includes(user.role) ? {} : { employeeId: user.id };
    const timesheets = await this.prisma.timesheet.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, employeeId: true } },
        entries: { include: { task: { include: { project: { select: { id: true, code: true, name: true } } } } } },
      },
      orderBy: { weekStartDate: 'desc' },
    });

    // Enrich with manager info for admins viewing all timesheets
    if (!ADMIN_ROLES.includes(user.role)) return timesheets;

    const enriched = await Promise.all(timesheets.map(async ts => {
      try {
        const rows = await this.prisma.$queryRawUnsafe<
          { managerName: string; managerEmployeeNo: string }[]
        >(`
          SELECT
            mgr.name        AS "managerName",
            mgr."employeeNo" AS "managerEmployeeNo"
          FROM employee_configs ec
          JOIN employee_configs mgr
               ON LOWER(mgr."employeeNo") = LOWER(ec."managerEmployeeNo")
          WHERE LOWER(ec."employeeNo") = LOWER($1)
            AND ec.active = true
          LIMIT 1
        `, ts.employee?.employeeId ?? '');
        if (rows.length > 0) {
          return { ...ts, managerName: rows[0].managerName, managerEmployeeNo: rows[0].managerEmployeeNo };
        }
      } catch { /* ignore */ }
      return { ...ts, managerName: null, managerEmployeeNo: null };
    }));
    return enriched;
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

  async getPending() {
    // Fetch submitted timesheets with full employee + entry details
    const timesheets = await this.prisma.timesheet.findMany({
      where: { status: 'SUBMITTED' },
      include: {
        employee: { select: { id: true, name: true, email: true, employeeId: true } },
        entries: { include: { task: { include: { project: { select: { id: true, code: true, name: true } } } } } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // Enrich each timesheet with the employee's manager name and employeeId.
    // Manager is stored in employee_configs.managerEmployeeNo which maps to users.employeeId.
    const enriched = await Promise.all(timesheets.map(async ts => {
      try {
        const rows = await this.prisma.$queryRawUnsafe<
          { managerName: string; managerEmployeeNo: string }[]
        >(`
          SELECT
            mgr.name        AS "managerName",
            mgr."employeeNo" AS "managerEmployeeNo"
          FROM employee_configs ec
          JOIN employee_configs mgr
               ON LOWER(mgr."employeeNo") = LOWER(ec."managerEmployeeNo")
          WHERE LOWER(ec."employeeNo") = LOWER($1)
            AND ec.active = true
          LIMIT 1
        `, ts.employee?.employeeId ?? '');

        if (rows.length > 0) {
          return {
            ...ts,
            managerName:       rows[0].managerName,
            managerEmployeeNo: rows[0].managerEmployeeNo,
          };
        }
      } catch { /* ignore — manager lookup is best-effort */ }
      return { ...ts, managerName: null, managerEmployeeNo: null };
    }));

    return enriched;
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
