import { useState, useEffect } from 'react';
import {
  Clock, CheckCircle2, XCircle, AlertCircle, FileText,
  TrendingUp, Calendar, ChevronDown, ChevronUp, Loader2,
  ArrowRight, RotateCcw, Trash2,
} from 'lucide-react';
import { timesheetsApi } from '../../services/api';
import { toast } from './ui/Toast';
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
        <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
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
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [actionId,      setActionId]      = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

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

  const recall = async (ts: any) => {
    setActionId(ts.id);
    try {
      await timesheetsApi.recall(ts.id);
      toast.success('Timesheet recalled — it is now a Draft');
      setTimesheets(prev => prev.map(t =>
        t.id === ts.id ? { ...t, status: 'DRAFT', submittedAt: undefined } : t
      ));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error?.message || 'Failed to recall');
    } finally { setActionId(null); }
  };

  const deleteDraft = async (ts: any) => {
    setActionId(ts.id);
    setConfirmDelete(null);
    try {
      await timesheetsApi.deleteDraft(ts.id);
      toast.success('Draft deleted');
      setTimesheets(prev => prev.filter(t => t.id !== ts.id));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error?.message || 'Failed to delete');
    } finally { setActionId(null); }
  };

  const totalHours    = timesheets.reduce((s, t) => s + Number(t.totalHours), 0);
  const approvedCount = timesheets.filter(t => t.status === 'APPROVED').length;
  const pendingCount  = timesheets.filter(t => t.status === 'SUBMITTED').length;
  const draftCount    = timesheets.filter(t => t.status === 'DRAFT').length;
  const rejectedCount = timesheets.filter(t => t.status === 'REJECTED').length;

  // Last 8 weeks for mini bar chart
  const chartData = timesheets.slice(0, 8).reverse();
  const maxHours  = Math.max(...chartData.map(t => Number(t.totalHours)), 40);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:240, padding:24 }}>
      <Loader2 style={{ width:24, height:24, color:'#6366F1', animation:'spin 1s linear infinite' }} />
      <span style={{ marginLeft:10, color:'#6B7280', fontSize:14 }}>Loading your timesheets…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding:32, textAlign:'center' }}>
      <p style={{ color:'#EF4444', fontSize:14 }}>{error}</p>
      <button onClick={() => window.location.reload()}
        style={{ marginTop:12, padding:'8px 16px', background:'#6366F1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>
        Retry
      </button>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, <span style={{ color: '#059669' }}>{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Your complete timesheet history and weekly hours</p>
        </div>
        {/* Quick action */}
        <button
          onClick={() => onNavigate('timesheet')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366F1,#7C3AED)', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
        >
          <Clock className="w-4 h-4" /> Enter Timesheet <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock}        label="Total Hours Logged" value={`${totalHours.toFixed(1)}h`} color="#4F46E5" bg="#EDE9FE" />
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
              style={{ borderColor: '#6366F1', background: '#EEF2FF' }}>
              <Clock className="w-7 h-7 shrink-0" style={{ color: '#6366F1' }} />
              <div>
                <div className="text-sm font-bold" style={{ color: '#3730A3' }}>
                  {draftCount} Draft Timesheet{draftCount > 1 ? 's' : ''} — Submit Now
                </div>
                <div className="text-xs" style={{ color: '#6366F1' }}>Click to open and submit for approval</div>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" style={{ color: '#6366F1' }} />
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
        <div className="rounded-2xl p-5 bg-white border border-slate-100 shadow-sm">
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
              <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.color }} />
                {cfg.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timesheet history */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
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
              style={{ background: 'linear-gradient(135deg,#6366F1,#7C3AED)' }}>
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
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : ts.id)}
                    style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px', cursor:'pointer', transition:'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background='#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>

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

                    {/* Recall button — SUBMITTED only */}
                    {ts.status === 'SUBMITTED' && (
                      <button
                        onClick={e => { e.stopPropagation(); recall(ts); }}
                        disabled={actionId === ts.id}
                        title="Pull back to Draft so you can edit it"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 disabled:opacity-50"
                        style={{ background: '#FFFBEB', borderColor: '#F59E0B', color: '#B45309' }}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {actionId === ts.id ? '…' : 'Recall'}
                      </button>
                    )}

                    {/* Delete button — DRAFT only */}
                    {ts.status === 'DRAFT' && (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(ts); }}
                        disabled={actionId === ts.id}
                        title="Permanently delete this draft"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 disabled:opacity-50"
                        style={{ background: '#FEF2F2', borderColor: '#FCA5A5', color: '#DC2626' }}
                      >
                        <Trash2 className="w-3 h-3" />
                        {actionId === ts.id ? '…' : 'Delete'}
                      </button>
                    )}

                    {/* Expand chevron */}
                    <span style={{ marginLeft:'auto', flexShrink:0 }}>
                      {isExpanded
                        ? <ChevronUp   className="w-4 h-4 text-slate-300" />
                        : <ChevronDown className="w-4 h-4 text-slate-300" />
                      }
                    </span>
                  </div>

                  {/* Expanded daily breakdown */}
                  {isExpanded && (
                    <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
                      {(!ts.entries || ts.entries.length === 0) ? (
                        <p className="text-xs text-slate-400 pt-4">No entry details available.</p>
                      ) : (
                        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Project</th>
                                <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Task</th>
                                {DAY_LABELS.map(d => (
                                  <th key={d} className="px-2 py-2.5 text-center text-slate-500 font-semibold">{d}</th>
                                ))}
                                <th className="px-3 py-2.5 text-center text-slate-500 font-semibold">Total</th>
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
                              <tr className="bg-indigo-50">
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

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 text-center mb-1">Delete Draft?</h3>
            <p className="text-sm text-slate-500 text-center mb-1">
              Week of {weekLabel(confirmDelete.weekStartDate)}
            </p>
            <p className="text-xs text-red-500 text-center mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium">
                Cancel
              </button>
              <button onClick={() => deleteDraft(confirmDelete)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}