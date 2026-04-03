/** Monday-start week (matches Enter Timesheet / backend week rows). */
export function mondayOfWeekContaining(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type PeriodPreset = 'all' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export function getPresetDateRange(preset: Exclude<PeriodPreset, 'custom'>): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === 'all') return { from: '', to: '' };

  if (preset === 'this_week') {
    const mon = mondayOfWeekContaining(today);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return { from: toYmd(mon), to: toYmd(sun) };
  }

  if (preset === 'last_week') {
    const mon = mondayOfWeekContaining(today);
    mon.setDate(mon.getDate() - 7);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return { from: toYmd(mon), to: toYmd(sun) };
  }

  if (preset === 'this_month') {
    const y = today.getFullYear();
    const m = today.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    return { from: toYmd(first), to: toYmd(last) };
  }

  if (preset === 'last_month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toYmd(first), to: toYmd(last) };
  }

  return { from: '', to: '' };
}

export function weekStartKey(iso: string): string {
  return String(iso).slice(0, 10);
}

/** Timesheet week start within [from, to] inclusive (YYYY-MM-DD). Empty from/to = no bound. */
export function timesheetInDateRange(
  weekStartDate: string,
  from: string,
  to: string
): boolean {
  const w = weekStartKey(weekStartDate);
  if (from && w < from) return false;
  if (to && w > to) return false;
  return true;
}

/**
 * Every Monday (week start YYYY-MM-DD) with rangeFrom <= Monday <= rangeTo.
 * Used to find employees with no timesheet row for those weeks (“not initiated”).
 * (Parameter names must not shadow the local `toYmd` date helper.)
 */
export function enumerateWeekStartsInRange(rangeFrom: string, rangeTo: string): string[] {
  if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) return [];
  const d = new Date(`${rangeFrom}T12:00:00`);
  let mon = mondayOfWeekContaining(d);
  let cur = toYmd(mon);
  if (cur < rangeFrom) {
    mon.setDate(mon.getDate() + 7);
    cur = toYmd(mon);
  }
  const out: string[] = [];
  while (cur <= rangeTo) {
    out.push(cur);
    mon.setDate(mon.getDate() + 7);
    cur = toYmd(mon);
  }
  return out;
}

export type ReportStatusFilter =
  | 'ALL'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'DRAFT'
  | 'REJECTED'
  | 'NOT_INITIATED';

/** Normalise API/enum values for comparisons (handles casing / stray whitespace). */
export function normalizeReportTimesheetStatus(status: string | undefined | null): string {
  if (status == null || status === '') return '';
  return String(status).trim().toUpperCase();
}

/** Submitted-for-approval weeks (backend enum SUBMITTED; aliases for older or external data). */
export function isSubmittedTimesheetStatus(status: string | undefined | null): boolean {
  const s = normalizeReportTimesheetStatus(status);
  return s === 'SUBMITTED' || s === 'PENDING' || s === 'PENDING_APPROVAL';
}

export function matchesReportStatus(status: string | undefined | null, filter: ReportStatusFilter): boolean {
  if (filter === 'NOT_INITIATED') return false;
  const s = normalizeReportTimesheetStatus(status);
  if (filter === 'ALL') return true;
  if (filter === 'SUBMITTED') return isSubmittedTimesheetStatus(status);
  return s === filter;
}

/** Human-readable labels for exports and tables (always show “Submitted”, not only “pending”). */
export function reportStatusDisplayLabel(status: string | undefined | null): string {
  const s = normalizeReportTimesheetStatus(status);
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    PENDING: 'Submitted',
    PENDING_APPROVAL: 'Submitted',
  };
  return map[s] || (status ? String(status).trim() : '');
}

export const STATUS_FILTER_OPTIONS: { value: ReportStatusFilter; label: string; hint?: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'Submitted', hint: 'Awaiting manager approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DRAFT', label: 'Draft', hint: 'Timesheet created, not submitted' },
  { value: 'NOT_INITIATED', label: 'Not initiated', hint: 'No timesheet for week — pick a date range' },
  { value: 'REJECTED', label: 'Rejected' },
];

/** Label for gap rows (notification / export). */
export const NOT_INITIATED_LABEL = 'Not initiated';

export const PERIOD_PRESET_LABELS: Record<Exclude<PeriodPreset, 'custom'>, string> = {
  all: 'All dates',
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'This month',
  last_month: 'Last month',
};

/** YYYY-MM from week start (for monthly rollups). */
export function monthKeyFromWeekStart(weekStartIso: string): string {
  return weekStartKey(weekStartIso).slice(0, 7);
}

export interface TimesheetLike {
  weekStartDate: string;
  totalHours?: number;
  status?: string;
  entries?: { projectId?: string }[];
}

export function aggregateHoursByWeek(timesheets: TimesheetLike[]): { week: string; hours: number; count: number }[] {
  const map = new Map<string, { hours: number; count: number }>();
  for (const ts of timesheets) {
    const k = weekStartKey(ts.weekStartDate);
    const cur = map.get(k) || { hours: 0, count: 0 };
    cur.hours += Number(ts.totalHours || 0);
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([week, v]) => ({ week, hours: v.hours, count: v.count }))
    .sort((a, b) => b.week.localeCompare(a.week));
}

export function aggregateHoursByMonth(timesheets: TimesheetLike[]): { month: string; hours: number; count: number }[] {
  const map = new Map<string, { hours: number; count: number }>();
  for (const ts of timesheets) {
    const k = monthKeyFromWeekStart(ts.weekStartDate);
    const cur = map.get(k) || { hours: 0, count: 0 };
    cur.hours += Number(ts.totalHours || 0);
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([month, v]) => ({ month, hours: v.hours, count: v.count }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
