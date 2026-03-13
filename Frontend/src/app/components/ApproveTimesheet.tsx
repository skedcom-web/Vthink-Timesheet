import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Eye, ArrowLeft } from 'lucide-react';
import { timesheetsApi } from '../../services/api';
import { toast } from './ui/Toast';

const DAY_KEYS   = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ApproveTimesheet({ onBack, onDataChanged }: { onBack: () => void; onDataChanged?: () => void }) {
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [viewTs, setViewTs] = useState<any | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    timesheetsApi.getPending()
      .then(setTimesheets)
      .catch(() => toast.error('Failed to load timesheets'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const approve = async (id: string) => {
    setActionId(id);
    try {
      await timesheetsApi.approve(id);
      toast.success('Timesheet approved');
      onDataChanged?.();
      setTimesheets(prev => prev.filter(t => t.id !== id));
      if (viewTs?.id === id) setViewTs(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to approve');
    } finally { setActionId(null); }
  };

  const reject = async () => {
    if (!rejectId) return;
    setActionId(rejectId);
    try {
      await timesheetsApi.reject(rejectId, rejectReason);
      toast.success('Timesheet rejected');
      onDataChanged?.();
      setTimesheets(prev => prev.filter(t => t.id !== rejectId));
      if (viewTs?.id === rejectId) setViewTs(null);
      setRejectId(null);
      setRejectReason('');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to reject');
    } finally { setActionId(null); }
  };

  const statusBadge = (s: string) => ({
    SUBMITTED: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
    DRAFT: 'bg-slate-100 text-slate-700',
  }[s] || 'bg-slate-100 text-slate-600');

  return (
    <div className="p-6">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Approve Timesheets</h1>
      <p className="text-slate-500 text-sm mb-6">Review and action submitted timesheets</p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : timesheets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <div className="text-slate-700 font-medium">All caught up!</div>
          <div className="text-slate-400 text-sm mt-1">No timesheets pending approval</div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Week</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Hours</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Submitted</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {timesheets.map(ts => (
                <>
                  <tr key={ts.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{ts.employee?.name}</div>
                      <div className="text-xs text-slate-400">{ts.employee?.employeeId || ts.employee?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmt(ts.weekStartDate)} – {fmt(ts.weekEndDate)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{Number(ts.totalHours).toFixed(1)}h</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusBadge(ts.status)}`}>{ts.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{ts.submittedAt ? fmt(ts.submittedAt) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewTs(viewTs?.id === ts.id ? null : ts)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => approve(ts.id)} disabled={actionId === ts.id}
                          className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => { setRejectId(ts.id); setRejectReason(''); }}
                          className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                  {viewTs?.id === ts.id && (
                    <tr key={`${ts.id}-detail`}>
                      <td colSpan={6} className="px-4 pb-4 bg-slate-50">
                        <div className="rounded-lg border border-slate-200 overflow-hidden mt-1">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-white border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Project</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Task</th>
                                {DAY_LABELS.map(d => <th key={d} className="px-2 py-2 font-medium text-slate-600 text-center">{d}</th>)}
                                <th className="px-3 py-2 font-medium text-slate-600 text-center">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ts.entries?.map((e: any, i: number) => (
                                <tr key={i} className="border-b border-slate-100">
                                  <td className="px-3 py-2 text-slate-700">{e.task?.project?.code || '—'}</td>
                                  <td className="px-3 py-2 text-slate-700">{e.task?.name || '—'}</td>
                                  {DAY_KEYS.map(dk => <td key={dk} className="px-2 py-2 text-center text-slate-600">{Number(e[dk]).toFixed(1)}</td>)}
                                  <td className="px-3 py-2 text-center font-semibold text-indigo-700">{Number(e.totalHours).toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Reject Timesheet</h3>
            <p className="text-sm text-slate-500 mb-4">Provide a reason for rejection (optional)</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Hours don't match project plan..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectId(null)} className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={reject} disabled={!!actionId} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {actionId ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
