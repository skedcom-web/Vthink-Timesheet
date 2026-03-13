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
    const isAdmin       = ADMIN_ROLES.includes(user.role);
    const employeeFilter = isAdmin ? {} : { employeeId: user.id };

    // ── Date ranges ─────────────────────────────────────────────────────────
    const now            = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // ── Timesheet counts ─────────────────────────────────────────────────────
    const [
      submittedThisMonth,
      submittedLastMonth,
      pendingDraft,
      pendingApprovals,
      hoursThisMonth,
      hoursLastMonth,
      totalProjects,
      totalTasks,
      activeTasks,
      teamMembers,
    ] = await Promise.all([
      this.prisma.timesheet.count({
        where: { ...employeeFilter, status: { in: ['SUBMITTED', 'APPROVED'] }, createdAt: { gte: thisMonthStart } },
      }),
      this.prisma.timesheet.count({
        where: { ...employeeFilter, status: { in: ['SUBMITTED', 'APPROVED'] }, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      this.prisma.timesheet.count({ where: { ...employeeFilter, status: 'DRAFT' } }),
      this.prisma.timesheet.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.timesheetEntry.aggregate({
        _sum: { totalHours: true },
        where: { timesheet: { ...employeeFilter, createdAt: { gte: thisMonthStart } } },
      }),
      this.prisma.timesheetEntry.aggregate({
        _sum: { totalHours: true },
        where: { timesheet: { ...employeeFilter, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } },
      }),
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { role: 'TEAM_MEMBER', active: true } }),
    ]);

    // ── creationStatus counts via raw SQL (avoids stale generated-type issue) ─
    // The creationStatus column is added via onModuleInit in TasksService,
    // so it exists in the DB even if the Prisma generated client doesn't know it yet.
    let delayedTasks  = 0;
    let noEndDateTasks = 0;
    let onTimeTasks   = 0;

    try {
      const rows = await this.prisma.$queryRawUnsafe<{ creation_status: string; cnt: bigint }[]>(`
        SELECT "creationStatus" AS creation_status, COUNT(*)::int AS cnt
        FROM tasks
        GROUP BY "creationStatus"
      `);
      for (const row of rows) {
        const count = Number(row.cnt);
        if (row.creation_status === 'DELAYED_CREATION') delayedTasks   = count;
        else if (row.creation_status === 'NO_END_DATE') noEndDateTasks = count;
        else if (row.creation_status === 'ON_TIME_CREATION') onTimeTasks = count;
      }
    } catch {
      // Column may not exist on very first startup before TasksService.onModuleInit runs
    }

    // ── Trend helpers ────────────────────────────────────────────────────────
    const trendPct = (current: number, previous: number): string => {
      if (previous === 0 && current === 0) return 'No activity yet';
      if (previous === 0) return `+${current} this month`;
      const pct = Math.round(((current - previous) / previous) * 100);
      return pct >= 0 ? `+${pct}% vs last month` : `${pct}% vs last month`;
    };

    const hoursNow  = Number(hoursThisMonth._sum.totalHours  || 0);
    const hoursLast = Number(hoursLastMonth._sum.totalHours  || 0);

    return {
      timesheetsSubmitted: {
        count:  submittedThisMonth,
        period: 'This month',
        trend:  trendPct(submittedThisMonth, submittedLastMonth),
        up:     submittedThisMonth >= submittedLastMonth,
      },
      pendingTimesheets: {
        count:  pendingDraft,
        trend:  pendingDraft === 0 ? 'All submitted' : `${pendingDraft} awaiting submission`,
        up:     pendingDraft === 0,
      },
      pendingApprovals: {
        count:  pendingApprovals,
        trend:  pendingApprovals === 0 ? 'All clear' : `${pendingApprovals} need review`,
        up:     pendingApprovals === 0,
      },
      totalHoursLogged: {
        count:  Math.round(hoursNow * 10) / 10,
        period: 'This month',
        trend:  trendPct(hoursNow, hoursLast),
        up:     hoursNow >= hoursLast,
      },
      projects: {
        total: totalProjects,
        trend: totalProjects === 0 ? 'No projects yet' : `${totalProjects} active project${totalProjects !== 1 ? 's' : ''}`,
      },
      tasks: {
        total:      totalTasks,
        active:     activeTasks,
        delayed:    delayedTasks,
        noEndDate:  noEndDateTasks,
        onTime:     onTimeTasks,
      },
      team: {
        members: teamMembers,
      },
    };
  }
}
