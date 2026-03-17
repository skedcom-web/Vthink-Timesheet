import { useState, useEffect } from 'react';
import {
  Clock, CheckCircle2, XCircle, AlertCircle, FileText,
  TrendingUp, Calendar, ChevronDown, ChevronUp, Loader2,
  ArrowRight,
} from 'lucide-react';
import { timesheetsApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface TimesheetEntry {
  id: string;
  taskId: string;
  projectId: string;
  monday: number; tuesday: number; wednesday: number;
  thursday: number; friday: number; saturday: number; sunday: number;
  totalHours: number;
  notes?: string;
  task?: { name: string; project?: { code: string } };
}

interface Timesheet {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  totalHours: number;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  entries?: TimesheetEntry[];
}

const STATUS_CONFIG = {
  DRAFT:     { label: 'Draft',     color: '#64748B', bg: '#F1F5F9', icon: FileText    },
  SUBMITTED: { label: 'Submitted', color: '#D97706', bg: '#FEF3C7', icon: AlertCircle },
  APPROVED:  { label: 'Approved',  color: '#059669', bg: '#D1FAE5', icon: CheckCircle2},
  REJECTED:  { label: 'Rejected',  color: '#DC2626', bg: '#FEE2E2', icon: XCircle     },
};

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function weekLabel(start: string) {
  const s = new Date(start);
  const e = new Date(start);
  e.setDate(e.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(s)} – ${fmt(e)}, ${s.getFullYear()}`;
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: any; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 bg-white border"
      style={{ borderColor: color + '22' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

export default function TeamMemberOverview({
  refreshKey,
  onNavigate,
}: {
  refreshKey?: number;
  onNavigate: (s: string) => void;
}) {
  const { user }    = useAuthStore();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    timesheetsApi.getAll()
      .then((data: Timesheet[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
        );
        setTimesheets(sorted);
      })
      .catch(() => setError('Failed to load timesheets'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const totalHours    = timesheets.reduce((s, t) => s + Number(t.totalHours), 0);
  const approvedCount = timesheets.filter(t => t.status === 'APPROVED').length;
  const pendingCount  = timesheets.filter(t => t.status === 'SUBMITTED').length;
  const draftCount    = timesheets.filter(t => t.status === 'DRAFT').length;
  const rejectedCount = timesheets.filter(t => t.status === 'REJECTED').length;

  // Last 8 weeks for mini bar chart
  const chartData = timesheets.slice(0, 8).reverse();
  const maxHours  = Math.max(...chartData.map(t => Number(t.totalHours)), 40);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      <span className="ml-2 text-gray-500 text-sm">Loading your timesheets…</span>
    </div>
  );

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-500 text-sm">{error}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-bold color-text-1">
            Welcome back, <span style={{ color: '#059669' }}>{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Your complete timesheet history and weekly hours</p>
        </div>
        {/* Quick action */}
        <button
          onClick={() => onNavigate('timesheet')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--primary),#7C3AED)', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
        >
          <Clock className="w-4 h-4" /> Enter Timesheet <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock}        label="Total Hours Logged" value={`${totalHours.toFixed(1)}h`} color="var(--primary)" bg="var(--primary-tint)" />
        <StatCard icon={CheckCircle2} label="Approved Weeks"     value={approvedCount}               color="#059669" bg="#D1FAE5" />
        <StatCard icon={AlertCircle}  label="Pending Approval"   value={pendingCount}                color="#D97706" bg="#FEF3C7" />
        <StatCard icon={FileText}     label="Drafts / Rejected"  value={draftCount + rejectedCount}  color="#64748B" bg="#F1F5F9" />
      </div>

      {/* Workflow shortcuts — only if there's something to act on */}
      {(draftCount > 0 || rejectedCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {draftCount > 0 && (
            <button onClick={() => onNavigate('timesheet')}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed text-left hover:shadow-md transition-all"
              style={{ borderColor: 'var(--primary)', background: 'var(--primary-tint)' }}>
              <Clock className="w-7 h-7 shrink-0" style={{ color: 'var(--primary)' }} />
              <div>
                <div className="text-sm font-bold" style={{ color: '#3730A3' }}>
                  {draftCount} Draft Timesheet{draftCount > 1 ? 's' : ''} — Submit Now
                </div>
                <div className="text-xs" style={{ color: 'var(--primary)' }}>Click to open and submit for approval</div>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" style={{ color: 'var(--primary)' }} />
            </button>
          )}
          {rejectedCount > 0 && (
            <button onClick={() => onNavigate('timesheet')}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed text-left hover:shadow-md transition-all"
              style={{ borderColor: '#DC2626', background: '#FEE2E2' }}>
              <XCircle className="w-7 h-7 shrink-0" style={{ color: '#DC2626' }} />
              <div>
                <div className="text-sm font-bold" style={{ color: '#991B1B' }}>
                  {rejectedCount} Rejected Timesheet{rejectedCount > 1 ? 's' : ''} — Resubmit
                </div>
                <div className="text-xs" style={{ color: '#DC2626' }}>Review rejection reason and resubmit</div>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" style={{ color: '#DC2626' }} />
            </button>
          )}
        </div>
      )}

      {/* Weekly hours bar chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl p-5 bg-white border border-gray-100 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Hours Logged — Last {chartData.length} Week{chartData.length !== 1 ? 's' : ''}
          </h2>
          <div className="flex items-end gap-2 h-24">
            {chartData.map((t) => {
              const h   = Number(t.totalHours);
              const pct = maxHours > 0 ? (h / maxHours) * 100 : 0;
              const cfg = STATUS_CONFIG[t.status];
              return (
                <div key={t.id} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                  <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: cfg.color }}>
                    {h}h
                  </span>
                  <div className="w-full rounded-t-md transition-all duration-300"
                    style={{ height: `${Math.max(pct, 4)}%`, background: cfg.color, opacity: 0.85 }} />
                  <span className="text-slate-400 whitespace-nowrap" style={{ fontSize: '9px' }}>
                    {new Date(t.weekStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <span key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.color }} />
                {cfg.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timesheet history */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-700">Timesheet History</h2>
          <span className="ml-auto text-xs text-slate-400">
            {timesheets.length} week{timesheets.length !== 1 ? 's' : ''}
          </span>
        </div>

        {timesheets.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No timesheets yet</p>
            <p className="text-xs text-slate-300 mt-1">Click <strong>Enter Timesheet</strong> to log your first week</p>
            <button onClick={() => onNavigate('timesheet')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg,var(--primary),#7C3AED)' }}>
              <Clock className="w-3.5 h-3.5" /> Enter Timesheet
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {timesheets.map((ts) => {
              const cfg        = STATUS_CONFIG[ts.status];
              const StatusIcon = cfg.icon;
              const isExpanded = expandedId === ts.id;

              return (
                <div key={ts.id}>
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ts.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left">

                    {/* Status badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </div>

                    {/* Week + subtitle */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {weekLabel(ts.weekStartDate)}
                      </p>
                      {ts.status === 'REJECTED' && ts.rejectionReason && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">
                          Reason: {ts.rejectionReason}
                        </p>
                      )}
                      {ts.status === 'APPROVED' && ts.approvedAt && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Approved {new Date(ts.approvedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      {ts.status === 'SUBMITTED' && ts.submittedAt && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Submitted {new Date(ts.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      {ts.status === 'DRAFT' && (
                        <p className="text-xs text-indigo-500 mt-0.5">Saved as draft — submit when ready</p>
                      )}
                    </div>

                    {/* Hours */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800">{Number(ts.totalHours).toFixed(1)}h</p>
                      <p className="text-xs text-slate-400">total</p>
                    </div>

                    {/* Expand chevron */}
                    {isExpanded
                      ? <ChevronUp   className="w-4 h-4 text-slate-300 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
                    }
                  </button>

                  {/* Expanded daily breakdown */}
                  {isExpanded && (
                    <div className="px-5 pb-5 bg-slate-50 border-t border-gray-100">
                      {(!ts.entries || ts.entries.length === 0) ? (
                        <p className="text-xs text-slate-400 pt-4">No entry details available.</p>
                      ) : (
                        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-gray-100">
                                <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Project</th>
                                <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Task</th>
                                {DAY_LABELS.map(d => (
                                  <th key={d} className="px-2 py-2.5 text-center text-gray-500 font-semibold">{d}</th>
                                ))}
                                <th className="px-3 py-2.5 text-center text-gray-500 font-semibold">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {ts.entries.map((entry, idx) => (
                                <tr key={entry.id ?? idx}>
                                  <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                                    {entry.task?.project?.code || '—'}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700 font-medium max-w-[160px] truncate">
                                    {entry.task?.name || entry.taskId}
                                  </td>
                                  {DAY_KEYS.map((dk, i) => {
                                    const h = Number((entry as any)[dk] ?? 0);
                                    return (
                                      <td key={i} className="px-2 py-2 text-center text-slate-600">
                                        {h > 0 ? h.toFixed(1) : <span className="text-slate-200">—</span>}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center font-bold text-slate-800">
                                    {Number(entry.totalHours).toFixed(1)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-primary-tint">
                                <td colSpan={2} className="px-3 py-2.5 text-indigo-700 font-bold text-xs">Week Total</td>
                                {DAY_KEYS.map(dk => {
                                  const dayTotal = ts.entries!.reduce((s, e) => s + Number((e as any)[dk] ?? 0), 0);
                                  return (
                                    <td key={dk} className="px-2 py-2.5 text-center font-bold text-indigo-700">
                                      {dayTotal > 0 ? dayTotal.toFixed(1) : <span className="text-indigo-200">—</span>}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2.5 text-center font-bold text-indigo-700">
                                  {Number(ts.totalHours).toFixed(1)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
