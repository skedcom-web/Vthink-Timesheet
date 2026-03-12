import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const ADMIN_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'];

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    const isAdmin = ADMIN_ROLES.includes(user.role);
    const employeeFilter = isAdmin ? {} : { employeeId: user.id };

    const [submitted, pending, pendingApprovals, hoursResult] = await Promise.all([
      this.prisma.timesheet.count({ where: { ...employeeFilter, status: { in: ['SUBMITTED', 'APPROVED'] } } }),
      this.prisma.timesheet.count({ where: { ...employeeFilter, status: 'DRAFT' } }),
      this.prisma.timesheet.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.timesheetEntry.aggregate({
        _sum: { totalHours: true },
        where: { timesheet: { ...employeeFilter } },
      }),
    ]);

    return {
      timesheetsSubmitted: { count: submitted, period: 'This Month', trend: '+12%' },
      pendingTimesheets: { count: pending, trend: '-3' },
      pendingApprovals: { count: pendingApprovals, trend: '+5' },
      totalHoursLogged: { count: Number(hoursResult._sum.totalHours || 0), period: 'This Month', trend: '+8%' },
    };
  }
}
