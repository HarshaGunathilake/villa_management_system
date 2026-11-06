"use client";

import { useState } from "react";
import { cn, money } from "@/lib/utils";

export const SHORT_MONTH = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" });

/** Monthly card income as bars; hover or focus a bar to read its month. */
export function IncomeBars({ months, byMonth, countByMonth, thisMonth, label = "Card payments received in each of the last six months" }: { months: string[]; byMonth: Map<string, number>; countByMonth: Map<string, number>; thisMonth: string; label?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const peak = Math.max(1, ...byMonth.values());
  const shown = active ?? thisMonth;
  return (
    <div className="mt-5">
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-8">
          {[1, 0.5, 0].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
          ))}
        </div>
        <ol className="relative flex h-56 items-end gap-1 sm:gap-6" aria-label={label}>
          {months.map((m) => {
            const value = byMonth.get(m)!;
            const current = m === shown;
            return (
              <li key={m} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <button
                  type="button"
                  onMouseEnter={() => setActive(m)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(m)}
                  onBlur={() => setActive(null)}
                  aria-label={`${SHORT_MONTH(m)}: ${money(value)} from ${countByMonth.get(m)} payments`}
                  className="flex h-[calc(100%-2rem)] w-full items-end justify-center rounded-t-lg focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span
                    className={cn("w-full max-w-14 rounded-t-lg transition-colors", current ? "bg-[#0b5d50]" : "bg-[#b9d6cf]")}
                    style={{ height: `${Math.max(value > 0 ? 4 : 1.5, (value / peak) * 100)}%` }}
                  />
                </button>
                <span aria-hidden className={cn("mt-2 h-6 text-[0.6875rem] sm:text-sm", current ? "font-semibold" : "text-muted")}>
                  {SHORT_MONTH(m)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-sand px-4 py-3" aria-live="polite">
        <span className="font-semibold">{new Date(`${shown}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
        <span className="tnum font-display text-lg font-bold">{money(byMonth.get(shown) ?? 0)}</span>
        <span className="text-sm text-muted">
          from {countByMonth.get(shown) ?? 0} {(countByMonth.get(shown) ?? 0) === 1 ? "payment" : "payments"}
        </span>
      </div>
    </div>
  );
}
