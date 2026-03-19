import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { TimesheetsService } from '../timesheets/timesheets.service';

const ADMIN_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'];

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(
    private prisma: PrismaService,
    private timesheetsService: TimesheetsService,
  ) {}

  @Get('stats')
  async getStats(@CurrentUser() user: any) {
    const isAdmin        = ADMIN_ROLES.includes(user.role);
    const isSuperAdmin   = user.role === 'SUPER_ADMIN';
    const isCompanyAdmin = user.role === 'COMPANY_ADMIN';
    const isManager      = user.role === 'PROJECT_MANAGER';
    const employeeFilter = isAdmin ? {} : { employeeId: user.id };

    // ── Date ranges ─────────────────────────────────────────────────────────
    const now            = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thisWeekStart  = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay() + 1); thisWeekStart.setHours(0,0,0,0);

    // ── Hierarchy-aware pending approvals (same logic as Approve screen) ────
    let pendingApprovals = 0;
    let pendingList: any[] = [];
    try {
      pendingList      = await this.timesheetsService.getPending(user);
      pendingApprovals = pendingList.length;
    } catch { pendingApprovals = 0; }

    // ── Own timesheet stats (for non-SA roles that can enter timesheets) ────
    const [
      submittedThisMonth, submittedLastMonth,
      pendingDraft,
      hoursThisMonth, hoursLastMonth,
      totalProjects, totalTasks, activeTasks, teamMembers,
    ] = await Promise.all([
      this.prisma.timesheet.count({ where: { ...employeeFilter, status: { in: ['SUBMITTED','APPROVED'] }, createdAt: { gte: thisMonthStart } } }),
      this.prisma.timesheet.count({ where: { ...employeeFilter, status: { in: ['SUBMITTED','APPROVED'] }, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
      this.prisma.timesheet.count({ where: { ...employeeFilter, status: 'DRAFT' } }),
      this.prisma.timesheetEntry.aggregate({ _sum: { totalHours: true }, where: { timesheet: { ...employeeFilter, createdAt: { gte: thisMonthStart } } } }),
      this.prisma.timesheetEntry.aggregate({ _sum: { totalHours: true }, where: { timesheet: { ...employeeFilter, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } } }),
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { role: 'TEAM_MEMBER', active: true } }),
    ]);

    // ── creationStatus counts ────────────────────────────────────────────────
    let delayedTasks = 0, noEndDateTasks = 0, onTimeTasks = 0;
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ creation_status: string; cnt: bigint }[]>(`
        SELECT "creationStatus" AS creation_status, COUNT(*)::int AS cnt FROM tasks GROUP BY "creationStatus"
      `);
      for (const row of rows) {
        const count = Number(row.cnt);
        if (row.creation_status === 'DELAYED_CREATION')  delayedTasks   = count;
        else if (row.creation_status === 'NO_END_DATE')  noEndDateTasks = count;
        else if (row.creation_status === 'ON_TIME_CREATION') onTimeTasks = count;
      }
    } catch {}

    // ── Trend helper ─────────────────────────────────────────────────────────
    const trendPct = (cur: number, prev: number): string => {
      if (prev === 0 && cur === 0) return 'No activity yet';
      if (prev === 0) return `+${cur} this month`;
      const pct = Math.round(((cur - prev) / prev) * 100);
      return pct >= 0 ? `+${pct}% vs last month` : `${pct}% vs last month`;
    };

    const hoursNow  = Number(hoursThisMonth._sum.totalHours  || 0);
    const hoursLast = Number(hoursLastMonth._sum.totalHours  || 0);

    // ── SUPER ADMIN: hierarchy breakdown ─────────────────────────────────────
    // SA needs to see: CA-level pending, PM-level pending, TM-level pending
    // Group pendingList by the employee's role
    let hierarchyBreakdown: any = null;
    if (isSuperAdmin) {
      // All submitted timesheets (SA sees all except own)
      const allSubmitted = await this.prisma.timesheet.findMany({
        where: { status: 'SUBMITTED', employeeId: { not: user.id } },
        include: { employee: { select: { id: true, name: true, role: true, employeeId: true } } },
        orderBy: { submittedAt: 'asc' },
      });

      const caLevel  = allSubmitted.filter((t: any) => t.employee?.role === 'COMPANY_ADMIN');
      const pmLevel  = allSubmitted.filter((t: any) => t.employee?.role === 'PROJECT_MANAGER');
      const tmLevel  = allSubmitted.filter((t: any) => t.employee?.role === 'TEAM_MEMBER');

      // Weekly/monthly submission counts (all employees)
      const weekSubmitted  = await this.prisma.timesheet.count({ where: { status: { in: ['SUBMITTED','APPROVED','REJECTED'] }, weekStartDate: { gte: thisWeekStart } } });
      const monthSubmitted = await this.prisma.timesheet.count({ where: { status: { in: ['SUBMITTED','APPROVED','REJECTED'] }, createdAt: { gte: thisMonthStart } } });
      const monthApproved  = await this.prisma.timesheet.count({ where: { status: 'APPROVED', approvedAt: { gte: thisMonthStart } } });
      const monthRejected  = await this.prisma.timesheet.count({ where: { status: 'REJECTED', rejectedAt: { gte: thisMonthStart } } });
      const totalUsers     = await this.prisma.user.count({ where: { active: true, role: { not: 'SUPER_ADMIN' } } });

      hierarchyBreakdown = {
        caLevelPending:  caLevel.length,
        pmLevelPending:  pmLevel.length,
        tmLevelPending:  tmLevel.length,
        caDetails:       caLevel.map((t: any) => ({ name: t.employee?.name, week: t.weekStartDate, hours: t.totalHours, submittedAt: t.submittedAt })),
        pmDetails:       pmLevel.map((t: any) => ({ name: t.employee?.name, week: t.weekStartDate, hours: t.totalHours, submittedAt: t.submittedAt })),
        tmDetails:       tmLevel.map((t: any) => ({ name: t.employee?.name, week: t.weekStartDate, hours: t.totalHours, submittedAt: t.submittedAt })),
        weekSubmitted,
        monthSubmitted,
        monthApproved,
        monthRejected,
        totalUsers,
      };
    }

    // ── COMPANY ADMIN: hierarchy breakdown ───────────────────────────────────
    let caHierarchy: any = null;
    if (isCompanyAdmin) {
      // pendingList already contains CA's full subtree (PM + TM)
      const pmPending = pendingList.filter((t: any) => t.employee?.role === 'PROJECT_MANAGER');
      const tmPending = pendingList.filter((t: any) => t.employee?.role === 'TEAM_MEMBER');
      const monthApproved = await this.prisma.timesheet.count({
        where: { status: 'APPROVED', approvedById: user.id, approvedAt: { gte: thisMonthStart } },
      });
      caHierarchy = {
        pmLevelPending: pmPending.length,
        tmLevelPending: tmPending.length,
        pmDetails: pmPending.map((t: any) => ({ name: t.employee?.name, week: t.weekStartDate, hours: t.totalHours, submittedAt: t.submittedAt })),
        tmDetails: tmPending.map((t: any) => ({ name: t.employee?.name, week: t.weekStartDate, hours: t.totalHours, submittedAt: t.submittedAt })),
        approvedByMeThisMonth: monthApproved,
      };
    }

    // ── PROJECT MANAGER: team breakdown ──────────────────────────────────────
    let pmHierarchy: any = null;
    if (isManager) {
      const monthApproved = await this.prisma.timesheet.count({
        where: { status: 'APPROVED', approvedById: user.id, approvedAt: { gte: thisMonthStart } },
      });
      pmHierarchy = {
        directReportsPending: pendingApprovals,
        pendingDetails: pendingList.map((t: any) => ({ name: t.employee?.name, week: t.weekStartDate, hours: t.totalHours, submittedAt: t.submittedAt })),
        approvedByMeThisMonth: monthApproved,
      };
    }

    return {
      // Own timesheet stats (hidden for SA in frontend)
      timesheetsSubmitted: { count: submittedThisMonth, period: 'This month', trend: trendPct(submittedThisMonth, submittedLastMonth), up: submittedThisMonth >= submittedLastMonth },
      pendingTimesheets:   { count: pendingDraft, trend: pendingDraft === 0 ? 'All submitted' : `${pendingDraft} awaiting submission`, up: pendingDraft === 0 },
      pendingApprovals:    { count: pendingApprovals, trend: pendingApprovals === 0 ? 'All clear' : `${pendingApprovals} need review`, up: pendingApprovals === 0 },
      totalHoursLogged:    { count: Math.round(hoursNow * 10) / 10, period: 'This month', trend: trendPct(hoursNow, hoursLast), up: hoursNow >= hoursLast },
      // Project/task health
      projects: { total: totalProjects, trend: `${totalProjects} active project${totalProjects !== 1 ? 's' : ''}` },
      tasks:    { total: totalTasks, active: activeTasks, delayed: delayedTasks, noEndDate: noEndDateTasks, onTime: onTimeTasks },
      team:     { members: teamMembers },
      // Role-specific hierarchy data
      hierarchyBreakdown,
      caHierarchy,
      pmHierarchy,
    };
  }
}
