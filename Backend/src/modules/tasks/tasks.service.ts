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
  findAll(projectId?: string) {
    return this.prisma.task.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project:   { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        assignments: {
          include: { employee: { select: { id: true, name: true, employeeId: true } } },
          where:   { status: 'ACTIVE' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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
  // Checks:
  //   1. Task exists
  //   2. Task status is not ON_HOLD / COMPLETED / CANCELLED
  //   3. Task end date has not passed (if set)
  async validateTaskActive(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where:   { id: taskId },
      include: { project: { select: { code: true, name: true } } },
    });
    if (!task) throw new NotFoundException(`Task not found: ${taskId}`);

    if (BLOCKED_STATUSES.includes(task.status)) {
      throw new BadRequestException(
        `Cannot log hours against task "${task.name}" — it is ${task.status.replace('_', ' ').toLowerCase()}.`
      );
    }

    // Check if the task end date has already passed
    if ((task as any).endDate) {
      const endDate = new Date((task as any).endDate);
      const today   = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) {
        const projectCode = (task as any).project?.code ?? 'Project';
        const fmtDate     = endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        throw new BadRequestException(
          `${projectCode} — ${task.name} ended on ${fmtDate}. Cannot enter time for this task. Contact your manager to either extend the task end date or assign a new task.`
        );
      }
    }

    return task;
  }

  // ── Find tasks assigned to a specific user (for Enter Timesheet) ─────────────
  // Only returns tasks where:
  //   - the user has an ACTIVE assignment
  //   - the task itself is ACTIVE
  //   - the task end date has not passed
  // This ensures Team Members only see tasks their manager assigned them.
  async findAssignedToUser(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active task assignments for this user
    const assignments = await this.prisma.taskAssignment.findMany({
      where: {
        employeeId: userId,
        status:     'ACTIVE',
        task: {
          status: 'ACTIVE',
        },
      },
      include: {
        task: {
          include: {
            project: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    // Filter out tasks whose end date has already passed
    const validAssignments = assignments.filter(a => {
      const endDate = (a.task as any).endDate;
      if (!endDate) return true; // no end date — always valid
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      return end >= today;
    });

    // Return just the task objects (deduplicated by task id)
    const seen = new Set<string>();
    const tasks: any[] = [];
    for (const a of validAssignments) {
      if (!seen.has(a.task.id)) {
        seen.add(a.task.id);
        tasks.push(a.task);
      }
    }
    return tasks;
  }
}
