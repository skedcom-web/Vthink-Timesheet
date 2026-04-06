/** All logic uses Asia/Kolkata (IST) per product default. */

export const DEFAULT_TZ = 'Asia/Kolkata';

/** YYYY-MM-DD for calendar date in IST */
export function istYmd(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: DEFAULT_TZ });
}

/** Parse YYYY-MM-DD parts in IST context */
export function istNowParts(d: Date = new Date()): { y: number; m: number; day: number } {
  const s = istYmd(d);
  const [y, m, day] = s.split('-').map(Number);
  return { y, m, day };
}

/**
 * Monday of the week containing `ref`, as YYYY-MM-DD in IST.
 * Week starts Monday (ISO-style for India operations).
 */
export function mondayYmdContainingIST(ref: Date = new Date()): string {
  const { y, m, day } = istNowParts(ref);
  const anchor = new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+05:30`);
  const wdShort = new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_TZ, weekday: 'short' }).format(anchor);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const sun0 = map[wdShort] ?? 0;
  const daysSinceMonday = (sun0 + 6) % 7;
  anchor.setDate(anchor.getDate() - daysSinceMonday);
  return istYmd(anchor);
}

/** Monday-start Date at 00:00:01 IST for DB range queries */
export function mondayStartDateIST(mondayYmd: string): Date {
  return new Date(`${mondayYmd}T00:00:01+05:30`);
}

/**
 * Weekday in IST for `ref`: 1 = Monday … 7 = Sunday (matches admin UI).
 */
export function weekdayMonFirstIST(ref: Date = new Date()): number {
  const { y, m, day } = istNowParts(ref);
  const anchor = new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+05:30`);
  const wdShort = new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_TZ, weekday: 'short' }).format(anchor);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const sun0 = map[wdShort] ?? 0;
  return sun0 === 0 ? 7 : sun0;
}

export function istHourMinute(ref: Date = new Date()): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(ref);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return { hour, minute };
}
