import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  /** Calendar date at local midnight (server TZ) for fair YYYY-MM-DD comparisons */
  private atLocalMidnight(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private fmtGb(d: Date): string {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** True if the calendar date is strictly before the first day of the current month */
  private isBeforeFirstDayOfCurrentMonth(d: Date, now: Date): boolean {
    const a = this.atLocalMidnight(d);
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return a < first;
  }

  /** Task is considered ended when it has an end date before today (calendar) */
  private taskHasEnded(taskEnd: Date | null | undefined, now: Date): boolean {
    if (!taskEnd) return false;
    return this.atLocalMidnight(taskEnd) < this.atLocalMidnight(now);
  }

  /**
   * Enforces:
   * - Assignment window inside task start/end when those exist
   * - For tasks not yet ended: assignment dates must not fall in a month before the current month (timesheet window)
   * - For ended tasks: skip the month rule; only task bounds apply
   */
  private validateAssignmentWindow(
    task: { startDate: Date | null; endDate: Date | null },
    assignStart: Date,
    assignEnd: Date,
    now: Date,
  ): void {
    const s = this.atLocalMidnight(assignStart);
    const e = this.atLocalMidnight(assignEnd);
    if (s > e) throw new BadRequestException('Start date must be before end date');

    const taskStart = task.startDate ? this.atLocalMidnight(task.startDate) : null;
    const taskEnd = task.endDate ? this.atLocalMidnight(task.endDate) : null;

    if (taskStart && s < taskStart) {
      throw new BadRequestException(
        'Task cannot be assigned as the start date of task assigning date is lesser than the actual start date of the task',
      );
    }
    if (taskEnd && e > taskEnd) {
      throw new BadRequestException(
        `Assignment end date (${this.fmtGb(e)}) cannot exceed the task end date (${this.fmtGb(taskEnd)}). ` +
          `Either extend the task's end date in Add Task first, or create a new task and re-assign.`,
      );
    }
    if (taskStart && e < taskStart) {
      throw new BadRequestException('Assignment end date cannot be before the task start date.');
    }
    if (taskEnd && s > taskEnd) {
      throw new BadRequestException('Assignment start date cannot be after the task end date.');
    }

    const ended = this.taskHasEnded(task.endDate, now);
    if (!ended) {
      const msg =
        'Tasks cannot be assigned for previous month as timesheet window is closed for last month';
      if (this.isBeforeFirstDayOfCurrentMonth(s, now) || this.isBeforeFirstDayOfCurrentMonth(e, now)) {
        throw new BadRequestException(msg);
      }
    }
  }

  // ── Resolve employee: look up by employeeId (UUID) first, then by employeeNo
  // from employee_configs, then fall back to first user matched by name.
  // If nothing found, create a lightweight TEAM_MEMBER user record on the fly.
  private async resolveEmployee(dto: CreateAssignmentDto): Promise<string> {
    // 1. Direct UUID match in users table
    if (dto.employeeId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.employeeId } });
      if (user) return user.id;
    }

    // 2. Match by employeeNo (users.employeeId column)
    if (dto.employeeNo) {
      const user = await this.prisma.user.findUnique({ where: { employeeId: dto.employeeNo } });
      if (user) return user.id;
    }

    // 3. Look up in employee_configs and auto-create a user record
    if (dto.employeeNo) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM employee_configs WHERE "employeeNo" = $1 AND active = true LIMIT 1`,
        dto.employeeNo
      );
      if (rows.length > 0) {
        const emp = rows[0];
        return this.upsertUserFromConfig(emp);
      }
    }

    // 4. Look up by name in employee_configs
    if (dto.employeeName) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM employee_configs WHERE LOWER(name) = LOWER($1) AND active = true LIMIT 1`,
        dto.employeeName
      );
      if (rows.length > 0) {
        const emp = rows[0];
        return this.upsertUserFromConfig(emp);
      }
    }

    throw new NotFoundException(
      `Employee not found. Provide a valid employeeNo or employeeName.`
    );
  }

  // ── Create or find a User record from an employee_config row ────────────────
  private async upsertUserFromConfig(emp: any): Promise<string> {
    // Check if user already exists with this employeeId
    if (emp.employeeNo) {
      const existing = await this.prisma.user.findUnique({
        where: { employeeId: emp.employeeNo },
      });
      if (existing) return existing.id;
    }

    // Check by email
    if (emp.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: emp.email } });
      if (existing) {
        // Patch employeeId if missing
        if (!existing.employeeId && emp.employeeNo) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: { employeeId: emp.employeeNo, department: emp.designation },
          });
        }
        return existing.id;
      }
    }

    // Create new user record
    const email = emp.email || `${emp.employeeNo?.toLowerCase() ?? 'emp'}@vthink.local`;
    const newUser = await this.prisma.user.create({
      data: {
        name:         emp.name,
        email,
        passwordHash: '$2b$10$placeholder.not.for.login.xxxxxxxxxxxxxxxxxxxxxxxxxxx',
        role:         'TEAM_MEMBER',
        employeeId:   emp.employeeNo ?? null,
        department:   emp.designation ?? null,
        active:       true,
      },
    });
    return newUser.id;
  }

  async create(dto: CreateAssignmentDto, assignedById: string) {
    const task = await this.prisma.task.findUnique({ where: { id: dto.taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const resolvedEmployeeId = await this.resolveEmployee(dto);

    const start = new Date(dto.assignStartDate);
    const end   = new Date(dto.assignEndDate);
    this.validateAssignmentWindow(task, start, end, new Date());

    return this.prisma.taskAssignment.create({
      data: {
        taskId:               dto.taskId,
        employeeId:           resolvedEmployeeId,
        assignStartDate:      start,
        assignEndDate:        end,
        allocationPercentage: dto.allocationPercentage,
        roleOnTask:           dto.roleOnTask,
        assignedById,
      },
      include: {
        task:     { include: { project: { select: { id: true, code: true, name: true } } } },
        employee: { select: { id: true, name: true, email: true, employeeId: true } },
      },
    });
  }

  // ── findAll — hierarchy-aware ───────────────────────────────────────────────
  // Rules:
  //   SUPER_ADMIN    → all assignments (company-wide)
  //   COMPANY_ADMIN  → assignments made by anyone in their subtree
  //   PROJECT_MANAGER→ only assignments they personally created
  async findAll(actor: { id: string; role: string; employeeId?: string | null }) {
    const baseInclude = {
      task:     { include: { project: { select: { id: true, code: true, name: true } } } },
      employee: { select: { id: true, name: true, employeeId: true } },
    };

    if (actor.role === 'SUPER_ADMIN') {
      return this.prisma.taskAssignment.findMany({
        include: baseInclude, orderBy: { assignedAt: 'desc' },
      });
    }

    if (actor.role === 'PROJECT_MANAGER') {
      return this.prisma.taskAssignment.findMany({
        where:   { assignedById: actor.id },
        include: baseInclude, orderBy: { assignedAt: 'desc' },
      });
    }

    if (actor.role === 'COMPANY_ADMIN') {
      const subtreeUserIds = await this.getSubtreeUserIds(actor);
      const assignerIds    = [...subtreeUserIds, actor.id];
      return this.prisma.taskAssignment.findMany({
        where:   { assignedById: { in: assignerIds } },
        include: baseInclude, orderBy: { assignedAt: 'desc' },
      });
    }

    return [];
  }

  // ── BFS subtree helper (same pattern as tasks.service) ──────────────────────
  private async getSubtreeUserIds(
    actor: { id: string; employeeId?: string | null }
  ): Promise<string[]> {
    if (!actor.employeeId) return [];
    const allEcCodes = new Set<string>();
    let frontier     = [actor.employeeId.toLowerCase()];

    for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
      const placeholders = frontier.map((_, i) => `$${i + 1}`).join(', ');
      const rows = await this.prisma.$queryRawUnsafe<{ employeeNo: string }[]>(`
        SELECT "employeeNo" FROM employee_configs
        WHERE LOWER("managerEmployeeNo") IN (${placeholders}) AND active = true
      `, ...frontier);
      const next = rows.map(r => r.employeeNo.toLowerCase()).filter(c => !allEcCodes.has(c));
      next.forEach(c => allEcCodes.add(c));
      frontier = next;
    }

    if (allEcCodes.size === 0) return [];
    const codes = Array.from(allEcCodes);
    const placeholders = codes.map((_, i) => `$${i + 1}`).join(', ');
    const users = await this.prisma.$queryRawUnsafe<{ id: string }[]>(`
      SELECT id FROM users WHERE LOWER("employeeId") IN (${placeholders}) AND active = true
    `, ...codes);
    return users.map(u => u.id);
  }

  // ── Update assignment (extend end date, change allocation/role) ───────────────
  async update(id: string, dto: Partial<{
    assignEndDate:        string;
    allocationPercentage: number;
    roleOnTask:           string;
  }>) {
    const asgn = await this.prisma.taskAssignment.findUnique({ where: { id } });
    if (!asgn) throw new NotFoundException('Assignment not found');

    if (dto.assignEndDate !== undefined) {
      const task = await this.prisma.task.findUnique({ where: { id: asgn.taskId } });
      if (!task) throw new NotFoundException('Task not found');
      const newEnd = new Date(dto.assignEndDate);
      this.validateAssignmentWindow(task, asgn.assignStartDate, newEnd, new Date());
    }

    return this.prisma.taskAssignment.update({
      where: { id },
      data: {
        ...(dto.assignEndDate        !== undefined && { assignEndDate:        new Date(dto.assignEndDate) }),
        ...(dto.allocationPercentage !== undefined && { allocationPercentage: dto.allocationPercentage }),
        ...(dto.roleOnTask           !== undefined && { roleOnTask:           dto.roleOnTask }),
      },
      include: {
        task:     { include: { project: { select: { id: true, code: true, name: true } } } },
        employee: { select: { id: true, name: true, employeeId: true } },
      },
    });
  }
}
