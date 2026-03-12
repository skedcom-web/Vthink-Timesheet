import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Download, Users, Clock, CheckCircle2, FileText,
  Search, Filter, X, TrendingUp, AlertCircle, ChevronDown,
  Calendar, User, ArrowLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { timesheetsApi, usersApi, projectsApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const fmt     = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: '#F1F5F9', text: '#64748B' },
  SUBMITTED: { bg: '#FFFBEB', text: '#B45309' },
  APPROVED:  { bg: '#ECFDF5', text: '#065F46' },
  REJECTED:  { bg: '#FEF2F2', text: '#991B1B' },
};

type ReportType = 'summary' | 'employee' | 'project' | 'pending' | 'detailed';

const REPORT_TYPES: { id: ReportType; label: string; icon: any; desc: string; color: string }[] = [
  { id: 'summary',  label: 'Summary Report',  icon: BarChart3,   desc: 'High-level overview of all timesheets',      color: '#6366F1' },
  { id: 'employee', label: 'Employee Report',  icon: User,        desc: 'Hours logged per employee breakdown',        color: '#8B5CF6' },
  { id: 'project',  label: 'Project Report',   icon: FileText,    desc: 'Timesheet distribution across projects',     color: '#06B6D4' },
  { id: 'pending',  label: 'Pending Report',   icon: AlertCircle, desc: 'All submitted timesheets awaiting approval', color: '#F59E0B' },
  { id: 'detailed', label: 'Detailed Report',  icon: Clock,       desc: 'Full breakdown with daily entry details',    color: '#10B981' },
];

export default function Reports({ onBack }: { onBack: () => void }) {
  const { user } = useAuthStore();
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [projects, setProjects]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('ALL');
  const [empFilter, setEmpFilter]   = useState('ALL');
  const [projFilter, setProjFilter] = useState('ALL');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER'].includes(user?.role || '');

  useEffect(() => {
    Promise.allSettled([
      timesheetsApi.getAll(),
      isAdmin ? usersApi.getAll() : Promise.resolve([]),
      projectsApi.getAll(),
    ]).then(([ts, us, pr]) => {
      if (ts.status === 'fulfilled') setTimesheets(ts.value || []);
      if (us.status === 'fulfilled') setEmployees(us.value || []);
      if (pr.status === 'fulfilled') setProjects(pr.value || []);
    }).finally(() => setLoading(false));
  }, [isAdmin]);

  // Filtered data
  const filtered = timesheets.filter(ts => {
    if (statusFilter !== 'ALL' && ts.status !== statusFilter) return false;
    if (empFilter !== 'ALL' && ts.employeeId !== empFilter) return false;
    if (projFilter !== 'ALL' && !ts.entries?.some((e: any) => e.projectId === projFilter)) return false;
    if (dateFrom && fmtDate(ts.weekStartDate) < dateFrom) return false;
    if (dateTo   && fmtDate(ts.weekStartDate) > dateTo)   return false;
    if (search) {
      const q = search.toLowerCase();
      return ts.employee?.name?.toLowerCase().includes(q) || ts.status?.toLowerCase().includes(q);
    }
    return true;
  });

  // Stats from filtered
  const totalHours  = filtered.reduce((s, t) => s + Number(t.totalHours || 0), 0);
  const approved    = filtered.filter(t => t.status === 'APPROVED').length;
  const submitted   = filtered.filter(t => t.status === 'SUBMITTED').length;
  const uniqueEmps  = new Set(filtered.map(t => t.employeeId)).size;

  // Employee summary
  const employeeSummary = employees
    .filter(e => empFilter === 'ALL' || e.id === empFilter)
    .map(e => {
      const empTs = filtered.filter(t => t.employeeId === e.id);
      return {
        name: e.name, role: e.role, employeeId: e.employeeId,
        total: empTs.reduce((s, t) => s + Number(t.totalHours || 0), 0),
        count: empTs.length,
        approved: empTs.filter(t => t.status === 'APPROVED').length,
        pending: empTs.filter(t => t.status === 'SUBMITTED').length,
      };
    }).filter(e => e.count > 0)
    .sort((a, b) => b.total - a.total);

  // Project summary
  const projectSummary = projects.map(p => {
    const hours = filtered.reduce((sum, ts) => {
      const entries = ts.entries?.filter((e: any) => e.projectId === p.id) || [];
      return sum + entries.reduce((s: number, e: any) => s + Number(e.totalHours || 0), 0);
    }, 0);
    return { code: p.code, name: p.name, hours, status: p.status };
  }).filter(p => p.hours > 0).sort((a, b) => b.hours - a.hours);

  const clearFilters = () => {
    setStatus('ALL'); setEmpFilter('ALL'); setProjFilter('ALL');
    setDateFrom(''); setDateTo(''); setSearch('');
  };
  const activeFilters = [statusFilter, empFilter, projFilter, dateFrom, dateTo].filter(v => v && v !== 'ALL').length;

  // ---- Excel export ----
  const exportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['vThink Timesheet Report', '', '', ''],
      ['Generated', new Date().toLocaleString(), '', ''],
      ['Report Type', REPORT_TYPES.find(r => r.id === reportType)?.label || '', '', ''],
      ['Filters', statusFilter !== 'ALL' ? `Status: ${statusFilter}` : 'None', '', ''],
      [],
      ['SUMMARY', '', '', ''],
      ['Total Hours', totalHours.toFixed(1), '', ''],
      ['Total Timesheets', filtered.length, '', ''],
      ['Approved', approved, '', ''],
      ['Pending Review', submitted, '', ''],
      ['Unique Employees', uniqueEmps, '', ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // Sheet 2: All Timesheets
    const tsHeaders = ['Employee', 'Employee ID', 'Week Start', 'Week End', 'Total Hours', 'Status', 'Submitted At', 'Approved At'];
    const tsRows = filtered.map(ts => [
      ts.employee?.name || '',
      ts.employee?.employeeId || '',
      fmt(ts.weekStartDate),
      fmt(ts.weekEndDate),
      Number(ts.totalHours).toFixed(1),
      ts.status,
      ts.submittedAt ? fmt(ts.submittedAt) : '',
      ts.approvedAt ? fmt(ts.approvedAt) : '',
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([tsHeaders, ...tsRows]);
    ws2['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Timesheets');

    // Sheet 3: Employee Summary
    if (employeeSummary.length > 0) {
      const empHeaders = ['Employee', 'Employee ID', 'Role', 'Total Hours', 'Timesheets', 'Approved', 'Pending'];
      const empRows = employeeSummary.map(e => [e.name, e.employeeId || '', e.role, e.total.toFixed(1), e.count, e.approved, e.pending]);
      const ws3 = XLSX.utils.aoa_to_sheet([empHeaders, ...empRows]);
      ws3['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'By Employee');
    }

    // Sheet 4: Detailed entries
    const detailHeaders = ['Employee', 'Week Start', 'Project', 'Task', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Total'];
    const detailRows: any[] = [];
    filtered.forEach(ts => {
      (ts.entries || []).forEach((entry: any) => {
        detailRows.push([
          ts.employee?.name || '',
          fmt(ts.weekStartDate),
          entry.task?.project?.name || '',
          entry.task?.name || '',
          Number(entry.monday || 0), Number(entry.tuesday || 0), Number(entry.wednesday || 0),
          Number(entry.thursday || 0), Number(entry.friday || 0),
          Number(entry.saturday || 0), Number(entry.sunday || 0),
          Number(entry.totalHours || 0),
        ]);
      });
    });
    if (detailRows.length > 0) {
      const ws4 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
      ws4['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, ...Array(8).fill({ wch: 7 })];
      XLSX.utils.book_append_sheet(wb, ws4, 'Daily Details');
    }

    const fileName = `vThink_Report_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [filtered, employeeSummary, totalHours, approved, submitted, uniqueEmps, reportType, statusFilter]);

  return (
    <div className="p-6 space-y-5" style={{ background: '#F8FAFC', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Overview
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Timesheets</span> <span>›</span>
            <span className="text-slate-600 font-medium">Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Analyze, filter and export timesheet data</p>
        </div>
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg shrink-0"
          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
        >
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          const active = reportType === rt.id;
          return (
            <button key={rt.id} onClick={() => setReportType(rt.id)}
              className="p-3.5 rounded-xl border-2 text-left transition-all"
              style={{
                borderColor: active ? rt.color : '#E2E8F0',
                background: active ? rt.color + '08' : '#FFFFFF',
              }}
            >
              <Icon className="w-4 h-4 mb-2" style={{ color: rt.color }} />
              <div className="text-xs font-semibold text-slate-800">{rt.label}</div>
              <div className="text-xs text-slate-400 mt-0.5 leading-tight">{rt.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Search + Filters bar */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by employee name..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm bg-slate-50 border border-slate-100 outline-none text-slate-900 placeholder-slate-400"
              onFocus={e => (e.currentTarget.style.borderColor = '#6366F1')}
              onBlur={e => (e.currentTarget.style.borderColor = '#F1F5F9')}
            />
          </div>

          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            className="pl-3 pr-8 py-2.5 rounded-lg text-sm bg-slate-50 border border-slate-100 outline-none text-slate-700 cursor-pointer">
            <option value="ALL">All Statuses</option>
            {['DRAFT','SUBMITTED','APPROVED','REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {isAdmin && (
            <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
              className="pl-3 pr-8 py-2.5 rounded-lg text-sm bg-slate-50 border border-slate-100 outline-none text-slate-700 cursor-pointer">
              <option value="ALL">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}

          <button onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors"
            style={{ borderColor: activeFilters ? '#6366F1' : '#E2E8F0', color: activeFilters ? '#6366F1' : '#64748B', background: activeFilters ? '#EEF2FF' : '#FFFFFF' }}>
            <Filter className="w-4 h-4" />
            Filters {activeFilters > 0 && <span className="bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilters}</span>}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {activeFilters > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm bg-slate-50 border border-slate-100 outline-none text-slate-700"
                onFocus={e => (e.currentTarget.style.borderColor = '#6366F1')}
                onBlur={e => (e.currentTarget.style.borderColor = '#F1F5F9')}
              />
              <span className="text-slate-400 text-xs">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm bg-slate-50 border border-slate-100 outline-none text-slate-700"
                onFocus={e => (e.currentTarget.style.borderColor = '#6366F1')}
                onBlur={e => (e.currentTarget.style.borderColor = '#F1F5F9')}
              />
            </div>
            <select value={projFilter} onChange={e => setProjFilter(e.target.value)}
              className="pl-3 pr-8 py-2 rounded-lg text-sm bg-slate-50 border border-slate-100 outline-none text-slate-700">
              <option value="ALL">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, icon: Clock, color: '#6366F1', bg: '#EEF2FF' },
          { label: 'Approved', value: approved, icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' },
          { label: 'Pending Review', value: submitted, icon: AlertCircle, color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Employees', value: uniqueEmps, icon: Users, color: '#8B5CF6', bg: '#F5F3FF' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                <Icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Report content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
          <div className="animate-pulse">Loading report data...</div>
        </div>
      ) : (
        <>
          {/* Employee Report */}
          {(reportType === 'employee' || reportType === 'summary') && employeeSummary.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-semibold text-slate-900">Hours by Employee</h3>
                <span className="ml-auto text-xs text-slate-400">{employeeSummary.length} employees</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Employee', 'Role', 'Total Hours', 'Timesheets', 'Approved', 'Pending', 'Utilisation'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {employeeSummary.map((e, i) => {
                      const pct = e.count ? Math.round((e.approved / e.count) * 100) : 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                                {e.name[0]}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 text-xs">{e.name}</div>
                                <div className="text-xs text-slate-400">{e.employeeId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{e.role.replace('_', ' ')}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{e.total.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-slate-600">{e.count}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: '#ECFDF5', color: '#065F46' }}>{e.approved}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: '#FFFBEB', color: '#B45309' }}>{e.pending}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full max-w-20">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 80 ? '#10B981' : pct > 50 ? '#F59E0B' : '#EF4444' }} />
                              </div>
                              <span className="text-xs text-slate-500">{pct}%</span>
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

          {/* Project Report */}
          {(reportType === 'project' || reportType === 'summary') && projectSummary.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-500" />
                <h3 className="text-sm font-semibold text-slate-900">Hours by Project</h3>
              </div>
              <div className="p-5 space-y-3">
                {projectSummary.map((p, i) => {
                  const maxH = projectSummary[0]?.hours || 1;
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <div className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded text-indigo-600 bg-indigo-50 truncate">{p.code}</div>
                      </div>
                      <div className="text-xs text-slate-600 w-32 truncate shrink-0">{p.name}</div>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(p.hours / maxH) * 100}%`, background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' }} />
                      </div>
                      <div className="text-sm font-bold text-slate-900 w-16 text-right">{p.hours.toFixed(1)}h</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Report */}
          {reportType === 'pending' && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">Pending Approvals</h3>
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#FFFBEB', color: '#B45309' }}>
                  {filtered.filter(t => t.status === 'SUBMITTED').length} pending
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Employee', 'Week', 'Hours', 'Submitted', 'Days Waiting'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.filter(t => t.status === 'SUBMITTED').map(ts => {
                      const days = Math.floor((Date.now() - new Date(ts.submittedAt || ts.createdAt).getTime()) / 86400000);
                      return (
                        <tr key={ts.id} className="hover:bg-amber-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900 text-xs">{ts.employee?.name}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{fmt(ts.weekStartDate)}</td>
                          <td className="px-4 py-3 font-bold">{Number(ts.totalHours).toFixed(1)}h</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{ts.submittedAt ? fmt(ts.submittedAt) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: days > 3 ? '#FEF2F2' : '#FFFBEB', color: days > 3 ? '#991B1B' : '#B45309' }}>
                              {days}d
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.filter(t => t.status === 'SUBMITTED').length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        All timesheets are reviewed. Great work!
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed / All Timesheets table */}
          {(reportType === 'detailed' || reportType === 'summary') && (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-900">All Timesheets</h3>
                </div>
                <span className="text-xs text-slate-400">{filtered.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Employee', 'Week Start', 'Week End', 'Hours', 'Status', 'Submitted', 'Approved By'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(ts => {
                      const sc = STATUS_STYLES[ts.status] || STATUS_STYLES.DRAFT;
                      return (
                        <tr key={ts.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                                {ts.employee?.name?.[0] || '?'}
                              </div>
                              <span className="font-medium text-slate-900 text-xs">{ts.employee?.name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{fmt(ts.weekStartDate)}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{fmt(ts.weekEndDate)}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{Number(ts.totalHours).toFixed(1)}h</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={sc}>{ts.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{ts.submittedAt ? fmt(ts.submittedAt) : '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{ts.approvedBy?.name || '—'}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">
                        No timesheets match your filters
                      </td></tr>
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
