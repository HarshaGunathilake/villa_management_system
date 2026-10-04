// All dates in the app are plain "YYYY-MM-DD" strings in the villa's local time.
// They sort and compare correctly as strings, which keeps the booking rules simple.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso: string, days: number) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round((fromISO(checkOut).getTime() - fromISO(checkIn).getTime()) / 86_400_000);
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", opts).format(fromISO(iso));

/** Oct 10 */
export const fmtDay = (iso: string) => fmt(iso, { month: "short", day: "numeric" });
/** Sat, Oct 10 */
export const fmtDayWeek = (iso: string) => fmt(iso, { weekday: "short", month: "short", day: "numeric" });
/** 10 Oct 2026 */
export const fmtFull = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(fromISO(iso));
/** Sunday, October 4 */
export const fmtLong = (iso: string) => fmt(iso, { weekday: "long", month: "long", day: "numeric" });
/** Oct 2026 */
export const fmtMonthShort = (iso: string) => fmt(iso, { month: "short", year: "numeric" });
/** October 2026 */
export const fmtMonthLong = (key: string) => fmt(`${key}-01`, { month: "long", year: "numeric" });
/** Oct 10 – Oct 13 */
export const fmtRange = (a: string, b: string) => `${fmtDay(a)} – ${fmtDay(b)}`;
export const fmtWeekday = (iso: string) => fmt(iso, { weekday: "short" });
