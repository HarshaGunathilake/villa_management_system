"use client";

import { useId } from "react";
import { AlertCircle, ChevronDown, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkTimes, findNeighbours, type StayRequest } from "@/lib/availability";
import { fmtDay } from "@/lib/dates";
import { useLookups, useStore } from "@/lib/store";
import { fmtTime, normalizeTime, TIME_OPTIONS } from "@/lib/times";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A plain dropdown of half-hour times. Familiar on a phone and on a computer. */
export function TimeSelect({ id, value, onChange, className }: { id?: string; value: string; onChange: (value: string) => void; className?: string }) {
  const current = normalizeTime(value, TIME_OPTIONS[0]);
  const options = TIME_OPTIONS.includes(current) ? TIME_OPTIONS : [...TIME_OPTIONS, current].sort();
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="tnum min-h-12 w-full appearance-none rounded-xl border border-line-strong bg-card pr-10 pl-4 text-lg font-medium text-ink focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none"
      >
        {options.map((t) => (
          <option key={t} value={t}>
            {fmtTime(t)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}

export interface StayTimesValue {
  checkInTime?: string;
  checkOutTime?: string;
}

/**
 * Check-in and check-out times for one booking. Next to each time it shows any
 * other booking that leaves or arrives on the same day, so the owner can see
 * what an early check-in or a late check-out would run into.
 */
export function StayTimes({
  request,
  ignoreId,
  value,
  onChange,
}: {
  request: StayRequest;
  /** When editing, the booking itself */
  ignoreId?: string;
  value: StayTimesValue;
  onChange: (value: StayTimesValue) => void;
}) {
  const { bookings, villa } = useStore();
  const inId = useId();
  const outId = useId();

  const checkInTime = value.checkInTime || villa.checkInTime;
  const checkOutTime = value.checkOutTime || villa.checkOutTime;
  const custom = checkInTime !== villa.checkInTime || checkOutTime !== villa.checkOutTime;
  const { leaving, arriving } = findNeighbours(request, bookings, ignoreId);
  const clash = checkTimes({ ...request, checkInTime, checkOutTime }, bookings, villa, ignoreId);

  // Only keep a time on the booking when it differs from the villa's usual one.
  const set = (next: { checkInTime: string; checkOutTime: string }) =>
    onChange({
      checkInTime: next.checkInTime === villa.checkInTime ? undefined : next.checkInTime,
      checkOutTime: next.checkOutTime === villa.checkOutTime ? undefined : next.checkOutTime,
    });

  return (
    <div className="rounded-card border border-line bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold">Check-in and check-out times</h2>
        {custom ? (
          <Button variant="ghost" size="sm" className="-my-1 -mr-2 text-brass-deep" onClick={() => onChange({})}>
            Use the usual times
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-[0.9375rem] text-muted">
        Usually {fmtTime(villa.checkInTime)} and {fmtTime(villa.checkOutTime)}. A change here is for this booking only.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={inId} className="mb-1.5 block font-medium">
            Check-in from <span className="font-normal text-muted">({fmtDay(request.checkIn)})</span>
          </label>
          <TimeSelect id={inId} value={checkInTime} onChange={(t) => set({ checkInTime: t, checkOutTime })} />
          {leaving.map((b) => (
            <Neighbour key={b.id} booking={b} kind="leaving" clash={!clash.ok && clash.reason === "early_check_in" && clash.conflicts.includes(b)} />
          ))}
        </div>
        <div>
          <label htmlFor={outId} className="mb-1.5 block font-medium">
            Check-out by <span className="font-normal text-muted">({fmtDay(request.checkOut)})</span>
          </label>
          <TimeSelect id={outId} value={checkOutTime} onChange={(t) => set({ checkInTime, checkOutTime: t })} />
          {arriving.map((b) => (
            <Neighbour key={b.id} booking={b} kind="arriving" clash={!clash.ok && clash.reason === "late_check_out" && clash.conflicts.includes(b)} />
          ))}
        </div>
      </div>

      {!clash.ok ? (
        <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-clay/30 bg-clay-soft p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-clay" />
          <div>
            <p className="font-semibold">{clash.title}</p>
            <p className="text-[0.9375rem]">{clash.message}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Another booking that leaves or arrives on the same day. */
function Neighbour({ booking, kind, clash }: { booking: Booking; kind: "leaving" | "arriving"; clash: boolean }) {
  const { openBooking } = useStore();
  const { guestName, placeName, checkInTime, checkOutTime } = useLookups();
  const Icon = kind === "arriving" ? LogIn : LogOut;
  return (
    <button
      type="button"
      onClick={() => openBooking(booking.id)}
      className={cn(
        "mt-2 flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left",
        clash ? "border-clay/40 bg-clay-soft" : "border-line bg-sand hover:bg-well",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", clash ? "text-clay" : "text-amber-deep")} aria-hidden />
      <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
        <span className="block font-semibold">
          {guestName(booking.guestId)} {kind === "arriving" ? `checks in at ${checkInTime(booking)}` : `checks out at ${checkOutTime(booking)}`}
        </span>
        <span className="block text-muted">
          Same day. {placeName(booking)}, {fmtDay(booking.checkIn)} – {fmtDay(booking.checkOut)}
        </span>
      </span>
      <span className="text-sm font-medium text-brass-deep">View</span>
    </button>
  );
}
