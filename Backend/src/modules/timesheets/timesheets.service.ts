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
      return this.prisma.timesheet.update({
        where: { id: existing.id },
        data: { totalHours, entries: { create: entryData } },
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

  getPending() {
    return this.prisma.timesheet.findMany({
      where: { status: 'SUBMITTED' },
      include: {
        employee: { select: { id: true, name: true, email: true, employeeId: true } },
        entries: { include: { task: { include: { project: { select: { id: true, code: true, name: true } } } } } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  getMyWeek(employeeId: string, weekStartDate: string) {
    return this.prisma.timesheet.findUnique({
      where: { employeeId_weekStartDate: { employeeId, weekStartDate: new Date(weekStartDate) } },
      include: { entries: { include: { task: true } } },
    });
  }
}
