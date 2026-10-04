"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, PageHeader } from "@/components/app-shell";
import { MonthNav } from "@/components/month-nav";
import { isActive } from "@/lib/availability";
import { monthKey } from "@/lib/dates";
import { monthSummary } from "@/lib/finance";
import { useStore } from "@/lib/store";
import { money } from "@/lib/utils";

export default function MoneyPage() {
  const store = useStore();
  const { today, bookings } = store;
  const [month, setMonth] = useState(monthKey(today));
  const m = monthSummary(store, month);
  const occupancy = m.totalRoomNights > 0 ? Math.round((m.occupiedNights / m.totalRoomNights) * 100) : 0;
  const toCollect = bookings.filter(isActive).reduce((sum, b) => sum + Math.max(b.total - b.paid, 0), 0);
  const isCurrent = month === monthKey(today);

  return (
    <div>
      <PageHeader title="Money" subtitle="A simple look at the month" />
      <MonthNav value={month} onChange={setMonth} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6">
          <div className="text-lg text-muted">Revenue</div>
          <div className="tnum mt-1 text-[2rem] leading-tight font-semibold">{money(m.revenue)}</div>
          <p className="mt-2 text-[0.9375rem] text-muted">What guests pay for the nights in this month{isCurrent ? ", including nights still to come" : ""}.</p>
        </Card>
        <Card className="p-6">
          <div className="text-lg text-muted">Expenses</div>
          <div className="tnum mt-1 text-[2rem] leading-tight font-semibold">{money(m.expenses)}</div>
          <p className="mt-2 text-[0.9375rem] text-muted">
            Everything you added under{" "}
            <Link href="/expenses" className="font-medium text-brass-deep underline underline-offset-4">
              Expenses
            </Link>
            .
          </p>
        </Card>
        <Card className={`p-6 ${m.profit >= 0 ? "border-sage/40 bg-sage-soft" : "border-clay/30 bg-clay-soft"}`}>
          <div className="text-lg">Estimated profit</div>
          <div className={`tnum mt-1 text-[2rem] leading-tight font-semibold ${m.profit >= 0 ? "text-sage-deep" : "text-clay"}`}>{money(m.profit)}</div>
          <p className="mt-2 text-[0.9375rem]">Revenue minus expenses.</p>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Bookings", value: m.bookings },
            { label: "Occupied nights", value: m.occupiedNights },
            { label: "Available room nights", value: m.availableNights },
          ].map((s) => (
            <div key={s.label}>
              <div className="tnum text-[2rem] leading-tight font-semibold sm:text-4xl">{s.value}</div>
              <div className="text-muted">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="flex h-3 overflow-hidden rounded-full bg-well" role="img" aria-label={`${occupancy}% of room nights are booked`}>
            <div className="h-full rounded-full bg-dusk" style={{ width: `${occupancy}%` }} />
          </div>
          <p className="mt-2 text-muted">
            {occupancy}% of the month is booked. A room night is one room for one night, so a night with the entire villa booked counts every room.
          </p>
        </div>
      </Card>

      {toCollect > 0 ? (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <div className="text-lg font-medium">Still to collect from guests</div>
            <p className="text-muted">Balances on all bookings that are not fully paid.</p>
          </div>
          <div className="tnum text-[2rem] leading-tight font-semibold text-amber-deep">{money(toCollect)}</div>
        </Card>
      ) : null}
    </div>
  );
}
