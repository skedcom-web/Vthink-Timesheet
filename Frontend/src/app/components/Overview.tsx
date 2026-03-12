import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Clock, CheckCircle2, AlertCircle, Users,
  FolderOpen, ListTodo, TrendingUp, TrendingDown, ArrowRight,
  Briefcase, Activity
} from 'lucide-react';
import { projectsApi, tasksApi, timesheetsApi, usersApi, dashboardApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' },
  SUBMITTED: { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
  APPROVED:  { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  REJECTED:  { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

const TASK_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE:    { bg: '#ECFDF5', text: '#065F46' },
  ON_HOLD:   { bg: '#FFFBEB', text: '#B45309' },
  COMPLETED:   { bg: '#ECFDF5', text: '#065F46' },
  ON_HOLD:     { bg: '#FFFBEB', text: '#B45309' },
};

export default function Overview({ onNavigate }: { onNavigate: (s: string) => void }) {
  const { user } = useAuthStore();
  const [stats, setStats]             = useState<any>(null);
  const [projects, setProjects]       = useState<any[]>([]);
  const [tasks, setTasks]             = useState<any[]>([]);
  const [timesheets, setTimesheets]   = useState<any[]>([]);
  const [employees, setEmployees]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user?.role || '');

  useEffect(() => {
    Promise.allSettled([
      dashboardApi.getStats(),
      projectsApi.getAll(),
      tasksApi.getAll(),
      timesheetsApi.getAll(),
      isAdmin ? usersApi.getAll() : Promise.resolve([]),
    ]).then(([s, p, t, ts, u]) => {
      if (s.status === 'fulfilled') setStats(s.value);
      if (p.status === 'fulfilled') setProjects(p.value || []);
      if (t.status === 'fulfilled') setTasks(t.value || []);
      if (ts.status === 'fulfilled') setTimesheets(ts.value || []);
      if (u.status === 'fulfilled') setEmployees(u.value || []);
    }).finally(() => setLoading(false));
  }, [isAdmin]);

  // Computed
  const pendingTimesheets = timesheets.filter(t => t.status === 'SUBMITTED');
  const recentTimesheets  = [...timesheets].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const inProgressTasks   = tasks.filter(t => t.status === 'ON_HOLD').slice(0, 6);
  const tasksByStatus = ['ACTIVE','ON_HOLD','COMPLETED','ON_HOLD'].map(s => ({
    status: s, count: tasks.filter(t => t.status === s).length,
  }));

  const statCards = [
    {
      label: 'Active Projects', value: projects.length,
      icon: Briefcase, color: '#6366F1', bg: '#EEF2FF',
      trend: '+2 this month', up: true,
    },
    {
      label: 'Total Tasks', value: tasks.length,
      icon: ListTodo, color: '#8B5CF6', bg: '#F5F3FF',
      trend: `${inProgressTasks.length} in progress`, up: true,
    },
    {
      label: isAdmin ? 'Team Members' : 'My Timesheets',
      value: isAdmin ? employees.filter(e => e.role === 'TEAM_MEMBER').length : timesheets.length,
      icon: Users, color: '#06B6D4', bg: '#ECFEFF',
      trend: isAdmin ? 'Active employees' : 'Total submitted',
      up: true,
    },
    {
      label: 'Pending Approvals', value: pendingTimesheets.length,
      icon: AlertCircle, color: '#F59E0B', bg: '#FFFBEB',
      trend: pendingTimesheets.length > 0 ? 'Needs attention' : 'All clear',
      up: pendingTimesheets.length === 0,
    },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#F8FAFC', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Timesheets</span>
            <span>›</span>
            <span className="text-slate-600 font-medium">Overview</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>
            Overview
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Complete picture of projects, tasks and timesheet workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#ECFDF5', color: '#059669' }}>
            <Activity className="w-3 h-3" /> Live
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl p-5 border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <div className="flex items-center gap-1 text-xs font-medium" style={{ color: card.up ? '#059669' : '#F59E0B' }}>
                  {card.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {card.trend}
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>{card.value}</div>
              <div className="text-sm text-slate-500 mt-1">{card.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Projects + Tasks */}
        <div className="lg:col-span-2 space-y-5">

          {/* Projects with task breakdown */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900">Projects & Tasks</h3>
              </div>
              <button onClick={() => onNavigate('tasks')}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                Add Task <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No active projects</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {projects.map(proj => {
                  const projTasks = tasks.filter(t => t.projectId === proj.id || t.project?.id === proj.id);
                  const done = projTasks.filter(t => t.status === 'COMPLETED').length;
                  const pct = projTasks.length ? Math.round((done / projTasks.length) * 100) : 0;
                  return (
                    <div key={proj.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                              {proj.code}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">{proj.name}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{projTasks.length} tasks · {done} completed</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-slate-900">{pct}%</div>
                          <div className="text-xs text-slate-400">complete</div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' }} />
                      </div>
                      {/* Task pills */}
                      {projTasks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {projTasks.slice(0, 4).map(t => (
                            <span key={t.id} className="text-xs px-2 py-0.5 rounded-md font-medium"
                              style={{ background: TASK_STATUS_COLORS[t.status]?.bg, color: TASK_STATUS_COLORS[t.status]?.text }}>
                              {t.name}
                            </span>
                          ))}
                          {projTasks.length > 4 && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                              +{projTasks.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Task Status Breakdown */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListTodo className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-900">Task Status Breakdown</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {tasksByStatus.map(({ status, count }) => {
                const col = TASK_STATUS_COLORS[status] || { bg: '#F1F5F9', text: '#64748B' };
                const label = status.replace('_', ' ');
                const pct = tasks.length ? Math.round((count / tasks.length) * 100) : 0;
                return (
                  <div key={status} className="rounded-xl p-4" style={{ background: col.bg }}>
                    <div className="text-2xl font-bold mb-1" style={{ color: col.text }}>{count}</div>
                    <div className="text-xs font-medium capitalize" style={{ color: col.text }}>{label}</div>
                    <div className="mt-2 h-1 rounded-full bg-white/60">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col.text }} />
                    </div>
                    <div className="text-xs mt-1" style={{ color: col.text, opacity: 0.7 }}>{pct}% of total</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Workflow Status */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> Workflow Status
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Enter Timesheet', screen: 'timesheet', icon: Clock, color: '#6366F1', desc: 'Log weekly hours', count: timesheets.filter(t=>t.status==='DRAFT').length, countLabel: 'draft' },
                { label: 'Submit for Approval', screen: 'timesheet', icon: ArrowRight, color: '#8B5CF6', desc: 'Submit completed sheets', count: timesheets.filter(t=>t.status==='SUBMITTED').length, countLabel: 'submitted' },
                { label: 'Approve Timesheets', screen: 'approve', icon: CheckCircle2, color: '#10B981', desc: 'Review & approve', count: pendingTimesheets.length, countLabel: 'pending' },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <button key={i} onClick={() => onNavigate(step.screen)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border hover:shadow-sm transition-all text-left group"
                    style={{ borderColor: '#F1F5F9' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = step.color + '40')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#F1F5F9')}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: step.color + '15' }}>
                      <Icon className="w-4 h-4" style={{ color: step.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800">{step.label}</div>
                      <div className="text-xs text-slate-400">{step.desc}</div>
                    </div>
                    {step.count > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: step.color + '15', color: step.color }}>
                        {step.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Timesheets */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" /> Recent Timesheets
              </h3>
              <button onClick={() => onNavigate('approve')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {recentTimesheets.length === 0 ? (
                <div className="p-5 text-center text-slate-400 text-xs">No timesheets yet</div>
              ) : (
                recentTimesheets.map(ts => {
                  const sc = STATUS_COLORS[ts.status] || STATUS_COLORS.DRAFT;
                  return (
                    <div key={ts.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-800">{ts.employee?.name || '—'}</div>
                          <div className="text-xs text-slate-400">{fmt(ts.weekStartDate)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-900">{Number(ts.totalHours).toFixed(0)}h</div>
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                            <span className="text-xs" style={{ color: sc.text }}>{ts.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending approvals callout */}
          {pendingTimesheets.length > 0 && isAdmin && (
            <button
              onClick={() => onNavigate('approve')}
              className="w-full text-left p-4 rounded-xl border-2 border-dashed transition-all hover:shadow-md"
              style={{ borderColor: '#F59E0B', background: '#FFFBEB' }}
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 shrink-0" style={{ color: '#F59E0B' }} />
                <div>
                  <div className="text-sm font-bold" style={{ color: '#92400E' }}>
                    {pendingTimesheets.length} Timesheet{pendingTimesheets.length > 1 ? 's' : ''} Pending
                  </div>
                  <div className="text-xs" style={{ color: '#B45309' }}>Click to review and approve</div>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
