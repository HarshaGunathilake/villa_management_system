"use client";

import { useState } from "react";
import { BedDouble, ChevronLeft, ChevronRight, Home, Lock } from "lucide-react";
import { PageHeader, useStartBooking } from "@/components/app-shell";
import { StateIcons } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bookingPhase, isActive } from "@/lib/availability";
import { addDays, fmtDay, fmtRange, fmtWeekday, fromISO, nightsBetween } from "@/lib/dates";
import { useLookups, useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS = 14;

interface Segment {
  key: string;
  from: string;
  to: string;
  kind: "booked" | "arriving" | "completed" | "blocked-villa" | "blocked-rooms";
  booking?: Booking;
  title: string;
  sub: string;
}

const kindStyle: Record<Segment["kind"], string> = {
  booked: "bg-dusk text-white",
  arriving: "bg-amber-soft text-amber-deep ring-1 ring-inset ring-amber",
  completed: "bg-stone-soft text-[#5f5a52]",
  "blocked-villa": "hatch-clay text-clay",
  "blocked-rooms": "hatch-stone text-muted",
};

const kindIcon = {
  booked: StateIcons.booked,
  arriving: StateIcons.arriving,
  completed: StateIcons.completed,
  "blocked-villa": Lock,
  "blocked-rooms": Lock,
};

export default function CalendarPage() {
  const { today, bookings, rooms, openBooking } = useStore();
  const { guestName, placeName } = useLookups();
  const startBooking = useStartBooking();
  const [start, setStart] = useState(() => addDays(today, -1));
  const end = addDays(start, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));

  const visible = bookings.filter((b) => isActive(b) && b.checkIn < end && b.checkOut >= start);
  const villaBookings = visible.filter((b) => b.type === "villa");

  const asSegment = (b: Booking, sub: string): Segment => {
    const phase = bookingPhase(b, today);
    const kind = phase === "completed" ? "completed" : b.checkIn === today && b.status === "confirmed" ? "arriving" : "booked";
    return { key: b.id, from: b.checkIn, to: b.checkOut, kind, booking: b, title: guestName(b.guestId), sub };
  };

  // The villa row shows whole-villa bookings, plus the stretches where rooms are let individually.
  const roomSpans = mergeSpans(visible.filter((b) => b.type === "room"));
  const villaRow: Segment[] = [
    ...villaBookings.map((b) => asSegment(b, "Entire Villa")),
    ...roomSpans.map((s, i) => ({ key: `rooms-${i}`, from: s.from, to: s.to, kind: "blocked-rooms" as const, title: "Rooms booked", sub: "Villa not available" })),
  ];

  const rows = [
    { id: "villa", name: "Entire Villa", icon: Home, enabled: true, segments: villaRow },
    ...rooms.map((r) => ({
      id: r.id,
      name: r.name.replace(/ Room$/, ""),
      icon: BedDouble,
      enabled: r.enabled,
      segments: [
        ...visible.filter((b) => b.roomId === r.id).map((b) => asSegment(b, placeName(b))),
        ...villaBookings.map((b) => ({ key: `v-${b.id}`, from: b.checkIn, to: b.checkOut, kind: "blocked-villa" as const, booking: b, title: "Villa booked", sub: guestName(b.guestId) })),
      ],
    })),
  ];

  return (
    <div>
      <PageHeader title="Calendar" subtitle={fmtRange(start, addDays(end, -1))} />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, -7))} aria-label="Earlier week" className="px-3">
          <ChevronLeft />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setStart(addDays(today, -1))}>
          Today
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, 7))} aria-label="Later week" className="px-3">
          <ChevronRight />
        </Button>
        <span className="ml-auto text-sm text-muted lg:hidden">Swipe for more days</span>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-card shadow-card">
        <div className="[--col:3.25rem] [--label:5.75rem] sm:[--col:3.75rem] sm:[--label:7.25rem]" style={{ minWidth: `calc(var(--label) + ${DAYS} * var(--col))` }}>
          {/* Day headings */}
          <div className="flex border-b border-line">
            <div className="sticky left-0 z-20 w-(--label) shrink-0 border-r border-line bg-card" />
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}>
              {days.map((d, i) => (
                <div key={d} className={cn("py-2.5 text-center", d === today && "bg-brass-soft/60")}>
                  <div className="text-xs text-muted">{fmtWeekday(d)}</div>
                  <div className={cn("tnum text-lg leading-tight font-semibold", d === today && "text-brass-deep")}>{fromISO(d).getDate()}</div>
                  <div className="text-xs text-muted">{d === today ? "Today" : i === 0 || fromISO(d).getDate() === 1 ? fmtDay(d).split(" ")[0] : "\u00a0"}</div>
                </div>
              ))}
            </div>
          </div>

          {rows.map((row, ri) => (
            <div key={row.id} className={cn("flex", ri > 0 && "border-t border-line", ri === 0 && "bg-sand/50")}>
              <div
                className={cn("sticky left-0 z-20 flex w-(--label) shrink-0 items-center gap-2 border-r border-line px-3 text-[0.9375rem] leading-tight font-semibold", ri === 0 ? "bg-[#fbfaf7]" : "bg-card")}
              >
                <row.icon className={cn("hidden size-5 shrink-0 sm:block", ri === 0 ? "text-brass-deep" : "text-muted")} aria-hidden />
                {row.name}
              </div>
              <div className="relative h-[4.5rem] flex-1">
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}>
                  {days.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      disabled={!row.enabled}
                      onClick={() => startBooking(row.id === "villa" ? { mode: "villa", checkIn: d } : { mode: "room", roomId: row.id, checkIn: d })}
                      aria-label={`${row.name}, ${fmtDay(d)}. New booking`}
                      className={cn("h-full hover:bg-sage-soft/70 focus-visible:z-10", i > 0 && "border-l border-line/70", d === today && "bg-brass-soft/30", !row.enabled && "hatch-stone")}
                    />
                  ))}
                </div>
                {row.enabled
                  ? row.segments.map((s) => {
                      const offset = nightsBetween(start, s.from) + 0.5;
                      const left = Math.max(offset, 0);
                      const right = Math.min(offset + nightsBetween(s.from, s.to), DAYS);
                      if (right <= left) return null;
                      const Icon = kindIcon[s.kind];
                      const narrow = right - left < 1.6;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          disabled={!s.booking}
                          onClick={() => s.booking && openBooking(s.booking.id)}
                          aria-label={`${s.title}, ${s.sub}, ${fmtRange(s.from, s.to)}`}
                          className={cn(
                            "absolute top-2 bottom-2 z-10 flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 text-left",
                            offset < 0 && "rounded-l-none",
                            offset + nightsBetween(s.from, s.to) > DAYS && "rounded-r-none",
                            kindStyle[s.kind],
                          )}
                          style={{ left: `calc(${(left / DAYS) * 100}% + 2px)`, width: `calc(${((right - left) / DAYS) * 100}% - 4px)` }}
                        >
                          <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                          <span className="min-w-0">
                            <span className="block truncate text-[0.9375rem] leading-tight font-semibold">{narrow ? s.title.split(" ")[0] : s.title}</span>
                            {narrow ? null : <span className="block truncate text-xs leading-tight opacity-80">{s.sub}</span>}
                          </span>
                        </button>
                      );
                    })
                  : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-[0.9375rem]" aria-label="What the colours mean">
        <Legend className="border border-dashed border-sage bg-sage-soft text-sage-deep" icon={StateIcons.available} label="Available" note="tap an empty day to book it" />
        <Legend className={kindStyle.booked} icon={kindIcon.booked} label="Booked" />
        <Legend className={kindStyle.arriving} icon={kindIcon.arriving} label="Check-in today" />
        <Legend className={kindStyle.completed} icon={kindIcon.completed} label="Completed" />
        <Legend className={kindStyle["blocked-villa"]} icon={Lock} label="Unavailable" note="entire villa is booked" />
        <Legend className={kindStyle["blocked-rooms"]} icon={Lock} label="Villa unavailable" note="rooms are booked" />
      </ul>
    </div>
  );
}

function Legend({ className, icon: Icon, label, note }: { className: string; icon: React.ComponentType<{ className?: string }>; label: string; note?: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("grid h-7 w-9 place-items-center rounded-md", className)}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="font-medium">{label}</span>
        {note ? <span className="text-muted">, {note}</span> : null}
      </span>
    </li>
  );
}

function mergeSpans(list: Booking[]) {
  const sorted = [...list].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const spans: { from: string; to: string }[] = [];
  for (const b of sorted) {
    const last = spans[spans.length - 1];
    if (last && b.checkIn <= last.to) last.to = b.checkOut > last.to ? b.checkOut : last.to;
    else spans.push({ from: b.checkIn, to: b.checkOut });
  }
  return spans;
}
