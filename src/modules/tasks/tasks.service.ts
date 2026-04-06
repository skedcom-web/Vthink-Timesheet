import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/create-task.dto';

const BLOCKED_STATUSES = ['ON_HOLD', 'COMPLETED', 'CANCELLED'];

export const CREATION_STATUS = {
  ON_TIME:    'ON_TIME_CREATION',
  DELAYED:    'DELAYED_CREATION',
  NO_END_DATE: 'NO_END_DATE',
} as const;

// ── Derives creationStatus at the exact moment of creation ───────────────────
function deriveCreationStatus(endDate?: string): string {
  if (!endDate) return CREATION_STATUS.NO_END_DATE;
  const end   = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end < today ? CREATION_STATUS.DELAYED : CREATION_STATUS.ON_TIME;
}

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);

  constructor(private prisma: PrismaService) {}

  // ── Ensure creationStatus column + backfill existing rows ───────────────────
  async onModuleInit() {
    // Step 1: add column if missing
    try {
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE tasks
          ADD COLUMN IF NOT EXISTS "creationStatus" TEXT NOT NULL DEFAULT 'ON_TIME_CREATION';
      `);
      this.logger.log('tasks.creationStatus column ready ✓');
    } catch (err) {
      this.logger.warn('Could not add creationStatus column:', err?.message);
    }

    // Step 2: backfill rows that were saved before creationStatus logic existed.
    // DB default 'ON_TIME_CREATION' was applied blindly to old rows — correct them:
    //   endDate IS NULL          → NO_END_DATE
    //   endDate is in the past   → DELAYED_CREATION
    try {
      const noEndFixed = await this.prisma.$executeRawUnsafe(`
        UPDATE tasks
           SET "creationStatus" = 'NO_END_DATE'
         WHERE "endDate" IS NULL
           AND "creationStatus" = 'ON_TIME_CREATION'
      `);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const delayedFixed = await this.prisma.$executeRawUnsafe(`
        UPDATE tasks
           SET "creationStatus" = 'DELAYED_CREATION'
         WHERE "endDate" IS NOT NULL
           AND "endDate" < $1
           AND "creationStatus" = 'ON_TIME_CREATION'
      `, today);
      this.logger.log(
        'creationStatus backfill: ' + noEndFixed + ' → NO_END_DATE, ' + delayedFixed + ' → DELAYED_CREATION'
      );
    } catch (err) {
      this.logger.warn('creationStatus backfill failed:', err?.message);
    }
  }

  // ── Resolve project ID — checks projects table then project_configs ───────────
  private async resolveProjectId(incomingId: string): Promise<string> {
    const direct = await this.prisma.project.findUnique({ where: { id: incomingId } });
    if (direct) return direct.id;

    this.logger.warn(`Project id="${incomingId}" not in projects table — checking project_configs`);

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { code: string; name: string; client: string | null; description: string | null }[]
      >(
        `SELECT code, name, client, description FROM project_configs WHERE id = $1 AND active = true LIMIT 1`,
        incomingId
      );

      if (rows.length > 0) {
        const { code, name, client, description } = rows[0];
        const byCode = await this.prisma.project.findUnique({ where: { code } });
        if (byCode) return byCode.id;

        this.logger.log(`Auto-creating project row for code="${code}"`);
        const created = await this.prisma.project.create({
          data: { id: incomingId, code, name, description: description ?? null, clientName: client ?? null, status: 'ACTIVE' as any },
        });
        return created.id;
      }
    } catch (err) {
      this.logger.warn('project_configs lookup failed:', err?.message);
    }

    throw new NotFoundException(
      `Project not found (id="${incomingId}"). Please re-upload your project list via Admin → Project & Task Config.`
    );
  }

  // ── Create task ───────────────────────────────────────────────────────────────
  async create(dto: CreateTaskDto, userId: string) {
    const projectId      = await this.resolveProjectId(dto.projectId);
    const creationStatus = deriveCreationStatus(dto.endDate);

    this.logger.log(`Task "${dto.name}" → creationStatus="${creationStatus}"`);

    return this.prisma.task.create({
      // 'as any' on data bypasses stale Prisma generated types that predate
      // the creationStatus column addition. Remove once `npx prisma generate`
      // has been re-run on the target machine.
      data: {
        projectId,
        name:           dto.name,
        description:    dto.description,
        taskType:       dto.taskType as any,
        priority:       (dto.priority as any) ?? 'MEDIUM',
        startDate:      dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:        dto.endDate   ? new Date(dto.endDate)   : undefined,
        billable:       dto.billable  ?? true,
        status:         'ACTIVE'      as any,
        creationStatus, // field exists in DB via onModuleInit ALTER TABLE
        createdById:    userId,
      } as any,
      include: { project: { select: { id: true, code: true, name: true } } },
    });
  }

  // ── Update task ───────────────────────────────────────────────────────────────
  // creationStatus rules on update:
  //   • ON_TIME_CREATION  → always immutable (was created correctly)
  //   • DELAYED_CREATION  → always immutable (historical fact — was created late)
  //   • NO_END_DATE       → re-evaluated when the user finally adds an end date:
  //       - end date added and it's in the past  → becomes DELAYED_CREATION
  //       - end date added and it's today/future → becomes ON_TIME_CREATION
  //       - end date explicitly cleared          → stays / reverts to NO_END_DATE
  async update(id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    // Re-evaluate creationStatus whenever endDate is being changed.
    // Rules:
    //   endDate cleared (set to '')        → NO_END_DATE
    //   endDate set to past date           → DELAYED_CREATION
    //   endDate set to today/future        → ON_TIME_CREATION
    //   endDate not included in update     → leave creationStatus unchanged
    let newCreationStatus: string | undefined;
    if (dto.endDate !== undefined) {
      newCreationStatus = deriveCreationStatus(dto.endDate || undefined);
      this.logger.log(
        `Task "${task.name}" endDate changed → "${dto.endDate}" → creationStatus="${newCreationStatus}"`
      );
    }

    return this.prisma.task.update({
      where: { id },
      data: ({
        ...(dto.name        !== undefined && { name:        dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.taskType    !== undefined && { taskType:    dto.taskType }),
        ...(dto.priority    !== undefined && { priority:    dto.priority }),
        ...(dto.startDate   !== undefined && { startDate:   dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate     !== undefined && { endDate:     dto.endDate   ? new Date(dto.endDate)   : null }),
        ...(dto.billable    !== undefined && { billable:    dto.billable }),
        ...(dto.status      !== undefined && { status:      dto.status }),
        // Only update creationStatus if the rule above decided it should change
        ...(newCreationStatus !== undefined && { creationStatus: newCreationStatus }),
      } as any),
      include: { project: { select: { id: true, code: true, name: true } } },
    });
  }

  // ── Find all tasks ────────────────────────────────────────────────────────────
  // ── findAll — hierarchy-aware ───────────────────────────────────────────────
  // Rules:
  //   SUPER_ADMIN    → all tasks (company-wide visibility)
  //   COMPANY_ADMIN  → tasks created by anyone in their subtree (BFS)
  //   PROJECT_MANAGER→ only tasks they personally created
  //   TEAM_MEMBER    → not applicable (no access to this screen)
  async findAll(
    actor: { id: string; role: string; employeeId?: string | null },
    projectId?: string,
  ) {
    const baseInclude = {
      project:   { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      assignments: {
        include: { employee: { select: { id: true, name: true, employeeId: true } } },
        where:   { status: 'ACTIVE' as any },
      },
    } as any;
    const baseOrder = { createdAt: 'desc' as const };
    const projectFilter = projectId ? { projectId } : {};

    // Super Admin: return everything
    if (actor.role === 'SUPER_ADMIN') {
      return this.prisma.task.findMany({
        where: { ...projectFilter },
        include: baseInclude, orderBy: baseOrder,
      });
    }

    // Project Manager: only tasks they created
    if (actor.role === 'PROJECT_MANAGER') {
      return this.prisma.task.findMany({
        where: { ...projectFilter, createdById: actor.id },
        include: baseInclude, orderBy: baseOrder,
      });
    }

    // Company Admin: tasks created by anyone in their subtree (BFS on EC)
    if (actor.role === 'COMPANY_ADMIN') {
      const subtreeUserIds = await this.getSubtreeUserIds(actor);
      // Include the CA themselves too
      const creatorIds = [...subtreeUserIds, actor.id];
      return this.prisma.task.findMany({
        where: { ...projectFilter, createdById: { in: creatorIds } },
        include: baseInclude, orderBy: baseOrder,
      });
    }

    return [];
  }

  // ── BFS: get all user IDs in the actor's reporting subtree ──────────────────
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

  // ── Find only ACTIVE tasks (Enter Timesheet) ──────────────────────────────────
  findActive(projectId?: string) {
    return this.prisma.task.findMany({
      where: { ...(projectId ? { projectId } : {}), status: 'ACTIVE' },
      include: { project: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Find one task ─────────────────────────────────────────────────────────────
  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project:   { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        assignments: {
          include: { employee: { select: { id: true, name: true, employeeId: true } } },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  // ── Validate task ACTIVE (timesheets) ────────────────────────────────────────
  async validateTaskActive(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Task not found: ${taskId}`);
    if (BLOCKED_STATUSES.includes(task.status)) {
      throw new BadRequestException(
        `Cannot log hours against task "${task.name}" — it is ${task.status.replace('_', ' ').toLowerCase()}.`
      );
    }
    return task;
  }
}
