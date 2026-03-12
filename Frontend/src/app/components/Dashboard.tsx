import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, BarChart3, TrendingUp, FileText, Plus, Eye } from 'lucide-react';
import { dashboardApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface Stats {
  timesheetsSubmitted: { count: number; period: string; trend: string };
  pendingTimesheets:   { count: number; trend: string };
  pendingApprovals:    { count: number; trend: string };
  totalHoursLogged:    { count: number; period: string; trend: string };
}

const ROLE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  SUPER_ADMIN:     { color: '#7C3AED', bg: '#EDE9FE', label: 'Super Admin' },
  COMPANY_ADMIN:   { color: '#2563EB', bg: '#DBEAFE', label: 'Company Admin' },
  PROJECT_MANAGER: { color: '#DB2777', bg: '#FCE7F3', label: 'Project Manager' },
  TEAM_MEMBER:     { color: '#059669', bg: '#D1FAE5', label: 'Team Member' },
};

export default function Dashboard({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const { user } = useAuthStore();
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getStats()
      .then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const roleInfo = ROLE_COLORS[user?.role || ''] || ROLE_COLORS.TEAM_MEMBER;

  const statCards = stats ? [
    { label: 'Timesheets Submitted', value: stats.timesheetsSubmitted.count, sub: stats.timesheetsSubmitted.period, trend: stats.timesheetsSubmitted.trend, icon: FileText, color: '#6366F1', bg: '#EEF2FF' },
    { label: 'Pending Timesheets',   value: stats.pendingTimesheets.count,   sub: 'Awaiting submission',           trend: stats.pendingTimesheets.trend,   icon: Clock,     color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Pending Approvals',    value: stats.pendingApprovals.count,    sub: 'Needs your review',             trend: stats.pendingApprovals.trend,    icon: AlertCircle, color: '#EF4444', bg: '#FEF2F2' },
    { label: 'Total Hours Logged',   value: stats.totalHoursLogged.count,    sub: stats.totalHoursLogged.period,   trend: stats.totalHoursLogged.trend,    icon: BarChart3,  color: '#10B981', bg: '#ECFDF5' },
  ] : [];

  const quickActions = [
    { label: 'Overview',           icon: Eye,          screen: 'overview',  desc: 'Projects & task status' },
    { label: 'Enter Timesheet',    icon: Clock,        screen: 'timesheet', desc: 'Log your weekly hours' },
    { label: 'Add Task',           icon: Plus,         screen: 'tasks',     desc: 'Create a new task' },
    { label: 'View Reports',       icon: BarChart3,    screen: 'reports',   desc: 'Analyze timesheet data' },
    ...(user?.role !== 'TEAM_MEMBER'
      ? [{ label: 'Approve Timesheets', icon: CheckCircle2, screen: 'approve', desc: 'Review pending submissions' }]
      : []),
  ];

  return (
    <div className="p-6 space-y-6" style={{ background: '#F8FAFC', minHeight: '100%' }}>
      {/* Header */}
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
          <p className="text-slate-500 text-sm mt-1">Here's what's happening across all companies and projects.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-xl p-5 animate-pulse h-36" />
            ))
          : statCards.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label}
                  className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                      <Icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                    <span className="text-xs flex items-center gap-1 font-medium" style={{ color: '#10B981' }}>
                      <TrendingUp className="w-3 h-3" />{card.trend}
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1" style={{ letterSpacing: '-0.02em' }}>{card.value}</div>
                  <div className="text-xs font-medium text-slate-600">{card.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{card.sub}</div>
                </div>
              );
            })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <button key={action.screen} onClick={() => onNavigate(action.screen)}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all group text-center"
                style={{ borderColor: '#F1F5F9' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#C7D2FE'; e.currentTarget.style.background = '#EEF2FF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#F1F5F9'; e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{ background: '#EEF2FF' }}>
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

      {/* Info banner */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#6366F1' }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: '#3730A3' }}>Connected to PostgreSQL via Docker</div>
          <div className="text-xs mt-0.5" style={{ color: '#6366F1' }}>
            All timesheet data is persisted. Projects, employees and tasks can be linked from external systems via the API.
          </div>
        </div>
      </div>
    </div>
  );
}
