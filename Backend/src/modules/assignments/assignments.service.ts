import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

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
    if (start > end) throw new BadRequestException('Start date must be before end date');

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

  findAll() {
    return this.prisma.taskAssignment.findMany({
      include: {
        task:     { include: { project: { select: { id: true, code: true, name: true } } } },
        employee: { select: { id: true, name: true, employeeId: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }
}
