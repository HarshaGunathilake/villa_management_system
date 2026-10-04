import { fmtTime, toMinutes } from "./times";
import type { Booking, BookingType, Room } from "./types";

/**
 * The booking rules for a villa that can be sold whole or room by room.
 *
 *  Rule 1  An entire-villa booking blocks every room for its dates.
 *  Rule 2  Any room booking blocks the entire villa for its dates.
 *  Rule 3  Different rooms can be booked for the same dates.
 *  Rule 4  The same room can never be booked twice for overlapping dates.
 *
 * A stay covers the nights from checkIn up to (not including) checkOut, so one
 * guest can check out on the morning another guest checks in.
 *
 *  Rule 5  On such a changeover day the leaving guest's check-out time must not
 *          be later than the arriving guest's check-in time. Each booking can
 *          have its own times; otherwise the villa's usual times apply.
 */

export interface StayRequest {
  type: BookingType;
  roomId?: string;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
}

/** The villa's usual check-in and check-out times. */
export interface UsualTimes {
  checkInTime: string;
  checkOutTime: string;
}

export type Availability =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_dates" | "villa_booked" | "rooms_booked" | "room_booked" | "room_disabled" | "late_check_out" | "early_check_in";
      title: string;
      message: string;
      conflicts: Booking[];
    };

export const isActive = (b: Booking) => b.status !== "cancelled";

export function overlaps(aIn: string, aOut: string, bIn: string, bOut: string) {
  return aIn < bOut && bIn < aOut;
}

/** Every active booking that makes the requested stay impossible. */
export function findConflicts(req: StayRequest, bookings: Booking[], ignoreId?: string) {
  return bookings.filter((b) => {
    if (!isActive(b) || b.id === ignoreId) return false;
    if (!overlaps(req.checkIn, req.checkOut, b.checkIn, b.checkOut)) return false;
    if (req.type === "villa") return true; // Rules 1 + 2: anything at all blocks the whole villa
    return b.type === "villa" || b.roomId === req.roomId; // Rules 1 + 4
  });
}

/** Does booking `b` use the same space as the requested stay? */
const sharesSpace = (req: StayRequest, b: Booking) => req.type === "villa" || b.type === "villa" || b.roomId === req.roomId;

/**
 * Bookings that touch the requested stay on its first or last day:
 * `leaving` check out on the day this stay checks in, `arriving` check in on
 * the day this stay checks out.
 */
export function findNeighbours(req: StayRequest, bookings: Booking[], ignoreId?: string) {
  const near = bookings.filter((b) => isActive(b) && b.id !== ignoreId && sharesSpace(req, b));
  return {
    leaving: near.filter((b) => b.checkOut === req.checkIn),
    arriving: near.filter((b) => b.checkIn === req.checkOut),
  };
}

export const checkInTimeOf = (b: { checkInTime?: string }, usual: UsualTimes) => b.checkInTime || usual.checkInTime;
export const checkOutTimeOf = (b: { checkOutTime?: string }, usual: UsualTimes) => b.checkOutTime || usual.checkOutTime;

/** Rule 5: times on a changeover day must not cross. */
export function checkTimes(req: StayRequest, bookings: Booking[], usual: UsualTimes, ignoreId?: string): Availability {
  const { leaving, arriving } = findNeighbours(req, bookings, ignoreId);
  const myOut = toMinutes(checkOutTimeOf(req, usual)) ?? 0;
  const myIn = toMinutes(checkInTimeOf(req, usual)) ?? 0;

  const next = arriving.filter((b) => (toMinutes(checkInTimeOf(b, usual)) ?? 0) < myOut);
  if (next.length > 0) {
    const earliest = next.map((b) => checkInTimeOf(b, usual)).sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0))[0];
    return {
      ok: false,
      reason: "late_check_out",
      title: "Check-out time is too late",
      message: `Another guest checks in that day at ${fmtTime(earliest)}. Choose a check-out time no later than that.`,
      conflicts: next,
    };
  }

  const prev = leaving.filter((b) => (toMinutes(checkOutTimeOf(b, usual)) ?? 0) > myIn);
  if (prev.length > 0) {
    const latest = prev.map((b) => checkOutTimeOf(b, usual)).sort((a, b) => (toMinutes(b) ?? 0) - (toMinutes(a) ?? 0))[0];
    return {
      ok: false,
      reason: "early_check_in",
      title: "Check-in time is too early",
      message: `Another guest checks out that day at ${fmtTime(latest)}. Choose a check-in time no earlier than that.`,
      conflicts: prev,
    };
  }

  return { ok: true };
}

export function checkAvailability(
  req: StayRequest,
  bookings: Booking[],
  rooms: Room[],
  ignoreId?: string,
  /** Pass the villa's usual times to also enforce Rule 5. */
  usual?: UsualTimes,
): Availability {
  if (!req.checkIn || !req.checkOut || req.checkOut <= req.checkIn) {
    return {
      ok: false,
      reason: "invalid_dates",
      title: "Check the dates",
      message: "Check-out must be after check-in.",
      conflicts: [],
    };
  }

  if (req.type === "room") {
    const room = rooms.find((r) => r.id === req.roomId);
    if (!room || !room.enabled) {
      return {
        ok: false,
        reason: "room_disabled",
        title: "Room not in use",
        message: "This room is switched off in Rooms. Switch it on to take bookings.",
        conflicts: [],
      };
    }
  }

  const conflicts = findConflicts(req, bookings, ignoreId);
  if (conflicts.length === 0) return usual ? checkTimes(req, bookings, usual, ignoreId) : { ok: true };

  const villaConflict = conflicts.some((b) => b.type === "villa");

  if (req.type === "villa") {
    return villaConflict
      ? {
          ok: false,
          reason: "villa_booked",
          title: "Villa unavailable",
          message: "The villa has an existing booking during these dates. Please choose different dates.",
          conflicts,
        }
      : {
          ok: false,
          reason: "rooms_booked",
          title: "Villa unavailable",
          message: "One or more rooms already have bookings during these dates.",
          conflicts,
        };
  }

  return villaConflict
    ? {
        ok: false,
        reason: "villa_booked",
        title: "Room unavailable",
        message: "The entire villa is booked for these dates, so no room can be booked.",
        conflicts,
      }
    : {
        ok: false,
        reason: "room_booked",
        title: "Room unavailable",
        message: "This room is already booked for the selected dates.",
        conflicts,
      };
}

/** Is someone sleeping here on the night of `date`? */
export const coversNight = (b: Booking, date: string) => isActive(b) && b.checkIn <= date && date < b.checkOut;

export type RoomNight =
  | { state: "available" }
  | { state: "booked"; booking: Booking }
  | { state: "villa"; booking: Booking };

/** What is happening in one room on the night of `date`. */
export function roomNight(roomId: string, date: string, bookings: Booking[]): RoomNight {
  const villa = bookings.find((b) => b.type === "villa" && coversNight(b, date));
  if (villa) return { state: "villa", booking: villa };
  const own = bookings.find((b) => b.type === "room" && b.roomId === roomId && coversNight(b, date));
  if (own) return { state: "booked", booking: own };
  return { state: "available" };
}

export function villaNight(date: string, bookings: Booking[]) {
  const villa = bookings.find((b) => b.type === "villa" && coversNight(b, date));
  const roomBookings = bookings.filter((b) => b.type === "room" && coversNight(b, date));
  return { villa, roomBookings };
}

/** True when nothing new can be sold for that night in the given scope. */
export function nightIsTaken(
  date: string,
  bookings: Booking[],
  rooms: Room[],
  scope: { type: "villa" } | { type: "room"; roomId?: string },
) {
  const { villa, roomBookings } = villaNight(date, bookings);
  if (villa) return true;
  if (scope.type === "villa") return roomBookings.length > 0;
  if (scope.roomId) return roomBookings.some((b) => b.roomId === scope.roomId);
  const usable = rooms.filter((r) => r.enabled);
  return usable.length > 0 && usable.every((r) => roomBookings.some((b) => b.roomId === r.id));
}

export function guestCount(b: Booking) {
  return b.adults + b.children;
}

export type PaymentStatus = "Paid" | "Partially paid" | "Unpaid";
export function paymentStatus(total: number, paid: number): PaymentStatus {
  if (paid >= total && total > 0) return "Paid";
  if (paid > 0) return "Partially paid";
  return "Unpaid";
}

export type BookingPhase = "upcoming" | "current" | "completed" | "cancelled";
export function bookingPhase(b: Booking, today: string): BookingPhase {
  if (b.status === "cancelled") return "cancelled";
  if (b.status === "checked_out" || b.checkOut < today) return "completed";
  if (b.status === "checked_in" || b.checkIn <= today) return "current";
  return "upcoming";
}
