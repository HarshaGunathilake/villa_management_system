// Times of day are stored as 24-hour "HH:MM" strings and shown as "2:00 PM".

/** Minutes after midnight. Understands "14:00" and "2:00 PM". */
export function toMinutes(time: string | undefined | null): number | null {
  if (!time) return null;
  const m = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const half = m[3]?.toLowerCase();
  if (half === "pm" && h < 12) h += 12;
  if (half === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function fromMinutes(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function normalizeTime(time: string | undefined | null, fallback: string) {
  const minutes = toMinutes(time);
  return minutes === null ? fallback : fromMinutes(minutes);
}

/** "14:00" becomes "2:00 PM" */
export function fmtTime(time: string | undefined | null) {
  const minutes = toMinutes(time);
  if (minutes === null) return time ?? "";
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Every half hour from 5:00 AM to 11:30 PM, for the time pickers. */
export const TIME_OPTIONS = Array.from({ length: 38 }, (_, i) => fromMinutes(300 + i * 30));

export const DEFAULT_CHECK_IN = "14:00";
export const DEFAULT_CHECK_OUT = "11:00";
