import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download, FileText, CheckCircle2, XCircle, AlertCircle,
  Loader2, Calendar, Clock, TrendingUp, ArrowLeft, User,
} from 'lucide-react';
import { timesheetsApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from './ui/Toast';
import {
  getPresetDateRange,
  timesheetInDateRange,
  matchesReportStatus,
  isSubmittedTimesheetStatus,
  enumerateWeekStartsInRange,
  weekStartKey,
  NOT_INITIATED_LABEL,
  STATUS_FILTER_OPTIONS,
  PERIOD_PRESET_LABELS,
  aggregateHoursByWeek,
  aggregateHoursByMonth,
  type PeriodPreset,
  type ReportStatusFilter,
} from '../lib/timesheetReportUtils';

interface TimesheetEntry {
  id: string;
  taskId: string;
  projectId: string;
  monday: number; tuesday: number; wednesday: number;
  thursday: number; friday: number; saturday: number; sunday: number;
  totalHours: number;
  notes?: string;
  task?: { name: string; project?: { id?: string; code: string; name: string } };
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
  DRAFT:     { label: 'Draft',     color: 'var(--text-2)', icon: FileText     },
  SUBMITTED: { label: 'Submitted', color: 'var(--warning)', icon: AlertCircle  },
  APPROVED:  { label: 'Approved',  color: 'var(--success)', icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',  color: 'var(--danger)', icon: XCircle      },
};

const DAY_KEYS   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const weekRange = (start: string, end: string) => `${fmt(start)} – ${fmt(end)}`;

function entryProjectId(e: TimesheetEntry): string {
  return e.projectId || e.task?.project?.id || '';
}

export default function TeamMemberReports({
  onBack,
  refreshKey = 0,
}: {
  onBack: () => void;
  refreshKey?: number;
}) {
  const { user } = useAuthStore();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [downloading, setDownloading] = useState(false);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [statusFilter, setStatusFilter]   = useState<ReportStatusFilter>('ALL');
  const [projFilter, setProjFilter]       = useState('ALL');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    timesheetsApi
      .getMine()
      .then((data: Timesheet[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
        );
        setTimesheets(sorted);
      })
      .catch(() => setError('Failed to load timesheets'))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const applyPeriodPreset = (p: Exclude<PeriodPreset, 'custom'>) => {
    setPeriodPreset(p);
    if (p === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const r = getPresetDateRange(p);
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const projectOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const ts of timesheets) {
      for (const e of ts.entries || []) {
        const id = entryProjectId(e);
        if (!id) continue;
        const code = e.task?.project?.code || id;
        const name = e.task?.project?.name;
        m.set(id, name ? `${code} — ${name}` : code);
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [timesheets]);

  const filtered = useMemo(() => {
    if (statusFilter === 'NOT_INITIATED') return [];
    return timesheets.filter(ts => {
      if (!matchesReportStatus(ts.status, statusFilter)) return false;
      if (!timesheetInDateRange(ts.weekStartDate, dateFrom, dateTo)) return false;
      if (projFilter !== 'ALL') {
        const has = ts.entries?.some(e => entryProjectId(e) === projFilter);
        if (!has) return false;
      }
      return true;
    });
  }, [timesheets, statusFilter, dateFrom, dateTo, projFilter]);

  const notInitiatedWeeks = useMemo(() => {
    if (statusFilter !== 'NOT_INITIATED' || !user?.id) return [];
    if (!dateFrom || !dateTo) return [];
    const weeks = enumerateWeekStartsInRange(dateFrom, dateTo);
    const have = new Set(timesheets.map(ts => weekStartKey(ts.weekStartDate)));
    return weeks.filter(w => !have.has(w));
  }, [statusFilter, user?.id, dateFrom, dateTo, timesheets]);

  const draftWeeksInRange = useMemo(() => {
    if (!dateFrom || !dateTo) return 0;
    return timesheets.filter(
      ts => ts.status === 'DRAFT' && timesheetInDateRange(ts.weekStartDate, dateFrom, dateTo)
    ).length;
  }, [timesheets, dateFrom, dateTo]);

  const totalHours    = filtered.reduce((s, t) => s + Number(t.totalHours || 0), 0);
  const approvedCount = filtered.filter(t => t.status === 'APPROVED').length;
  const submittedCount = filtered.filter(t => isSubmittedTimesheetStatus(t.status)).length;
  const draftCount     = filtered.filter(t => t.status === 'DRAFT').length;
  const rejectedCount  = filtered.filter(t => t.status === 'REJECTED').length;
  const weekCount     = filtered.length;

  const clearFilters = () => {
    setPeriodPreset('all');
    setStatusFilter('ALL');
    setProjFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    periodPreset !== 'all' ||
    statusFilter !== 'ALL' ||
    projFilter !== 'ALL' ||
    !!dateFrom ||
    !!dateTo;

  const exportExcel = useCallback(async () => {
    if (statusFilter === 'NOT_INITIATED') {
      if (!dateFrom || !dateTo) {
        toast.error('Set From and to dates to export not initiated weeks.');
        return;
      }
    } else if (filtered.length === 0) {
      return;
    }
    setDownloading(true);

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const generatedAt = new Date().toLocaleString('en-GB');

      if (statusFilter === 'NOT_INITIATED') {
        const weeks = enumerateWeekStartsInRange(dateFrom, dateTo);
        const summaryRows = [
          ['vThink Timesheet — My weeks with no timesheet (not initiated)'],
          [`Employee: ${user?.name || ''}`, `ID: ${user?.employeeId || user?.email || ''}`],
          [`Generated: ${generatedAt}`],
          [],
          ['FILTERS'],
          ['Date range', `${dateFrom} → ${dateTo}`, ''],
          ['Status', NOT_INITIATED_LABEL, ''],
          [],
          ['TOTALS'],
          ['Mondays in range', String(weeks.length), ''],
          ['Weeks with no record (not initiated)', String(notInitiatedWeeks.length), ''],
          ['Draft weeks in same range (for comparison)', String(draftWeeksInRange), ''],
        ];
        const ws0 = XLSX.utils.aoa_to_sheet(summaryRows);
        ws0['!cols'] = [{ wch: 36 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws0, 'Summary');
        const ni = [['Week start (Mon)', 'Status'], ...notInitiatedWeeks.map(w => [w, NOT_INITIATED_LABEL])];
        const ws1 = XLSX.utils.aoa_to_sheet(ni);
        ws1['!cols'] = [{ wch: 18 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Not initiated');
        const fileName = `vThink_MyNotInitiated_${user?.name?.replace(/\s+/g, '_') || 'export'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success('Download started');
        return;
      }

      const byWeek = aggregateHoursByWeek(filtered);
      const byMonth = aggregateHoursByMonth(filtered);

      const summaryRows = [
        ['vThink Timesheet — Employee report (my timesheets)'],
        [`Employee: ${user?.name || ''}`, `ID: ${user?.employeeId || user?.email || ''}`],
        [`Generated: ${generatedAt}`],
        [],
        ['FILTERS APPLIED'],
        ['Period', periodPreset === 'custom' ? 'Custom range' : PERIOD_PRESET_LABELS[periodPreset as keyof typeof PERIOD_PRESET_LABELS] || periodPreset],
        ...(dateFrom || dateTo ? [['Date range', `${dateFrom || '…'} → ${dateTo || '…'}`]] : []),
        ['Status', STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label || statusFilter],
        ['Project', projFilter === 'ALL' ? 'All projects' : projectOptions.find(([id]) => id === projFilter)?.[1] || projFilter],
        [],
        ['SUMMARY'],
        ['Weeks in export', String(weekCount)],
        ['Total hours', totalHours.toFixed(2)],
        ['Approved weeks', String(approvedCount)],
        ['Submitted', String(submittedCount)],
        ['Draft', String(draftCount)],
        ['Rejected', String(rejectedCount)],
      ];

      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      ws1['!cols'] = [{ wch: 22 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

      const wsWeek = XLSX.utils.aoa_to_sheet([
        ['Week starting (ISO)', 'Total hours', 'Timesheet count'],
        ...byWeek.map(r => [r.week, r.hours.toFixed(2), r.count]),
      ]);
      wsWeek['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsWeek, 'By week');

      const wsMonth = XLSX.utils.aoa_to_sheet([
        ['Month (YYYY-MM)', 'Total hours', 'Timesheet count'],
        ...byMonth.map(r => [r.month, r.hours.toFixed(2), r.count]),
      ]);
      wsMonth['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsMonth, 'By month');

      const weekHeaders = ['#', 'Week Start', 'Week End', 'Total Hours', 'Status', 'Submitted On', 'Approved On', 'Rejection Reason'];
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
        { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Weekly lines');

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
      XLSX.utils.book_append_sheet(wb, ws3, 'Daily details');

      const fileName = `vThink_MyTimesheets_${user?.name?.replace(/\s+/g, '_') || 'export'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Download started');
    } catch (e) {
      console.error(e);
      toast.error('Could not export. Try again or refresh the page.');
    } finally {
      setDownloading(false);
    }
  }, [
    filtered,
    user,
    totalHours,
    approvedCount,
    submittedCount,
    draftCount,
    rejectedCount,
    weekCount,
    periodPreset,
    dateFrom,
    dateTo,
    statusFilter,
    projFilter,
    projectOptions,
    notInitiatedWeeks,
    draftWeeksInRange,
  ]);

  return (
    <div className="p-6 space-y-5" style={{ background: 'var(--page-bg)', minHeight: '100%' }}>

      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Overview
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Timesheets</span> <span>›</span>
            <span className="text-slate-600 font-medium">My reports</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]" style={{ letterSpacing: '-0.02em' }}>
            My timesheet reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
            <strong>Employee view</strong> — only your own weeks. Filter by period (this week, this month, custom range),
            approval status, and project, then review the table or download Excel (weekly totals, monthly totals, line items, and daily breakdown).
          </p>
        </div>

        <button
          onClick={exportExcel}
          disabled={
            downloading ||
            (statusFilter === 'NOT_INITIATED' ? !dateFrom || !dateTo : filtered.length === 0)
          }
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

      <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/40 px-4 py-3 flex items-start gap-3">
        <User className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-950/90">
          Use <strong>This week</strong> / <strong>This month</strong> for quick slices, or set a custom range.
          Status <strong>Submitted</strong> lists weeks you have submitted and are waiting on your manager. Exports respect every filter you set.
        </p>
      </div>

      {statusFilter === 'NOT_INITIATED' && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm text-amber-950/90">
          <strong>Not initiated</strong> means you have <strong>no timesheet saved</strong> for that Monday week yet.
          <strong> Draft</strong> means you opened the week and saved hours but did not submit. Pick a date range to list missing weeks.
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Period</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIOD_PRESET_LABELS) as Exclude<PeriodPreset, 'custom'>[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => applyPeriodPreset(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                periodPreset === key
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                  : 'border-[var(--border)] bg-[var(--card-bg)] text-slate-600 hover:bg-slate-50'
              }`}
            >
              {PERIOD_PRESET_LABELS[key]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriodPreset('custom')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              periodPreset === 'custom'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                : 'border-[var(--border)] bg-[var(--card-bg)] text-slate-600 hover:bg-slate-50'
            }`}
          >
            Custom range
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPeriodPreset('custom'); }}
              className="px-3 py-2 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPeriodPreset('custom'); }}
              className="px-3 py-2 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ReportStatusFilter)}
            className="pl-3 pr-8 py-2.5 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700 cursor-pointer min-w-[200px]"
          >
            {STATUS_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}{o.hint ? ` — ${o.hint}` : ''}</option>
            ))}
          </select>

          <select
            value={projFilter}
            onChange={e => setProjFilter(e.target.value)}
            disabled={statusFilter === 'NOT_INITIATED'}
            className="pl-3 pr-8 py-2.5 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700 cursor-pointer min-w-[200px] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <option value="ALL">All projects</option>
            {projectOptions.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Reset filters
            </button>
          )}

          <span className="lg:ml-auto text-xs text-slate-400">
            {statusFilter === 'NOT_INITIATED'
              ? `${notInitiatedWeeks.length} week${notInitiatedWeeks.length !== 1 ? 's' : ''} without a record`
              : `${filtered.length} of ${timesheets.length} week${timesheets.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(statusFilter === 'NOT_INITIATED'
          ? [
              {
                label: 'Mondays in range',
                value: dateFrom && dateTo ? enumerateWeekStartsInRange(dateFrom, dateTo).length : '—',
                icon: Calendar,
                color: '#6366F1',
              },
              {
                label: 'Not initiated',
                value: notInitiatedWeeks.length,
                icon: AlertCircle,
                color: '#D97706',
              },
              {
                label: 'Draft in range',
                value: draftWeeksInRange,
                icon: FileText,
                color: 'var(--text-2)',
              },
              {
                label: 'Timesheets on file',
                value: timesheets.length,
                icon: Clock,
                color: '#8B5CF6',
              },
            ]
          : [
              { label: 'Total hours', value: `${totalHours.toFixed(1)}h`, icon: Clock, color: '#6366F1' },
              { label: 'Weeks shown', value: weekCount, icon: Calendar, color: '#8B5CF6' },
              { label: 'Approved', value: approvedCount, icon: CheckCircle2, color: '#059669' },
              { label: 'Submitted', value: submittedCount, icon: AlertCircle, color: '#D97706' },
            ]
        ).map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${s.color} 22%, var(--card-bg))` }}>
                <Icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--text-1)]" style={{ letterSpacing: '-0.02em' }}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {statusFilter !== 'NOT_INITIATED' && (
      <div className="rounded-xl p-4 flex items-start gap-3 border border-[var(--border)]" style={{ background: 'var(--primary-tint)' }}>
        <Download className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
        <div>
          <div className="text-sm font-semibold text-[var(--text-1)]">Excel workbook</div>
          <div className="text-xs mt-0.5 text-[var(--text-2)]">
            Sheets: <strong>Summary</strong> (filters + totals), <strong>By week</strong>, <strong>By month</strong>, <strong>Weekly lines</strong>, <strong>Daily details</strong> (hours per day by project/task).
          </div>
        </div>
      </div>
      )}
      {statusFilter === 'NOT_INITIATED' && (
      <div className="rounded-xl p-4 flex items-start gap-3 border border-[var(--border)]" style={{ background: 'var(--primary-tint)' }}>
        <Download className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
        <div>
          <div className="text-sm font-semibold text-[var(--text-1)]">Excel — not initiated</div>
          <div className="text-xs mt-0.5 text-[var(--text-2)]">
            Download includes <strong>Summary</strong> and a <strong>Not initiated</strong> sheet listing Monday week starts where you have no timesheet row.
          </div>
        </div>
      </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-12 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-sm text-slate-400">Loading timesheets…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-8 text-center">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : statusFilter === 'NOT_INITIATED' ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-[var(--text-1)]">Weeks with no timesheet</h3>
            <span className="ml-auto text-xs text-slate-400">{notInitiatedWeeks.length} week{notInitiatedWeeks.length !== 1 ? 's' : ''}</span>
          </div>
          {!dateFrom || !dateTo ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              Set <strong>From</strong> and <strong>to</strong> to list Mondays in that range where you have not created a timesheet.
            </div>
          ) : notInitiatedWeeks.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              You have a timesheet record for every Monday between{' '}
              <span className="font-mono text-xs">{dateFrom}</span> and <span className="font-mono text-xs">{dateTo}</span>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-[var(--border)]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Week start (Mon)</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {notInitiatedWeeks.map(w => (
                    <tr key={w} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-slate-800">{w}</td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-md"
                          style={{
                            background: 'color-mix(in srgb, var(--warning) 22%, var(--card-bg))',
                            color: 'var(--warning)',
                          }}
                        >
                          {NOT_INITIATED_LABEL}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-12 text-center">
          <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No timesheets match your filters</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-[var(--text-1)]">Timesheets (weekly)</h3>
            <span className="ml-auto text-xs text-slate-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-[var(--border)]">
                  {['Week', 'Total hours', 'Status', 'Submitted', 'Approved'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(ts => {
                  const cfg = STATUS_CONFIG[ts.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={ts.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-[var(--text-1)]">
                          {weekRange(ts.weekStartDate, ts.weekEndDate)}
                        </div>
                        {ts.status === 'REJECTED' && ts.rejectionReason && (
                          <div className="text-xs text-red-500 mt-0.5 truncate max-w-md">
                            {ts.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-[var(--text-1)]">
                        {Number(ts.totalHours).toFixed(1)}h
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: `color-mix(in srgb, ${cfg.color} 22%, var(--card-bg))`, color: cfg.color }}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {ts.submittedAt ? fmt(ts.submittedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
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
