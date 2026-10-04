"use client";

import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import type { BookingExtra } from "@/lib/types";
import { cn, money } from "@/lib/utils";

/** Add amenities (BBQ, meals, pickup) to a booking by tapping plus. */
export function ExtrasPicker({ value, onChange }: { value: BookingExtra[]; onChange: (extras: BookingExtra[]) => void }) {
  const { amenities } = useStore();
  // Offer what is switched on, and keep showing anything already on the booking.
  const offered = amenities.filter((a) => a.enabled || value.some((e) => e.amenityId === a.id));
  const orphaned = value.filter((e) => !amenities.some((a) => a.id === e.amenityId));
  const rows: Omit<BookingExtra, "qty">[] = [
    ...offered.map((a) => ({ amenityId: a.id, name: a.name, price: a.price, unit: a.unit })),
    ...orphaned.map(({ amenityId, name, price, unit }) => ({ amenityId, name, price, unit })),
  ];

  const setQty = (row: (typeof rows)[number], qty: number) => {
    const existing = value.find((e) => e.amenityId === row.amenityId);
    const rest = value.filter((e) => e.amenityId !== row.amenityId);
    // An amenity already on the booking keeps the price it was added at.
    onChange(qty <= 0 ? rest : [...rest, existing ? { ...existing, qty } : { ...row, qty }]);
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line-strong p-4 text-muted">
        No amenities yet. Add things like a BBQ or meals in{" "}
        <Link href="/amenities" className="font-medium text-brass-deep underline underline-offset-4">
          Amenities
        </Link>
        .
      </p>
    );
  }

  const btn = "grid size-11 place-items-center rounded-full border border-line-strong bg-card text-ink hover:bg-well disabled:opacity-35";
  return (
    <div className="divide-y divide-line rounded-card border border-line bg-card px-5">
      {rows.map((row) => {
        const picked = value.find((e) => e.amenityId === row.amenityId);
        const qty = picked?.qty ?? 0;
        const price = picked?.price ?? row.price;
        return (
          <div key={row.amenityId} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className={cn("font-medium", qty > 0 && "font-semibold")}>{row.name}</div>
              <div className="tnum text-sm text-muted">
                {money(price)} {row.unit}
                {qty > 0 ? <span className="font-medium text-ink">. {money(price * qty)} added</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <button type="button" className={btn} disabled={qty <= 0} onClick={() => setQty(row, qty - 1)} aria-label={`Fewer ${row.name}`}>
                <Minus className="size-5" />
              </button>
              <span className="tnum w-6 text-center text-lg font-semibold" aria-live="polite">
                {qty}
              </span>
              <button type="button" className={btn} onClick={() => setQty(row, qty + 1)} aria-label={`Add ${row.name}`}>
                <Plus className="size-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
