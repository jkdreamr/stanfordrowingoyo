export const TIME_ZONE = 'America/Los_Angeles';
export function today(now = new Date()): string { return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function addDays(date: string, days: number): string { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function weekStart(date = today()): string { const day = new Date(date + 'T12:00:00Z').getUTCDay(); return addDays(date, -((day + 6) % 7)); }
export interface DateRange { start: string; end: string }
export function weekRange(date = today()): DateRange { const start = weekStart(date); return { start, end: addDays(start, 6) }; }
export function seasonRange(date = today(), seasonStart = '09-01'): DateRange { const year = Number(date.slice(0, 4)) - (date.slice(5) < seasonStart ? 1 : 0); return { start: year + '-' + seasonStart, end: addDays((year + 1) + '-' + seasonStart, -1) }; }
export function yearRange(year: number): DateRange { return { start: year + '-01-01', end: year + '-12-31' }; }
