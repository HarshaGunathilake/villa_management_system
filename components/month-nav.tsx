"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, fmtMonthLong } from "@/lib/dates";

export function MonthNav({ value, onChange, max }: { value: string; onChange: (key: string) => void; max?: string }) {
  const btn = "grid size-11 place-items-center rounded-full border border-line-strong bg-card hover:bg-well disabled:opacity-35";
  return (
    <div className="mb-6 flex items-center gap-3">
      <button type="button" className={btn} onClick={() => onChange(addMonths(value, -1))} aria-label="Previous month">
        <ChevronLeft className="size-5" />
      </button>
      <div className="min-w-44 text-center text-xl font-semibold" aria-live="polite">
        {fmtMonthLong(value)}
      </div>
      <button type="button" className={btn} onClick={() => onChange(addMonths(value, 1))} disabled={max ? value >= max : false} aria-label="Next month">
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
