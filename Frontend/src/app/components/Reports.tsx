import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, Download, Users, Clock, CheckCircle2, FileText,
  Search, X, AlertCircle, Calendar, User, ArrowLeft, Building2,
} from 'lucide-react';
import { timesheetsApi, usersApi, projectsApi, projectConfigApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from './ui/Toast';
import {
  getPresetDateRange,
  timesheetInDateRange,
  matchesReportStatus,
  isSubmittedTimesheetStatus,
  normalizeReportTimesheetStatus,
  reportStatusDisplayLabel,
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

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const STATUS_STYLES: Record<string, { color: string }> = {
  DRAFT:     { color: 'var(--text-2)' },
  SUBMITTED: { color: 'var(--warning)' },
  PENDING:   { color: 'var(--warning)' },
  PENDING_APPROVAL: { color: 'var(--warning)' },
  APPROVED:  { color: 'var(--success)' },
  REJECTED:  { color: 'var(--danger)' },
};

type ReportType = 'summary' | 'employee' | 'project' | 'pending' | 'detailed';

const REPORT_TYPES: { id: ReportType; label: string; icon: any; desc: string; color: string }[] = [
  { id: 'summary',  label: 'Summary',       icon: BarChart3,   desc: 'KPIs + hours by employee & project + full list', color: 'var(--primary)' },
  { id: 'employee', label: 'By employee',   icon: User,        desc: 'Hours and counts per person (filtered set)',     color: '#8B5CF6' },
  { id: 'project',  label: 'By project',    icon: FileText,    desc: 'Hours rolled up to each project',               color: '#06B6D4' },
  { id: 'pending',  label: 'Submitted', icon: AlertCircle, desc: 'Weeks in Submitted status — awaiting approval',       color: '#F59E0B' },
  { id: 'detailed', label: 'Weekly lines',  icon: Clock,       desc: 'One row per timesheet week',                      color: '#10B981' },
];

const ROLE_REPORT_HINT: Record<string, string> = {
  SUPER_ADMIN:     'Organisation-wide timesheets (excluding your own submissions from approval queues where applicable).',
  COMPANY_ADMIN:   'Timesheets for users in your reporting hierarchy.',
  PROJECT_MANAGER: 'Timesheets for your direct reports.',
};

export default function Reports({
  onBack,
  refreshKey = 0,
}: {
  onBack: () => void;
  refreshKey?: number;
}) {
  const { user } = useAuthStore();
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [projects, setProjects]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  const [reportType, setReportType]     = useState<ReportType>('summary');
  const [periodPreset, setPeriodPreset]   = useState<PeriodPreset>('all');
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatus]       = useState<ReportStatusFilter>('ALL');
  const [empFilter, setEmpFilter]       = useState('ALL');
  const [projFilter, setProjFilter]     = useState('ALL');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user?.role || '');

  useEffect(() => {
    setLoading(true);
    const loadProjects = isAdmin
      ? projectConfigApi
          .getAll()
          .then(configs => (configs && configs.length > 0 ? configs : projectsApi.getAll()))
          .catch(() => projectsApi.getAll())
      : Promise.resolve([]);

    Promise.allSettled([
      timesheetsApi.getAll(),
      isAdmin ? usersApi.getAll() : Promise.resolve([]),
      loadProjects,
    ]).then(([ts, us, pr]) => {
      if (ts.status === 'fulfilled') setTimesheets(ts.value || []);
      if (us.status === 'fulfilled') setEmployees(us.value || []);
      if (pr.status === 'fulfilled') setProjects(pr.value || []);
    }).finally(() => setLoading(false));
  }, [isAdmin, refreshKey]);

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

  const filtered = useMemo(() => {
    return timesheets.filter(ts => {
      if (!matchesReportStatus(ts.status, statusFilter)) return false;
      if (empFilter !== 'ALL' && ts.employeeId !== empFilter) return false;
      if (
        projFilter !== 'ALL' &&
        !ts.entries?.some((e: any) => (e.projectId || e.task?.project?.id) === projFilter)
      ) {
        return false;
      }
      if (!timesheetInDateRange(ts.weekStartDate, dateFrom, dateTo)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const statusLabel = reportStatusDisplayLabel(ts.status).toLowerCase();
        return (
          ts.employee?.name?.toLowerCase().includes(q) ||
          ts.status?.toLowerCase().includes(q) ||
          statusLabel.includes(q) ||
          ts.employee?.employeeId?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [timesheets, statusFilter, empFilter, projFilter, dateFrom, dateTo, search]);

  const notInitiatedRows = useMemo(() => {
    if (statusFilter !== 'NOT_INITIATED' || !isAdmin) return [];
    if (!dateFrom || !dateTo) return [];
    const weeks = enumerateWeekStartsInRange(dateFrom, dateTo);
    if (weeks.length === 0) return [];
    const existing = new Set(
      timesheets.map(ts => `${ts.employeeId}|${weekStartKey(ts.weekStartDate)}`)
    );
    const emps = employees.filter((e: any) => {
      if (e.active === false) return false;
      if (empFilter !== 'ALL' && e.id !== empFilter) return false;
      return true;
    });
    const rows: { employee: any; weekStart: string }[] = [];
    for (const e of emps) {
      for (const w of weeks) {
        if (!existing.has(`${e.id}|${w}`)) rows.push({ employee: e, weekStart: w });
      }
    }
    let out = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = rows.filter(
        r =>
          r.employee.name?.toLowerCase().includes(q) ||
          r.employee.employeeId?.toLowerCase().includes(q) ||
          r.employee.email?.toLowerCase().includes(q)
      );
    }
    return [...out].sort(
      (a, b) =>
        a.weekStart.localeCompare(b.weekStart) || (a.employee.name || '').localeCompare(b.employee.name || '')
    );
  }, [statusFilter, isAdmin, dateFrom, dateTo, timesheets, employees, empFilter, search]);

  const notInitiatedUniqueEmployees = useMemo(
    () => new Set(notInitiatedRows.map(r => r.employee.id)).size,
    [notInitiatedRows]
  );

  const draftWeeksInRange = useMemo(() => {
    if (!dateFrom || !dateTo) return 0;
    return timesheets.filter(
      ts => ts.status === 'DRAFT' && timesheetInDateRange(ts.weekStartDate, dateFrom, dateTo)
    ).length;
  }, [timesheets, dateFrom, dateTo]);

  const totalHours = filtered.reduce((s, t) => s + Number(t.totalHours || 0), 0);
  const approved     = filtered.filter(t => t.status === 'APPROVED').length;
  const submitted    = filtered.filter(t => isSubmittedTimesheetStatus(t.status)).length;
  const draftCount   = filtered.filter(t => t.status === 'DRAFT').length;
  const rejectedCount = filtered.filter(t => t.status === 'REJECTED').length;
  const uniqueEmps = new Set(filtered.map(t => t.employeeId)).size;

  const employeeSummary = useMemo(() => {
    return employees
      .filter(e => empFilter === 'ALL' || e.id === empFilter)
      .map(e => {
        const empTs = filtered.filter(t => t.employeeId === e.id);
        return {
          name: e.name,
          role: e.role,
          employeeId: e.employeeId,
          total: empTs.reduce((s, t) => s + Number(t.totalHours || 0), 0),
          count: empTs.length,
          approved: empTs.filter(t => t.status === 'APPROVED').length,
          submitted: empTs.filter(t => isSubmittedTimesheetStatus(t.status)).length,
        };
      })
      .filter(e => e.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [employees, empFilter, filtered]);

  const projectSummary = useMemo(() => {
    return projects
      .map(p => {
        const hours = filtered.reduce((sum, ts) => {
          const entries =
            ts.entries?.filter(
              (e: any) => (e.projectId || e.task?.project?.id) === p.id
            ) || [];
          return sum + entries.reduce((s: number, e: any) => s + Number(e.totalHours || 0), 0);
        }, 0);
        return { code: p.code, name: p.name, hours, status: p.status };
      })
      .filter(p => p.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [projects, filtered]);

  const clearFilters = () => {
    setPeriodPreset('all');
    setStatus('ALL');
    setEmpFilter('ALL');
    setProjFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  const activeFiltersCount = [
    statusFilter !== 'ALL',
    empFilter !== 'ALL',
    projFilter !== 'ALL',
    !!dateFrom || !!dateTo,
    !!search.trim(),
  ].filter(Boolean).length;

  const periodLabelForExport =
    periodPreset === 'custom'
      ? `Custom (${dateFrom || '…'} → ${dateTo || '…'})`
      : PERIOD_PRESET_LABELS[periodPreset as keyof typeof PERIOD_PRESET_LABELS] || periodPreset;

  const exportExcel = useCallback(async () => {
    let XLSX: typeof import('xlsx');
    try {
      XLSX = await import('xlsx');
    } catch {
      toast.error('Could not load export module. Check your connection and try again.');
      return;
    }

    if (statusFilter === 'NOT_INITIATED') {
      const wb = XLSX.utils.book_new();
      const statusLbl = STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label || statusFilter;
      const weeks =
        dateFrom && dateTo ? enumerateWeekStartsInRange(dateFrom, dateTo) : [];
      const summaryData = [
        ['vThink Timesheet — Not initiated report (no timesheet row for week)'],
        ['Generated', new Date().toLocaleString(), '', ''],
        ['Viewer role', user?.role || '', '', ''],
        [],
        ['FILTERS'],
        ['Period', periodLabelForExport, '', ''],
        ['Date range (week start bounds)', `${dateFrom || '—'} → ${dateTo || '—'}`, '', ''],
        ['Status', statusLbl, '', ''],
        [
          'Employee',
          empFilter === 'ALL' ? 'All' : employees.find(e => e.id === empFilter)?.name || empFilter,
          '',
          '',
        ],
        ['Search', search.trim() || '—', '', ''],
        [],
        ['TOTALS'],
        ['Mondays in range', weeks.length, '', ''],
        ['Missing timesheet slots (employee × week)', notInitiatedRows.length, '', ''],
        ['Employees with at least one gap', notInitiatedUniqueEmployees, '', ''],
        [],
        [
          'Note',
          'Draft = a timesheet exists but is not submitted. Not initiated = no record for that employee/week — use for weekly nudges (e.g. Saturday).',
          '',
          '',
        ],
      ];
      const ws0 = XLSX.utils.aoa_to_sheet(summaryData);
      ws0['!cols'] = [{ wch: 36 }, { wch: 52 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws0, 'Summary');

      const niHeaders = ['Employee', 'Email', 'Employee ID', 'Role', 'Week start (Mon)', 'Status'];
      const niRows = notInitiatedRows.map(r => [
        r.employee.name || '',
        r.employee.email || '',
        r.employee.employeeId || '',
        String(r.employee.role || '').replace(/_/g, ' '),
        r.weekStart,
        NOT_INITIATED_LABEL,
      ]);
      const wsNi = XLSX.utils.aoa_to_sheet([niHeaders, ...niRows]);
      wsNi['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsNi, 'Not initiated');

      XLSX.writeFile(wb, `vThink_NotInitiated_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Download started');
      return;
    }

    const wb = XLSX.utils.book_new();
    const byWeek = aggregateHoursByWeek(filtered);
    const byMonth = aggregateHoursByMonth(filtered);
    const statusLabel = STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label || statusFilter;

    const summaryData = [
      ['vThink Timesheet — Manager / admin report'],
      ['Generated', new Date().toLocaleString(), '', ''],
      ['Viewer role', user?.role || '', '', ''],
      ['View mode', REPORT_TYPES.find(r => r.id === reportType)?.label || reportType, '', ''],
      [],
      ['FILTERS'],
      ['Period', periodLabelForExport, '', ''],
      ['Date range (week start)', `${dateFrom || '—'} → ${dateTo || '—'}`, '', ''],
      ['Status', statusLabel, '', ''],
      ['Employee', empFilter === 'ALL' ? 'All' : employees.find(e => e.id === empFilter)?.name || empFilter, '', ''],
      [
        'Project',
        projFilter === 'ALL'
          ? 'All'
          : `${projects.find(p => p.id === projFilter)?.code || ''} — ${projects.find(p => p.id === projFilter)?.name || ''}`,
        '',
        '',
      ],
      ['Search', search.trim() || '—', '', ''],
      [],
      ['TOTALS'],
      ['Total hours', totalHours.toFixed(1), '', ''],
      ['Timesheet weeks', filtered.length, '', ''],
      ['Approved', approved, '', ''],
      ['Submitted', submitted, '', ''],
      ['Draft', draftCount, '', ''],
      ['Rejected', rejectedCount, '', ''],
      ['Unique employees', uniqueEmps, '', ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 28 }, { wch: 36 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    const wsBw = XLSX.utils.aoa_to_sheet([
      ['Week starting (ISO)', 'Total hours', 'Timesheet count'],
      ...byWeek.map(r => [r.week, r.hours.toFixed(2), r.count]),
    ]);
    wsBw['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsBw, 'By week');

    const wsBm = XLSX.utils.aoa_to_sheet([
      ['Month (YYYY-MM)', 'Total hours', 'Timesheet count'],
      ...byMonth.map(r => [r.month, r.hours.toFixed(2), r.count]),
    ]);
    wsBm['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsBm, 'By month');

    const tsHeaders = [
      'Employee',
      'Employee ID',
      'Week Start',
      'Week End',
      'Total Hours',
      'Status',
      'Submitted At',
      'Approved At',
    ];
    const tsRows = filtered.map(ts => [
      ts.employee?.name || '',
      ts.employee?.employeeId || '',
      fmt(ts.weekStartDate),
      fmt(ts.weekEndDate),
      Number(ts.totalHours).toFixed(1),
      reportStatusDisplayLabel(ts.status),
      ts.submittedAt ? fmt(ts.submittedAt) : '',
      ts.approvedAt ? fmt(ts.approvedAt) : '',
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([tsHeaders, ...tsRows]);
    ws2['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Weekly lines');

    if (employeeSummary.length > 0) {
      const empHeaders = ['Employee', 'Employee ID', 'Role', 'Total Hours', 'Timesheets', 'Approved', 'Submitted'];
      const empRows = employeeSummary.map(e => [
        e.name,
        e.employeeId || '',
        e.role,
        e.total.toFixed(1),
        e.count,
        e.approved,
        e.submitted,
      ]);
      const ws3 = XLSX.utils.aoa_to_sheet([empHeaders, ...empRows]);
      ws3['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'By employee');
    }

    const detailHeaders = ['Employee', 'Week Start', 'Project', 'Task', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Total'];
    const detailRows: any[] = [];
    filtered.forEach(ts => {
      (ts.entries || []).forEach((entry: any) => {
        detailRows.push([
          ts.employee?.name || '',
          fmt(ts.weekStartDate),
          entry.task?.project?.name || '',
          entry.task?.name || '',
          Number(entry.monday || 0),
          Number(entry.tuesday || 0),
          Number(entry.wednesday || 0),
          Number(entry.thursday || 0),
          Number(entry.friday || 0),
          Number(entry.saturday || 0),
          Number(entry.sunday || 0),
          Number(entry.totalHours || 0),
        ]);
      });
    });
    if (detailRows.length > 0) {
      const ws4 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
      ws4['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, ...Array(8).fill({ wch: 7 })];
      XLSX.utils.book_append_sheet(wb, ws4, 'Daily details');
    }

    const fileName = `vThink_ManagerReport_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Download started');
  }, [
    filtered,
    employeeSummary,
    totalHours,
    approved,
    submitted,
    draftCount,
    rejectedCount,
    uniqueEmps,
    reportType,
    statusFilter,
    periodLabelForExport,
    dateFrom,
    dateTo,
    empFilter,
    projFilter,
    search,
    employees,
    projects,
    user?.role,
    notInitiatedRows,
    notInitiatedUniqueEmployees,
  ]);

  return (
    <div className="p-6 space-y-5" style={{ background: 'var(--page-bg)', minHeight: '100%' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-indigo-800 font-medium mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Overview
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Timesheets</span> <span>›</span>
            <span className="text-slate-600 font-medium">Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]" style={{ letterSpacing: '-0.02em' }}>
            Timesheet reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
            <strong>Manager / admin view</strong> — filter by week, month, custom range, status, employee, and project.
            Export includes weekly and monthly rollups plus line-level and daily detail sheets.
          </p>
        </div>
        <button
          onClick={exportExcel}
          disabled={
            statusFilter === 'NOT_INITIATED'
              ? !dateFrom || !dateTo
              : filtered.length === 0
          }
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
          }}
        >
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 px-4 py-3 flex items-start gap-3">
        <Building2 className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
        <p className="text-sm text-violet-950/90">
          {ROLE_REPORT_HINT[user?.role || ''] || 'Scoped timesheet data for your role.'} Employees use{' '}
          <strong>Reports</strong> from their own menu for a personal export only.
        </p>
      </div>

      {statusFilter === 'NOT_INITIATED' && (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm text-amber-950/90"
          role="status"
        >
          <strong>Not initiated</strong> compares each <strong>Monday week start</strong> in your date range with
          timesheet records. Employees with no row for that week are listed (unlike <strong>Draft</strong>, where a
          timesheet exists but was not submitted). Set <strong>From</strong> and <strong>to</strong> to define which
          weeks to scan — required for this report.
        </div>
      )}

      {statusFilter !== 'NOT_INITIATED' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon;
            const active = reportType === rt.id;
            return (
              <button
                key={rt.id}
                onClick={() => setReportType(rt.id)}
                className="p-3.5 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: active ? rt.color : 'var(--border-mid)',
                  background: active ? `color-mix(in srgb, ${rt.color} 14%, var(--card-bg))` : 'var(--card-bg)',
                }}
              >
                <Icon className="w-4 h-4 mb-2" style={{ color: rt.color }} />
                <div className="text-xs font-semibold text-[var(--text-1)]">{rt.label}</div>
                <div className="text-xs text-slate-400 mt-0.5 leading-tight">{rt.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 space-y-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Period (week start dates)</div>
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

        <div className="flex flex-col xl:flex-row xl:items-end gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setPeriodPreset('custom');
              }}
              className="px-3 py-2 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setPeriodPreset('custom');
              }}
              className="px-3 py-2 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatus(e.target.value as ReportStatusFilter)}
            className="pl-3 pr-8 py-2.5 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700 cursor-pointer min-w-[220px]"
          >
            {STATUS_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.hint ? ` — ${o.hint}` : ''}
              </option>
            ))}
          </select>

          {isAdmin && (
            <select
              value={empFilter}
              onChange={e => setEmpFilter(e.target.value)}
              className="pl-3 pr-8 py-2.5 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700 cursor-pointer min-w-[200px]"
            >
              <option value="ALL">All employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={projFilter}
            onChange={e => setProjFilter(e.target.value)}
            disabled={statusFilter === 'NOT_INITIATED'}
            title={statusFilter === 'NOT_INITIATED' ? 'Project filter does not apply to not initiated gaps' : undefined}
            className="pl-3 pr-8 py-2.5 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-slate-700 cursor-pointer min-w-[200px] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <option value="ALL">All projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or employee ID…"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm bg-slate-50 border border-[var(--border)] outline-none text-[var(--text-1)] placeholder-slate-400"
            />
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium xl:ml-auto"
            >
              <X className="w-3.5 h-3.5" /> Reset filters
            </button>
          )}

          <span className="text-xs text-slate-400 xl:ml-auto">
            {filtered.length} week{filtered.length !== 1 ? 's' : ''} match
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
                label: 'Not initiated (gaps)',
                value: notInitiatedRows.length,
                icon: AlertCircle,
                color: '#D97706',
              },
              {
                label: 'Employees with a gap',
                value: notInitiatedUniqueEmployees,
                icon: Users,
                color: '#8B5CF6',
              },
              {
                label: 'Draft in range',
                value: draftWeeksInRange,
                icon: FileText,
                color: 'var(--text-2)',
              },
            ]
          : [
              { label: 'Total hours', value: `${totalHours.toFixed(1)}h`, icon: Clock, color: 'var(--primary)' },
              { label: 'Approved', value: approved, icon: CheckCircle2, color: '#10B981' },
              { label: 'Submitted', value: submitted, icon: AlertCircle, color: '#F59E0B' },
              { label: 'Employees', value: uniqueEmps, icon: Users, color: '#8B5CF6' },
            ]
        ).map(s => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 flex items-center gap-4"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${s.color} 22%, var(--card-bg))` }}
              >
                <Icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--text-1)]" style={{ letterSpacing: '-0.02em' }}>
                  {s.value}
                </div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-12 text-center text-slate-400">
          <div className="animate-pulse">Loading report data…</div>
        </div>
      ) : statusFilter === 'NOT_INITIATED' ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-[var(--text-1)]">Not initiated — no timesheet for week</h3>
            <span className="ml-auto text-xs text-slate-400">{notInitiatedRows.length} rows</span>
          </div>
          {!dateFrom || !dateTo ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              Set <strong>From</strong> and <strong>to</strong> dates to scan each Monday in that range.
            </div>
          ) : notInitiatedRows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Every employee in scope has at least one timesheet record for each Monday between{' '}
              <span className="font-mono text-xs">{dateFrom}</span> and <span className="font-mono text-xs">{dateTo}</span>
              .
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-[var(--border)]">
                    {['Employee', 'Email', 'Employee ID', 'Role', 'Week start (Mon)', 'Status'].map(h => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {notInitiatedRows.map((r, i) => (
                    <tr key={`${r.employee.id}-${r.weekStart}-${i}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--text-1)] text-xs">{r.employee.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{r.employee.email || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.employee.employeeId || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {String(r.employee.role || '').replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-700">{r.weekStart}</td>
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
      ) : (
        <>
          {(reportType === 'employee' || reportType === 'summary') && employeeSummary.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-semibold text-[var(--text-1)]">Hours by employee</h3>
                <span className="ml-auto text-xs text-slate-400">{employeeSummary.length} employees</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[var(--border)]">
                      {['Employee', 'Role', 'Total hours', 'Timesheets', 'Approved', 'Submitted', 'Utilisation'].map(h => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {employeeSummary.map((e, i) => {
                      const pct = e.count ? Math.round((e.approved / e.count) * 100) : 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-primary">
                                {e.name[0]}
                              </div>
                              <div>
                                <div className="font-semibold text-[var(--text-1)] text-xs">{e.name}</div>
                                <div className="text-xs text-slate-400">{e.employeeId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{e.role.replace('_', ' ')}</td>
                          <td className="px-4 py-3 font-bold text-[var(--text-1)]">{e.total.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-slate-600">{e.count}</td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-md"
                              style={{
                                background: 'color-mix(in srgb, var(--success) 22%, var(--card-bg))',
                                color: 'var(--success)',
                              }}
                            >
                              {e.approved}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-md"
                              style={{
                                background: 'color-mix(in srgb, var(--warning) 22%, var(--card-bg))',
                                color: 'var(--warning)',
                              }}
                            >
                              {e.submitted}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full max-w-20">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    background: pct > 80 ? '#10B981' : pct > 50 ? '#F59E0B' : '#EF4444',
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(reportType === 'project' || reportType === 'summary') && projectSummary.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-500" />
                <h3 className="text-sm font-semibold text-[var(--text-1)]">Hours by project</h3>
              </div>
              <div className="p-5 space-y-3">
                {projectSummary.map((p, i) => {
                  const maxH = projectSummary[0]?.hours || 1;
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <div className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded text-primary bg-primary-tint truncate">
                          {p.code}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 w-32 truncate shrink-0">{p.name}</div>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(p.hours / maxH) * 100}%`,
                            background: 'linear-gradient(90deg, var(--primary), #8B5CF6)',
                          }}
                        />
                      </div>
                      <div className="text-sm font-bold text-[var(--text-1)] w-16 text-right">{p.hours.toFixed(1)}h</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {reportType === 'pending' && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-[var(--text-1)]">Submitted — awaiting approval</h3>
                <span
                  className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: 'color-mix(in srgb, var(--warning) 24%, var(--card-bg))',
                    color: 'var(--warning)',
                  }}
                >
                  {filtered.filter(t => isSubmittedTimesheetStatus(t.status)).length} submitted
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[var(--border)]">
                      {['Employee', 'Week', 'Hours', 'Submitted', 'Days waiting'].map(h => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filtered
                      .filter(t => isSubmittedTimesheetStatus(t.status))
                      .map(ts => {
                        const days = Math.floor(
                          (Date.now() - new Date(ts.submittedAt || ts.createdAt).getTime()) / 86400000
                        );
                        return (
                          <tr key={ts.id} className="hover:bg-[var(--nav-hover-bg)] transition-colors">
                            <td className="px-4 py-3 font-semibold text-[var(--text-1)] text-xs">{ts.employee?.name}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{fmt(ts.weekStartDate)}</td>
                            <td className="px-4 py-3 font-bold">{Number(ts.totalHours).toFixed(1)}h</td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {ts.submittedAt ? fmt(ts.submittedAt) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-md"
                                style={{
                                  background:
                                    days > 3
                                      ? 'color-mix(in srgb, var(--danger) 22%, var(--card-bg))'
                                      : 'color-mix(in srgb, var(--warning) 22%, var(--card-bg))',
                                  color: days > 3 ? 'var(--danger)' : 'var(--warning)',
                                }}
                              >
                                {days}d
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    {filtered.filter(t => isSubmittedTimesheetStatus(t.status)).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          No submitted timesheets in the current filter set.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(reportType === 'detailed' || reportType === 'summary') && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-[var(--text-1)]">All timesheets (weekly rows)</h3>
                </div>
                <span className="text-xs text-slate-400">{filtered.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[var(--border)]">
                      {['Employee', 'Week start', 'Week end', 'Hours', 'Status', 'Submitted', 'Approved by'].map(h => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filtered.map(ts => {
                      const stKey = normalizeReportTimesheetStatus(ts.status) || 'DRAFT';
                      const sc = STATUS_STYLES[stKey] || STATUS_STYLES.DRAFT;
                      return (
                        <tr key={ts.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                {ts.employee?.name?.[0] || '?'}
                              </div>
                              <span className="font-medium text-[var(--text-1)] text-xs">{ts.employee?.name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{fmt(ts.weekStartDate)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{fmt(ts.weekEndDate)}</td>
                          <td className="px-4 py-3 font-bold text-[var(--text-1)]">
                            {Number(ts.totalHours).toFixed(1)}h
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-md"
                              style={{
                                background: `color-mix(in srgb, ${sc.color} 22%, var(--card-bg))`,
                                color: sc.color,
                              }}
                            >
                              {reportStatusDisplayLabel(ts.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {ts.submittedAt ? fmt(ts.submittedAt) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{ts.approvedBy?.name || '—'}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">
                          No timesheets match your filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
