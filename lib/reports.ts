import { isActive } from "./availability";
import { addDays, addMonths, daysInMonth, monthKey, nightsBetween } from "./dates";
import { bookingNumber } from "./documents";
import type { AppData, Booking } from "./types";

/*
 * The villa owner's report for a run of months. Income is counted the same way
 * as on the Money page: each night is worth its share of the booking total, and
 * a booking that crosses months is split night by night. Expenses count on the
 * date they were entered for.
 */

export interface ReportMonth {
  month: string;
  income: number;
  expenses: number;
  profit: number;
  bookings: number;
  nightsBooked: number;
  occupancy: number;
}

export interface ReportBooking {
  booking: Booking;
  number: string;
  nightsInPeriod: number;
  incomeInPeriod: number;
}

export interface VillaReport {
  from: string;
  to: string;
  months: ReportMonth[];
  income: number;
  expenses: number;
  profit: number;
  /** Booked room nights / available room nights, 0–100 */
  occupancy: number;
  /** Nights with at least one guest */
  nightsBooked: number;
  /** Income per booked night */
  averageNight: number;
  bookings: ReportBooking[];
  bySource: { label: string; value: number }[];
  byPlace: { label: string; value: number }[];
  byCategory: { label: string; value: number }[];
  /** Balances still owed on bookings in the period */
  toCollect: number;
}

const sorted = (m: Map<string, number>) =>
  [...m.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

/** `from` and `to` are month keys (YYYY-MM), both included. */
export function buildReport(data: AppData, from: string, to: string): VillaReport {
  const keys: string[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) keys.push(k);
  const roomCount = Math.max(data.rooms.filter((r) => r.enabled).length, 1);
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));
  const order = new Map(data.bookings.map((b, i) => [b.id, i]));

  const months = new Map(keys.map((k) => [k, { income: 0, expenses: 0, bookings: new Set<string>(), roomNights: 0, nights: new Set<string>() }]));
  const bySource = new Map<string, number>();
  const byPlace = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const bookings: ReportBooking[] = [];
  const nightsWithGuests = new Set<string>();

  for (const b of data.bookings) {
    if (!isActive(b)) continue;
    const nights = nightsBetween(b.checkIn, b.checkOut);
    if (nights <= 0) continue;
    const perNight = b.total / nights;
    let count = 0;
    for (let i = 0; i < nights; i++) {
      const day = addDays(b.checkIn, i);
      const m = months.get(monthKey(day));
      if (!m) continue;
      count += 1;
      m.income += perNight;
      m.bookings.add(b.id);
      m.roomNights += b.type === "villa" ? roomCount : 1;
      m.nights.add(day);
      nightsWithGuests.add(day);
    }
    if (count === 0) continue;
    const income = perNight * count;
    bySource.set(b.source, (bySource.get(b.source) ?? 0) + income);
    const place = b.type === "villa" ? "Entire Villa" : roomName.get(b.roomId ?? "") ?? "Room";
    byPlace.set(place, (byPlace.get(place) ?? 0) + income);
    bookings.push({ booking: b, number: `BK-${bookingNumber(order.get(b.id) ?? 0)}`, nightsInPeriod: count, incomeInPeriod: Math.round(income) });
  }

  for (const e of data.expenses) {
    const m = months.get(monthKey(e.date));
    if (!m) continue;
    m.expenses += e.amount;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  let availableRoomNights = 0;
  let bookedRoomNights = 0;
  const rows: ReportMonth[] = keys.map((k) => {
    const m = months.get(k)!;
    const available = roomCount * daysInMonth(k);
    availableRoomNights += available;
    bookedRoomNights += m.roomNights;
    const income = Math.round(m.income);
    return {
      month: k,
      income,
      expenses: m.expenses,
      profit: income - m.expenses,
      bookings: m.bookings.size,
      nightsBooked: m.nights.size,
      occupancy: available > 0 ? Math.min(100, Math.round((m.roomNights / available) * 100)) : 0,
    };
  });

  const income = rows.reduce((s, r) => s + r.income, 0);
  const expenses = rows.reduce((s, r) => s + r.expenses, 0);
  bookings.sort((a, b) => a.booking.checkIn.localeCompare(b.booking.checkIn));

  return {
    from,
    to,
    months: rows,
    income,
    expenses,
    profit: income - expenses,
    occupancy: availableRoomNights > 0 ? Math.min(100, Math.round((bookedRoomNights / availableRoomNights) * 100)) : 0,
    nightsBooked: nightsWithGuests.size,
    averageNight: nightsWithGuests.size > 0 ? Math.round(income / nightsWithGuests.size) : 0,
    bookings,
    bySource: sorted(bySource),
    byPlace: sorted(byPlace),
    byCategory: sorted(byCategory),
    toCollect: bookings.reduce((s, r) => s + Math.max(r.booking.total - r.booking.paid, 0), 0),
  };
}

