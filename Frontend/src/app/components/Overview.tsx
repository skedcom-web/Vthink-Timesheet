import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Clock, CheckCircle2, AlertCircle, Users,
  FolderOpen, ListTodo, TrendingUp, TrendingDown, ArrowRight,
  Briefcase, Activity, AlertTriangle, CalendarX, Timer,
} from 'lucide-react';
import { projectsApi, tasksApi, timesheetsApi, usersApi, dashboardApi, projectConfigApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  COMPLETED: { bg: '#EFF6FF', text: '#1D4ED8' },
  CANCELLED: { bg: '#F1F5F9', text: '#64748B' },
};

// ── Creation Status metadata ──────────────────────────────────────────────────
const CS_META = {
  ON_TIME_CREATION: { label: 'On Time',      bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  DELAYED_CREATION: { label: 'Delayed',      bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  NO_END_DATE:      { label: 'No End Date',  bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', dot: '#F59E0B' },
} as const;

type CSKey = keyof typeof CS_META;

// ── Per-project deviation row ─────────────────────────────────────────────────
function ProjectDeviationRow({ proj, tasks }: { proj: any; tasks: any[] }) {
  const projTasks  = tasks.filter(t => t.projectId === proj.id || t.project?.id === proj.id);
  const delayed    = projTasks.filter(t => t.creationStatus === 'DELAYED_CREATION');
  const noEndDate  = projTasks.filter(t => t.creationStatus === 'NO_END_DATE');
  const onTime     = projTasks.filter(t => t.creationStatus === 'ON_TIME_CREATION');
  const total      = projTasks.length;

  if (total === 0) return null;

  const deviationCount = delayed.length + noEndDate.length;

  return (
    <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
      {/* Project header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
            style={{ background: '#EEF2FF', color: '#6366F1' }}>
            {proj.code}
          </span>
          <span className="text-sm font-semibold text-slate-800">{proj.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {deviationCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#FEF2F2', color: '#991B1B' }}>
              <AlertTriangle className="w-3 h-3" />
              {deviationCount} deviation{deviationCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-slate-400">{total} task{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Counts row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { key: 'ON_TIME_CREATION', count: onTime.length,    Icon: CheckCircle2 },
          { key: 'DELAYED_CREATION', count: delayed.length,   Icon: AlertTriangle },
          { key: 'NO_END_DATE',      count: noEndDate.length, Icon: CalendarX },
        ].map(({ key, count, Icon }) => {
          const m = CS_META[key as CSKey];
          return (
            <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold"
              style={{ background: m.bg, borderColor: m.border, color: m.text }}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <div>
                <div className="text-base font-bold leading-none">{count}</div>
                <div className="font-normal opacity-80 mt-0.5">{m.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Segmented bar */}
      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          {onTime.length   > 0 && <div className="rounded-full transition-all" style={{ flex: onTime.length,   background: '#10B981' }} />}
          {delayed.length  > 0 && <div className="rounded-full transition-all" style={{ flex: delayed.length,  background: '#EF4444' }} />}
          {noEndDate.length > 0 && <div className="rounded-full transition-all" style={{ flex: noEndDate.length, background: '#F59E0B' }} />}
        </div>
      )}

      {/* Deviation task names */}
      {(delayed.length > 0 || noEndDate.length > 0) && (
        <div className="mt-2.5 space-y-1.5">
          {delayed.slice(0, 3).map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: '#EF4444' }} />
              <span className="text-slate-700 font-medium truncate">{t.name}</span>
              <span className="text-slate-400 shrink-0">
                {t.endDate ? `ended ${fmt(t.endDate)}` : ''}
              </span>
            </div>
          ))}
          {noEndDate.slice(0, 3).map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <CalendarX className="w-3 h-3 shrink-0" style={{ color: '#F59E0B' }} />
              <span className="text-slate-700 font-medium truncate">{t.name}</span>
              <span className="text-slate-400 shrink-0">no end date</span>
            </div>
          ))}
          {(delayed.length + noEndDate.length) > 6 && (
            <div className="text-xs text-slate-400 pl-5">
              +{(delayed.length + noEndDate.length) - 6} more deviations
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Overview({ onNavigate, refreshKey = 0 }: { onNavigate: (s: string) => void; refreshKey?: number }) {
  const { user } = useAuthStore();
  const [stats,       setStats]       = useState<any>(null);
  const [projects,    setProjects]    = useState<any[]>([]);
  const [tasks,       setTasks]       = useState<any[]>([]);
  const [timesheets,  setTimesheets]  = useState<any[]>([]);
  const [employees,   setEmployees]   = useState<any[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user?.role || '');

  useEffect(() => {
    Promise.allSettled([
      dashboardApi.getStats(),
      projectConfigApi.getAll(),   // uploaded projects (returns projects.id)
      projectsApi.getAll(),        // legacy projects table
      tasksApi.getAll(),
      timesheetsApi.getAll(),
      isAdmin ? usersApi.getAll() : Promise.resolve([]),
    ]).then(([s, pc, p, t, ts, u]) => {
      if (s.status  === 'fulfilled') setStats(s.value);
      // Merge config + legacy projects, deduplicate by id
      const configProjects = pc.status === 'fulfilled' ? (pc.value || []) : [];
      const legacyProjects = p.status  === 'fulfilled' ? (p.value  || []) : [];
      const seen = new Set<string>();
      const merged: any[] = [];
      [...configProjects, ...legacyProjects].forEach(proj => {
        if (!seen.has(proj.id)) { seen.add(proj.id); merged.push(proj); }
      });
      setProjects(merged);
      if (t.status  === 'fulfilled') setTasks(t.value     || []);
      if (ts.status === 'fulfilled') setTimesheets(ts.value || []);
      if (u.status  === 'fulfilled') setEmployees(u.value  || []);
    }).finally(() => setInitialLoad(false));
  }, [isAdmin, refreshKey]);  // refreshKey increments on any mutation — forces fresh fetch

  // ── Computed values ──────────────────────────────────────────────────────────
  const pendingTimesheets  = timesheets.filter(t => t.status === 'SUBMITTED');
  const recentTimesheets   = [...timesheets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const delayedTasks  = tasks.filter(t => t.creationStatus === 'DELAYED_CREATION');
  const noEndDateTasks = tasks.filter(t => t.creationStatus === 'NO_END_DATE');
  const onTimeTasks   = tasks.filter(t => t.creationStatus === 'ON_TIME_CREATION');

  // Projects that have at least one deviation
  const projectsWithDeviations = projects.filter(proj => {
    const pt = tasks.filter(t => t.projectId === proj.id || t.project?.id === proj.id);
    return pt.some(t => t.creationStatus === 'DELAYED_CREATION' || t.creationStatus === 'NO_END_DATE');
  });

  const tasksByStatus = [
    { status: 'ACTIVE',    label: 'Active'    },
    { status: 'ON_HOLD',   label: 'On Hold'   },
    { status: 'COMPLETED', label: 'Completed' },
    { status: 'CANCELLED', label: 'Cancelled' },
  ].map(s => ({ ...s, count: tasks.filter(t => t.status === s.status).length }));

  const statCards = [
    {
      label: 'Active Projects',   value: projects.length,
      icon: Briefcase,    color: '#6366F1', bg: '#EEF2FF',
      trend: `${tasks.length} task${tasks.length !== 1 ? 's' : ''} total`, up: true,
    },
    {
      label: 'Total Tasks',       value: tasks.length,
      icon: ListTodo,     color: '#8B5CF6', bg: '#F5F3FF',
      trend: `${tasks.filter(t => t.status === 'ACTIVE').length} active`, up: true,
    },
    {
      label: 'Delayed Creations', value: delayedTasks.length,
      icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2',
      trend: delayedTasks.length > 0 ? 'Needs attention' : 'All on time',
      up: delayedTasks.length === 0,
    },
    {
      label: 'No End Date',       value: noEndDateTasks.length,
      icon: CalendarX,    color: '#F59E0B', bg: '#FFFBEB',
      trend: noEndDateTasks.length > 0 ? 'Action required' : 'All dated',
      up: noEndDateTasks.length === 0,
    },
  ];

  if (initialLoad) {
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

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Timesheets</span><span>›</span>
            <span className="text-slate-600 font-medium">Overview</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>
            Overview
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Projects, tasks, creation health and timesheet workflow
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: '#ECFDF5', color: '#059669' }}>
          <Activity className="w-3 h-3" /> Live
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label}
              className="bg-white rounded-xl p-5 border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: card.bg }}>
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <div className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: card.up ? '#059669' : '#EF4444' }}>
                  {card.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {card.trend}
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>
                {card.value}
              </div>
              <div className="text-sm text-slate-500 mt-1">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Main Grid ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: 2/3 width */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Creation Health per Project ──────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900">Task Creation Health</h3>
                <span className="text-xs text-slate-400">— per project</span>
              </div>
              {/* Legend */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                {(['ON_TIME_CREATION', 'DELAYED_CREATION', 'NO_END_DATE'] as CSKey[]).map(k => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: CS_META[k].dot }} />
                    {CS_META[k].label}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary bar across all projects */}
            {tasks.length > 0 && (
              <div className="px-5 py-3 border-b border-slate-50 bg-slate-50">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="font-medium">All Projects</span>
                  <span>{tasks.length} tasks total</span>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                  {onTimeTasks.length   > 0 && <div style={{ flex: onTimeTasks.length,    background: '#10B981' }} className="rounded-full" />}
                  {delayedTasks.length  > 0 && <div style={{ flex: delayedTasks.length,   background: '#EF4444' }} className="rounded-full" />}
                  {noEndDateTasks.length > 0 && <div style={{ flex: noEndDateTasks.length, background: '#F59E0B' }} className="rounded-full" />}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs">
                  <span style={{ color: '#10B981' }}>{onTimeTasks.length} on time</span>
                  <span style={{ color: '#EF4444' }}>{delayedTasks.length} delayed</span>
                  <span style={{ color: '#F59E0B' }}>{noEndDateTasks.length} no end date</span>
                </div>
              </div>
            )}

            {projects.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No projects yet</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {projects.map(proj => (
                  <ProjectDeviationRow key={proj.id} proj={proj} tasks={tasks} />
                ))}
              </div>
            )}
          </div>

          {/* ── Task Status Breakdown ────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListTodo className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-900">Task Status Breakdown</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {tasksByStatus.map(({ status, label, count }) => {
                const col = TASK_STATUS_COLORS[status] || { bg: '#F1F5F9', text: '#64748B' };
                const pct = tasks.length ? Math.round((count / tasks.length) * 100) : 0;
                return (
                  <div key={status} className="rounded-xl p-4" style={{ background: col.bg }}>
                    <div className="text-2xl font-bold mb-1" style={{ color: col.text }}>{count}</div>
                    <div className="text-xs font-medium" style={{ color: col.text }}>{label}</div>
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

        {/* RIGHT: 1/3 width */}
        <div className="space-y-5">

          {/* ── Action Required — No End Date ─────────────────────────────────── */}
          {noEndDateTasks.length > 0 && (
            <div className="bg-white rounded-xl border-2 overflow-hidden"
              style={{ borderColor: '#FDE68A' }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b"
                style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
                <CalendarX className="w-4 h-4" style={{ color: '#B45309' }} />
                <h3 className="text-sm font-semibold" style={{ color: '#92400E' }}>
                  Action Required — No End Date
                </h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#F59E0B', color: '#FFF' }}>
                  {noEndDateTasks.length}
                </span>
              </div>
              <div className="divide-y divide-amber-50">
                {noEndDateTasks.slice(0, 8).map((t: any) => (
                  <div key={t.id} className="px-5 py-3 hover:bg-amber-50 transition-colors">
                    <div className="text-xs font-semibold text-slate-800 truncate">{t.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: '#EEF2FF', color: '#6366F1', fontSize: '10px' }}>
                        {t.project?.code || '—'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {t.startDate ? `Started ${fmt(t.startDate)}` : 'No start date either'}
                      </span>
                    </div>
                  </div>
                ))}
                {noEndDateTasks.length > 8 && (
                  <div className="px-5 py-2 text-xs text-amber-600 font-medium">
                    +{noEndDateTasks.length - 8} more tasks without end date
                  </div>
                )}
              </div>
              <div className="px-5 py-3 border-t" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
                <button onClick={() => onNavigate('tasks')}
                  className="text-xs font-semibold flex items-center gap-1 transition-colors hover:opacity-80"
                  style={{ color: '#B45309' }}>
                  Go to Tasks to update <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* ── Delayed Creations callout ─────────────────────────────────────── */}
          {delayedTasks.length > 0 && (
            <div className="bg-white rounded-xl border-2 overflow-hidden"
              style={{ borderColor: '#FECACA' }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b"
                style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: '#DC2626' }} />
                <h3 className="text-sm font-semibold" style={{ color: '#991B1B' }}>
                  Delayed Creations
                </h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#EF4444', color: '#FFF' }}>
                  {delayedTasks.length}
                </span>
              </div>
              <div className="divide-y divide-red-50">
                {delayedTasks.slice(0, 6).map((t: any) => (
                  <div key={t.id} className="px-5 py-3 hover:bg-red-50 transition-colors">
                    <div className="text-xs font-semibold text-slate-800 truncate">{t.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: '#EEF2FF', color: '#6366F1', fontSize: '10px' }}>
                        {t.project?.code || '—'}
                      </span>
                      <span className="text-xs" style={{ color: '#EF4444' }}>
                        {t.endDate ? `ended ${fmt(t.endDate)}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
                {delayedTasks.length > 6 && (
                  <div className="px-5 py-2 text-xs text-red-500 font-medium">
                    +{delayedTasks.length - 6} more delayed tasks
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Workflow Status ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> Workflow Status
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Enter Timesheet',     screen: 'timesheet', icon: Clock,         color: '#6366F1', desc: 'Log weekly hours',       count: timesheets.filter(t => t.status === 'DRAFT').length },
                { label: 'Submit for Approval', screen: 'timesheet', icon: ArrowRight,    color: '#8B5CF6', desc: 'Submit completed sheets', count: timesheets.filter(t => t.status === 'SUBMITTED').length },
                { label: 'Approve Timesheets',  screen: 'approve',   icon: CheckCircle2,  color: '#10B981', desc: 'Review & approve',        count: pendingTimesheets.length },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <button key={i} onClick={() => onNavigate(step.screen)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border hover:shadow-sm transition-all text-left"
                    style={{ borderColor: '#F1F5F9' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = step.color + '40')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#F1F5F9')}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: step.color + '15' }}>
                      <Icon className="w-4 h-4" style={{ color: step.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800">{step.label}</div>
                      <div className="text-xs text-slate-400">{step.desc}</div>
                    </div>
                    {step.count > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: step.color + '15', color: step.color }}>
                        {step.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Recent Timesheets ─────────────────────────────────────────────── */}
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
              ) : recentTimesheets.map(ts => {
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
              })}
            </div>
          </div>

          {/* ── Pending Approvals callout ─────────────────────────────────────── */}
          {pendingTimesheets.length > 0 && isAdmin && (
            <button onClick={() => onNavigate('approve')}
              className="w-full text-left p-4 rounded-xl border-2 border-dashed transition-all hover:shadow-md"
              style={{ borderColor: '#8B5CF6', background: '#F5F3FF' }}>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 shrink-0" style={{ color: '#8B5CF6' }} />
                <div>
                  <div className="text-sm font-bold" style={{ color: '#6B21A8' }}>
                    {pendingTimesheets.length} Timesheet{pendingTimesheets.length > 1 ? 's' : ''} Pending
                  </div>
                  <div className="text-xs" style={{ color: '#7E22CE' }}>Click to review and approve</div>
                </div>
              </div>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
