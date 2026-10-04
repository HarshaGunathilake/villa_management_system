"use client";

import { BedDouble, Home } from "lucide-react";
import { Badge, PaymentBadge, StateIcons } from "@/components/ui/badge";
import { bookingPhase, guestCount, paymentStatus } from "@/lib/availability";
import { fmtRange, nightsBetween } from "@/lib/dates";
import { useLookups, useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { cn, money, plural } from "@/lib/utils";

export function PlaceIcon({ type, className }: { type: Booking["type"]; className?: string }) {
  const Icon = type === "villa" ? Home : BedDouble;
  return <Icon className={cn("size-5 shrink-0", type === "villa" ? "text-brass-deep" : "text-muted", className)} aria-hidden />;
}

export function PlaceLabel({ booking, className }: { booking: Pick<Booking, "type" | "roomId">; className?: string }) {
  const { placeName } = useLookups();
  return (
    <span className={cn("inline-flex items-center gap-2 font-medium", className)}>
      <PlaceIcon type={booking.type} />
      {placeName(booking)}
    </span>
  );
}

export function StatusBadge({ booking }: { booking: Booking }) {
  const { today } = useStore();
  const phase = bookingPhase(booking, today);
  if (phase === "cancelled") return <Badge tone="clay" icon={StateIcons.cancelled}>Cancelled</Badge>;
  if (phase === "completed") return <Badge tone="stone" icon={StateIcons.completed}>Completed</Badge>;
  if (booking.status === "checked_in") {
    return booking.checkOut === today ? (
      <Badge tone="amber" icon={StateIcons.leaving}>Checks out today</Badge>
    ) : (
      <Badge tone="sage" icon={StateIcons.available}>Staying now</Badge>
    );
  }
  if (booking.checkIn === today) return <Badge tone="amber" icon={StateIcons.arriving}>Checks in today</Badge>;
  if (booking.checkIn < today) return <Badge tone="amber" icon={StateIcons.arriving}>Not checked in yet</Badge>;
  return <Badge tone="dusk" icon={StateIcons.booked}>Upcoming</Badge>;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <span
      aria-hidden
      className={cn("grid size-11 shrink-0 place-items-center rounded-full bg-brass-soft font-semibold text-brass-deep", className)}
    >
      {letters}
    </span>
  );
}

/** The booking card used on the Bookings page and in lists. The whole card opens the booking. */
export function BookingCard({ booking }: { booking: Booking }) {
  const { openBooking } = useStore();
  const { guestName } = useLookups();
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const status = paymentStatus(booking.total, booking.paid);
  const balance = booking.total - booking.paid;

  return (
    <button
      type="button"
      onClick={() => openBooking(booking.id)}
      className="block w-full rounded-card border border-line bg-card p-5 text-left shadow-card transition-colors hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xl leading-tight font-semibold">{guestName(booking.guestId)}</div>
        <StatusBadge booking={booking} />
      </div>
      <div className="mt-3 space-y-1">
        <PlaceLabel booking={booking} />
        <div className="text-muted">
          {fmtRange(booking.checkIn, booking.checkOut)}
          <span className="mx-2 text-line-strong">|</span>
          {plural(nights, "night")}
          <span className="mx-2 text-line-strong">|</span>
          {plural(guestCount(booking), "guest")}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
        <div>
          <div className="tnum text-lg font-semibold">{money(booking.total)}</div>
          {status === "Paid" ? null : (
            <div className="tnum text-sm text-muted">
              Paid {money(booking.paid)}, balance <span className="font-medium text-ink">{money(balance)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{booking.source}</span>
          <PaymentBadge status={status} />
        </div>
      </div>
    </button>
  );
}

/** Compact one-line row, used on the dashboard and in guest history. */
export function BookingRow({ booking, right }: { booking: Booking; right?: React.ReactNode }) {
  const { openBooking } = useStore();
  const { guestName, placeName } = useLookups();
  return (
    <button
      type="button"
      onClick={() => openBooking(booking.id)}
      className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-sand/70"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-well">
        <PlaceIcon type={booking.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{guestName(booking.guestId)}</span>
        <span className="block truncate text-sm text-muted">
          {placeName(booking)}, {fmtRange(booking.checkIn, booking.checkOut)}
        </span>
      </span>
      {right}
    </button>
  );
}
