import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/create-task.dto';

const BLOCKED_STATUSES = ['ON_HOLD', 'COMPLETED', 'CANCELLED'];

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaskDto, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.task.create({
      data: {
        projectId:   dto.projectId,
        name:        dto.name,
        description: dto.description,
        taskType:    dto.taskType   as any,
        priority:    dto.priority   as any ?? 'MEDIUM',
        startDate:   dto.startDate  ? new Date(dto.startDate) : undefined,
        endDate:     dto.endDate    ? new Date(dto.endDate)   : undefined,
        billable:    dto.billable   ?? true,
        status:      'ACTIVE'       as any,
        createdById: userId,
      },
      include: { project: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.name        !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.taskType    !== undefined && { taskType: dto.taskType as any }),
        ...(dto.priority    !== undefined && { priority: dto.priority as any }),
        ...(dto.startDate   !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate     !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.billable    !== undefined && { billable: dto.billable }),
        ...(dto.status      !== undefined && { status: dto.status as any }),
      },
      include: { project: { select: { id: true, code: true, name: true } } },
    });
  }

  findAll(projectId?: string) {
    return this.prisma.task.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project:  { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        assignments: {
          include: { employee: { select: { id: true, name: true, employeeId: true } } },
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Only returns ACTIVE tasks — used by Enter Timesheet */
  findActive(projectId?: string) {
    return this.prisma.task.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        status: 'ACTIVE',
      },
      include: { project: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project:  { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        assignments: {
          include: { employee: { select: { id: true, name: true, employeeId: true } } },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  /** Called before saving a timesheet entry — validates task is ACTIVE */
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
