import { isActive } from "./availability";
import { addDays, daysInMonth, monthKey, nightsBetween } from "./dates";
import type { AppData } from "./types";

export interface MonthSummary {
  /** Value of every night stayed (or booked) in this month */
  revenue: number;
  expenses: number;
  profit: number;
  bookings: number;
  occupiedNights: number;
  availableNights: number;
  totalRoomNights: number;
}

/**
 * A plain-language monthly summary. A booking that crosses two months is split
 * night by night, and an entire-villa night counts as every room being occupied.
 */
export function monthSummary(data: AppData, key: string): MonthSummary {
  const roomCount = data.rooms.filter((r) => r.enabled).length;
  let revenue = 0;
  let occupiedNights = 0;
  let bookings = 0;

  for (const b of data.bookings) {
    if (!isActive(b)) continue;
    const nights = nightsBetween(b.checkIn, b.checkOut);
    if (nights <= 0) continue;
    let inMonth = 0;
    for (let i = 0; i < nights; i++) {
      if (monthKey(addDays(b.checkIn, i)) === key) inMonth += 1;
    }
    if (inMonth === 0) continue;
    bookings += 1;
    revenue += (b.total / nights) * inMonth;
    occupiedNights += inMonth * (b.type === "villa" ? roomCount : 1);
  }

  const expenses = data.expenses.filter((e) => monthKey(e.date) === key).reduce((sum, e) => sum + e.amount, 0);
  const totalRoomNights = roomCount * daysInMonth(key);

  return {
    revenue: Math.round(revenue),
    expenses,
    profit: Math.round(revenue) - expenses,
    bookings,
    occupiedNights,
    availableNights: Math.max(totalRoomNights - occupiedNights, 0),
    totalRoomNights,
  };
}
