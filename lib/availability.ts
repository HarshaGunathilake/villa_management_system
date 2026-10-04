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
 */

export interface StayRequest {
  type: BookingType;
  roomId?: string;
  checkIn: string;
  checkOut: string;
}

export type Availability =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_dates" | "villa_booked" | "rooms_booked" | "room_booked" | "room_disabled";
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

export function checkAvailability(
  req: StayRequest,
  bookings: Booking[],
  rooms: Room[],
  ignoreId?: string,
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
  if (conflicts.length === 0) return { ok: true };

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
