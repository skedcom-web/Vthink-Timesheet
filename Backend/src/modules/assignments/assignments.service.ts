import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAssignmentDto, assignedById: string) {
    const task = await this.prisma.task.findUnique({ where: { id: dto.taskId } });
    if (!task) throw new NotFoundException('Task not found');
    const employee = await this.prisma.user.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const start = new Date(dto.assignStartDate);
    const end = new Date(dto.assignEndDate);
    if (start > end) throw new BadRequestException('Start date must be before end date');

    return this.prisma.taskAssignment.create({
      data: {
        taskId: dto.taskId,
        employeeId: dto.employeeId,
        assignStartDate: start,
        assignEndDate: end,
        allocationPercentage: dto.allocationPercentage,
        roleOnTask: dto.roleOnTask,
        assignedById,
      },
      include: {
        task: { include: { project: { select: { id: true, code: true, name: true } } } },
        employee: { select: { id: true, name: true, email: true, employeeId: true } },
      },
    });
  }

  findAll() {
    return this.prisma.taskAssignment.findMany({
      include: {
        task: { include: { project: { select: { id: true, code: true, name: true } } } },
        employee: { select: { id: true, name: true, employeeId: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }
}
