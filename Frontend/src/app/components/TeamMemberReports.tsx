import { useState, useEffect, useCallback } from 'react';
import {
  Download, FileText, CheckCircle2, XCircle, AlertCircle,
  Loader2, Calendar, Clock, TrendingUp, ArrowLeft,
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
  task?: { name: string; project?: { code: string; name: string } };
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
  DRAFT:     { label: 'Draft',     color: '#64748B', bg: '#F1F5F9', icon: FileText     },
  SUBMITTED: { label: 'Submitted', color: '#D97706', bg: '#FEF3C7', icon: AlertCircle  },
  APPROVED:  { label: 'Approved',  color: '#059669', bg: '#D1FAE5', icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',  color: '#DC2626', bg: '#FEE2E2', icon: XCircle      },
};

const DAY_KEYS   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const weekRange = (start: string, end: string) => `${fmt(start)} – ${fmt(end)}`;

export default function TeamMemberReports({ onBack }: { onBack: () => void }) {
  const { user }  = useAuthStore();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [downloading, setDownloading] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  useEffect(() => {
    timesheetsApi.getAll()
      .then((data: Timesheet[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
        );
        setTimesheets(sorted);
      })
      .catch(() => setError('Failed to load timesheets'))
      .finally(() => setLoading(false));
  }, []);

  // Filtered list
  const filtered = timesheets.filter(ts => {
    if (statusFilter !== 'ALL' && ts.status !== statusFilter) return false;
    if (dateFrom && ts.weekStartDate.slice(0, 10) < dateFrom) return false;
    if (dateTo   && ts.weekStartDate.slice(0, 10) > dateTo)   return false;
    return true;
  });

  // Summary stats from filtered
  const totalHours    = filtered.reduce((s, t) => s + Number(t.totalHours), 0);
  const approvedCount = filtered.filter(t => t.status === 'APPROVED').length;
  const pendingCount  = filtered.filter(t => t.status === 'SUBMITTED').length;
  const weekCount     = filtered.length;

  // ── Excel Export ────────────────────────────────────────────────────────────
  const exportExcel = useCallback(async () => {
    if (filtered.length === 0) return;
    setDownloading(true);

    try {
      const wb = XLSX.utils.book_new();
      const generatedAt = new Date().toLocaleString('en-GB');

      // ── Sheet 1: Summary ──────────────────────────────────────────────────
      const summaryRows = [
        ['vThink Timesheet — My Report'],
        [`Employee: ${user?.name || ''}`, `ID: ${user?.employeeId || user?.email || ''}`],
        [`Generated: ${generatedAt}`],
        [],
        ['SUMMARY'],
        ['Total Weeks',    weekCount],
        ['Total Hours',    totalHours.toFixed(2)],
        ['Approved',       approvedCount],
        ['Pending Review', pendingCount],
        ['Draft / Other',  weekCount - approvedCount - pendingCount],
      ];
      if (statusFilter !== 'ALL') summaryRows.push(['Status Filter', statusFilter]);
      if (dateFrom)               summaryRows.push(['From', dateFrom]);
      if (dateTo)                 summaryRows.push(['To',   dateTo]);

      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      ws1['!cols'] = [{ wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

      // ── Sheet 2: Weekly Overview ──────────────────────────────────────────
      const weekHeaders = ['Week', 'Week Start', 'Week End', 'Total Hours', 'Status', 'Submitted On', 'Approved On', 'Rejection Reason'];
      const weekRows = filtered.map((ts, i) => [
        i + 1,
        fmt(ts.weekStartDate),
        fmt(ts.weekEndDate),
        Number(ts.totalHours).toFixed(2),
        STATUS_CONFIG[ts.status]?.label ?? ts.status,
        ts.submittedAt ? fmt(ts.submittedAt) : '—',
        ts.approvedAt  ? fmt(ts.approvedAt)  : '—',
        ts.rejectionReason || '—',
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([weekHeaders, ...weekRows]);
      ws2['!cols'] = [
        { wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
        { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Weekly Overview');

      // ── Sheet 3: Daily Details ─────────────────────────────────────────────
      const detailHeaders = [
        'Week', 'Week Start', 'Status', 'Project', 'Task',
        ...DAY_LABELS, 'Total Hours', 'Notes',
      ];
      const detailRows: (string | number)[][] = [];
      filtered.forEach((ts, i) => {
        if (!ts.entries || ts.entries.length === 0) {
          detailRows.push([
            i + 1, fmt(ts.weekStartDate), STATUS_CONFIG[ts.status]?.label ?? ts.status,
            '—', '—', ...Array(7).fill(0), 0, '',
          ]);
        } else {
          ts.entries.forEach(entry => {
            detailRows.push([
              i + 1,
              fmt(ts.weekStartDate),
              STATUS_CONFIG[ts.status]?.label ?? ts.status,
              entry.task?.project?.code || '—',
              entry.task?.name || entry.taskId,
              ...DAY_KEYS.map(dk => Number((entry as any)[dk] ?? 0)),
              Number(entry.totalHours).toFixed(2),
              entry.notes || '',
            ]);
          });
        }
      });
      const ws3 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
      ws3['!cols'] = [
        { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 28 },
        ...Array(7).fill({ wch: 6 }), { wch: 12 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws3, 'Daily Details');

      const fileName = `vThink_MyTimesheets_${user?.name?.replace(/\s+/g, '_') || 'Report'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setDownloading(false);
    }
  }, [filtered, user, totalHours, approvedCount, pendingCount, weekCount, statusFilter, dateFrom, dateTo]);

  return (
    <div className="p-6 space-y-5" style={{ background: 'var(--page-bg)', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-indigo-800 font-medium mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Overview
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Timesheets</span> <span>›</span>
            <span className="text-slate-600 font-medium">My Reports</span>
          </div>
          <h1 className="text-2xl font-bold font-bold color-text-1" style={{ letterSpacing: '-0.02em' }}>
            My Timesheet Reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View, filter and download all your past timesheets
          </p>
        </div>

        {/* Download button */}
        <button
          onClick={exportExcel}
          disabled={downloading || filtered.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
          }}
        >
          {downloading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
            : <><Download className="w-4 h-4" /> Download Excel</>
          }
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="pl-3 pr-8 py-2.5 rounded-lg text-sm bg-slate-50 border border-gray-100 outline-none text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm bg-slate-50 border border-gray-100 outline-none text-slate-700"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm bg-slate-50 border border-gray-100 outline-none text-slate-700"
            />
          </div>

          {/* Clear filters */}
          {(statusFilter !== 'ALL' || dateFrom || dateTo) && (
            <button
              onClick={() => { setStatusFilter('ALL'); setDateFrom(''); setDateTo(''); }}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400">
            {filtered.length} of {timesheets.length} week{timesheets.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Hours',    value: `${totalHours.toFixed(1)}h`, icon: Clock,        color: 'var(--primary)', bg: 'var(--primary-tint)' },
          { label: 'Weeks Shown',    value: weekCount,                   icon: Calendar,     color: '#8B5CF6', bg: '#F5F3FF' },
          { label: 'Approved',       value: approvedCount,               icon: CheckCircle2, color: '#059669', bg: '#D1FAE5' },
          { label: 'Pending Review', value: pendingCount,                icon: AlertCircle,  color: '#D97706', bg: '#FEF3C7' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                <Icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold font-bold color-text-1" style={{ letterSpacing: '-0.02em' }}>{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Download notice */}
      <div className="rounded-xl p-4 flex items-start gap-3 border"
        style={{ background: 'var(--primary-tint)', borderColor: '#C7D2FE' }}>
        <Download className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
        <div>
          <div className="text-sm font-semibold" style={{ color: '#3730A3' }}>Download your timesheets as Excel</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--primary)' }}>
            The Excel file includes 3 sheets — Summary, Weekly Overview, and Daily Details (with project and task breakdown per day).
            Apply filters above before downloading to narrow the data.
          </div>
        </div>
      </div>

      {/* Timesheet list */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-sm text-slate-400">Loading timesheets…</span>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-red-100 p-8 text-center">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No timesheets match your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-700">All Timesheets</h3>
            <span className="ml-auto text-xs text-slate-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100">
                  {['Week', 'Total Hours', 'Status', 'Submitted On', 'Approved On'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(ts => {
                  const cfg      = STATUS_CONFIG[ts.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={ts.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-800">
                          {weekRange(ts.weekStartDate, ts.weekEndDate)}
                        </div>
                        {ts.status === 'REJECTED' && ts.rejectionReason && (
                          <div className="text-xs text-red-500 mt-0.5 truncate max-w-xs">
                            {ts.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold font-bold color-text-1">
                        {Number(ts.totalHours).toFixed(1)}h
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {ts.submittedAt ? fmt(ts.submittedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {ts.approvedAt ? fmt(ts.approvedAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
