import { useEffect, useState } from 'react';
import {
  Clock, CheckCircle2, AlertCircle, BarChart3, TrendingUp, TrendingDown,
  FileText, Plus, Eye, Users, Briefcase, ListTodo, AlertTriangle, CalendarX,
  Timer, ArrowRight,
} from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const ROLE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  SUPER_ADMIN:     { color: '#7C3AED', bg: '#EDE9FE', label: 'Super Admin'     },
  COMPANY_ADMIN:   { color: '#2563EB', bg: '#DBEAFE', label: 'Company Admin'   },
  PROJECT_MANAGER: { color: '#DB2777', bg: '#FCE7F3', label: 'Project Manager' },
  TEAM_MEMBER:     { color: '#059669', bg: '#D1FAE5', label: 'Team Member'     },
};

function StatCard({
  label, value, sub, trend, up, Icon, color, bg,
}: {
  label: string; value: number | string; sub: string;
  trend: string; up: boolean; Icon: any; color: string; bg: string;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-xs flex items-center gap-1 font-medium"
          style={{ color: up ? '#059669' : '#EF4444' }}>
          {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </span>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1" style={{ letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sub}</div>
    </div>
  );
}

export default function Dashboard({ onNavigate, refreshKey = 0 }: { onNavigate: (screen: string) => void; refreshKey?: number }) {
  const { user }    = useAuthStore();
  const [stats,      setStats]   = useState<any>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    dashboardApi.getStats()
      .then(s => { setStats(s); setInitialLoad(false); })
      .catch(() => { setInitialLoad(false); });
  }, [refreshKey]);

  const roleInfo = ROLE_COLORS[user?.role || ''] || ROLE_COLORS.TEAM_MEMBER;
  const isAdmin  = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user?.role || '');

  // ── Stat cards driven entirely from real backend data ──────────────────────
  const statCards = stats ? [
    {
      label: 'Timesheets Submitted',
      value: stats.timesheetsSubmitted.count,
      sub:   stats.timesheetsSubmitted.period,
      trend: stats.timesheetsSubmitted.trend,
      up:    stats.timesheetsSubmitted.up,
      Icon:  FileText, color: '#6366F1', bg: '#EEF2FF',
    },
    {
      label: 'Pending Submission',
      value: stats.pendingTimesheets.count,
      sub:   'Draft timesheets',
      trend: stats.pendingTimesheets.trend,
      up:    stats.pendingTimesheets.up,
      Icon:  Clock, color: '#F59E0B', bg: '#FFFBEB',
    },
    {
      label: 'Pending Approvals',
      value: stats.pendingApprovals.count,
      sub:   'Awaiting review',
      trend: stats.pendingApprovals.trend,
      up:    stats.pendingApprovals.up,
      Icon:  AlertCircle, color: '#EF4444', bg: '#FEF2F2',
    },
    {
      label: 'Hours Logged',
      value: stats.totalHoursLogged.count,
      sub:   stats.totalHoursLogged.period,
      trend: stats.totalHoursLogged.trend,
      up:    stats.totalHoursLogged.up,
      Icon:  BarChart3, color: '#10B981', bg: '#ECFDF5',
    },
  ] : [];

  // ── Project & task health cards (admin only) ───────────────────────────────
  const healthCards = stats ? [
    {
      label: 'Active Projects',
      value: stats.projects?.total ?? 0,
      sub:   'In the system',
      trend: stats.projects?.trend ?? '—',
      up:    true,
      Icon:  Briefcase, color: '#6366F1', bg: '#EEF2FF',
    },
    {
      label: 'Total Tasks',
      value: stats.tasks?.total ?? 0,
      sub:   `${stats.tasks?.active ?? 0} active`,
      trend: `${stats.tasks?.onTime ?? 0} on-time creations`,
      up:    true,
      Icon:  ListTodo, color: '#8B5CF6', bg: '#F5F3FF',
    },
    {
      label: 'Delayed Creations',
      value: stats.tasks?.delayed ?? 0,
      sub:   'Past end-date at creation',
      trend: stats.tasks?.delayed === 0 ? 'All on time' : 'Needs attention',
      up:    stats.tasks?.delayed === 0,
      Icon:  AlertTriangle, color: '#EF4444', bg: '#FEF2F2',
    },
    {
      label: 'No End Date',
      value: stats.tasks?.noEndDate ?? 0,
      sub:   'Tasks without deadline',
      trend: stats.tasks?.noEndDate === 0 ? 'All dated' : 'Action required',
      up:    stats.tasks?.noEndDate === 0,
      Icon:  CalendarX, color: '#F59E0B', bg: '#FFFBEB',
    },
  ] : [];

  const quickActions = [
    { label: 'Overview',            icon: Eye,         screen: 'overview',  desc: 'Projects & task status'    },
    { label: 'Enter Timesheet',     icon: Clock,       screen: 'timesheet', desc: 'Log your weekly hours'     },
    { label: 'Add Task',            icon: Plus,        screen: 'tasks',     desc: 'Create a new task'         },
    { label: 'View Reports',        icon: BarChart3,   screen: 'reports',   desc: 'Analyse timesheet data'    },
    ...(user?.role !== 'TEAM_MEMBER'
      ? [{ label: 'Approve Timesheets', icon: CheckCircle2, screen: 'approve', desc: 'Review pending submissions' }]
      : []),
  ];

  return (
    <div className="p-6 space-y-6" style={{ background: '#F8FAFC', minHeight: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs mb-2" style={{ color: '#94A3B8' }}>
            <span>🏠</span><span>›</span><span>Platform</span><span>›</span>
            <span style={{ color: '#475569', fontWeight: 600 }}>Dashboard</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: roleInfo.bg, color: roleInfo.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: roleInfo.color }} />
              {roleInfo.label}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Real-time view of your timesheet activity and task health.
          </p>
        </div>
      </div>

      {/* ── Timesheet Stat Cards ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Timesheet Activity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {initialLoad
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-xl p-5 animate-pulse h-36" />
              ))
            : statCards.map(card => <StatCard key={card.label} {...card} />)
          }
        </div>
      </div>

      {/* ── Project & Task Health Cards (admin) ────────────────────────────── */}
      {isAdmin && (
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Project & Task Health
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {initialLoad
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-xl p-5 animate-pulse h-36" />
                ))
              : healthCards.map(card => <StatCard key={card.label} {...card} />)
            }
          </div>
        </div>
      )}

      {/* ── Deviation alert banners (admin) ─────────────────────────────────── */}
      {isAdmin && stats && (stats.tasks?.delayed > 0 || stats.tasks?.noEndDate > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.tasks?.delayed > 0 && (
            <button onClick={() => onNavigate('overview')}
              className="text-left p-4 rounded-xl border-2 border-dashed flex items-center gap-3 hover:shadow-md transition-all"
              style={{ borderColor: '#FECACA', background: '#FEF2F2' }}>
              <AlertTriangle className="w-8 h-8 shrink-0" style={{ color: '#EF4444' }} />
              <div className="flex-1">
                <div className="text-sm font-bold" style={{ color: '#991B1B' }}>
                  {stats.tasks.delayed} Delayed Creation{stats.tasks.delayed > 1 ? 's' : ''}
                </div>
                <div className="text-xs" style={{ color: '#DC2626' }}>
                  Tasks created after their end date — view in Overview
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" style={{ color: '#EF4444' }} />
            </button>
          )}
          {stats.tasks?.noEndDate > 0 && (
            <button onClick={() => onNavigate('overview')}
              className="text-left p-4 rounded-xl border-2 border-dashed flex items-center gap-3 hover:shadow-md transition-all"
              style={{ borderColor: '#FDE68A', background: '#FFFBEB' }}>
              <CalendarX className="w-8 h-8 shrink-0" style={{ color: '#F59E0B' }} />
              <div className="flex-1">
                <div className="text-sm font-bold" style={{ color: '#92400E' }}>
                  {stats.tasks.noEndDate} Task{stats.tasks.noEndDate > 1 ? 's' : ''} Without End Date
                </div>
                <div className="text-xs" style={{ color: '#B45309' }}>
                  No deadline set — view in Overview for details
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />
            </button>
          )}
        </div>
      )}

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {quickActions.map(action => {
            const Icon = action.icon;
            // Highlight pending approvals button
            const hasBadge = action.screen === 'approve' && stats?.pendingApprovals?.count > 0;
            return (
              <button key={action.screen} onClick={() => onNavigate(action.screen)}
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all text-center"
                style={{ borderColor: '#F1F5F9' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#C7D2FE'; e.currentTarget.style.background = '#EEF2FF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#F1F5F9'; e.currentTarget.style.background = 'transparent'; }}
              >
                {hasBadge && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                    style={{ background: '#EF4444' }}>
                    {stats.pendingApprovals.count}
                  </span>
                )}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#EEF2FF' }}>
                  <Icon className="w-5 h-5" style={{ color: '#6366F1' }} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-700">{action.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{action.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Team Members (admin) ────────────────────────────────────────────── */}
      {isAdmin && stats && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#ECFEFF' }}>
            <Users className="w-6 h-6" style={{ color: '#06B6D4' }} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{stats.team?.members ?? 0}</div>
            <div className="text-sm text-slate-500">Active Team Members</div>
          </div>
          <div className="ml-auto">
            <button onClick={() => onNavigate('assign')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#EEF2FF', color: '#6366F1' }}>
              Assign Tasks <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Info Banner ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: '#3730A3' }}>
            Connected to PostgreSQL via Docker
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#6366F1' }}>
            All data is live — counts above reflect exactly what is in the database right now.
          </div>
        </div>
      </div>

    </div>
  );
}
