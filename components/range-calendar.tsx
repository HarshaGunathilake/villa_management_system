"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, daysInMonth, fmtMonthLong, fromISO, monthKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  /** Nights that already have a booking, shown crossed out. They can still be tapped so the reason can be explained. */
  isTaken?: (date: string) => boolean;
  today: string;
}

/** Tap the arrival day, then the departure day. */
export function RangeCalendar({ checkIn, checkOut, onChange, isTaken, today }: Props) {
  const [view, setView] = useState(monthKey(checkIn || today));
  const first = `${view}-01`;
  const lead = (fromISO(first).getDay() + 6) % 7; // Monday first
  const days = Array.from({ length: daysInMonth(view) }, (_, i) => addDays(first, i));

  const pick = (d: string) => {
    if (!checkIn || checkOut || d <= checkIn) onChange(d, "");
    else onChange(checkIn, d);
  };

  return (
    <div className="rounded-card border border-line bg-card p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setView(addMonths(view, -1))} className="grid size-11 place-items-center rounded-full hover:bg-well" aria-label="Previous month">
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-lg font-semibold" aria-live="polite">
          {fmtMonthLong(view)}
        </div>
        <button type="button" onClick={() => setView(addMonths(view, 1))} className="grid size-11 place-items-center rounded-full hover:bg-well" aria-label="Next month">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-sm text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {days.map((d) => {
          const isStart = d === checkIn;
          const isEnd = d === checkOut;
          const inRange = checkIn && checkOut && d > checkIn && d < checkOut;
          const taken = isTaken?.(d) ?? false;
          const past = d < today;
          return (
            <div
              key={d}
              className={cn(
                "relative h-12",
                inRange && "bg-brass-soft",
                isStart && checkOut && "rounded-l-full bg-gradient-to-r from-transparent from-50% to-brass-soft to-50%",
                isEnd && "rounded-r-full bg-gradient-to-l from-transparent from-50% to-brass-soft to-50%",
              )}
            >
              <button
                type="button"
                onClick={() => pick(d)}
                aria-label={`${d}${taken ? ", already booked" : ""}${isStart ? ", check-in" : ""}${isEnd ? ", check-out" : ""}`}
                aria-pressed={isStart || isEnd}
                data-date={d}
                className={cn(
                  "tnum relative mx-auto grid size-12 place-items-center rounded-full text-[1.0625rem] font-medium transition-colors",
                  !isStart && !isEnd && "hover:bg-well",
                  past && !isStart && !isEnd && "text-muted/60",
                  taken && !isStart && !isEnd && "text-clay/80",
                  (isStart || isEnd) && "bg-ink text-white",
                  d === today && !isStart && !isEnd && "ring-1 ring-line-strong",
                )}
              >
                {fromISO(d).getDate()}
                {taken && !isStart && !isEnd ? (
                  <span aria-hidden className="absolute top-1/2 left-1/2 h-px w-7 -translate-x-1/2 -rotate-45 bg-clay/70" />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      {isTaken ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span className="relative inline-block size-5">
            <span className="absolute top-1/2 left-0 h-px w-5 -rotate-45 bg-clay/70" />
          </span>
          Crossed-out days are already booked
        </p>
      ) : null}
    </div>
  );
}
