"use client";

import Link from "next/link";
import { LogIn, LogOut, Plus, Receipt, UserPlus } from "lucide-react";
import { Card, SectionTitle, useStartBooking } from "@/components/app-shell";
import { BookingRow } from "@/components/booking-bits";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { VillaStrip } from "@/components/villa-strip";
import { bookingPhase, coversNight, guestCount, isActive, roomNight } from "@/lib/availability";
import { fmtDay, fmtLong, fmtMonthLong, monthKey } from "@/lib/dates";
import { monthSummary } from "@/lib/finance";
import { PHOTOS } from "@/lib/photos";
import { useLookups, useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { money, plural } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const store = useStore();
  const { today, villa, bookings, rooms, expenses } = store;

  const active = bookings.filter(isActive);
  const arrivals = active.filter((b) => b.checkIn === today);
  const departures = active.filter((b) => b.checkOut === today);
  const staying = active.filter((b) => coversNight(b, today));
  const usableRooms = rooms.filter((r) => r.enabled);
  const freeRooms = usableRooms.filter((r) => roomNight(r.id, today, bookings).state === "available").length;
  const pending = active.filter((b) => b.total - b.paid > 0).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const pendingTotal = pending.reduce((sum, b) => sum + (b.total - b.paid), 0);
  const upcoming = active.filter((b) => bookingPhase(b, today) === "upcoming").sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const month = monthSummary(store, monthKey(today));
  const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  const stats = [
    { label: "Check-ins", value: String(arrivals.length), note: "today" },
    { label: "Check-outs", value: String(departures.length), note: "today" },
    { label: "Guests staying", value: String(staying.reduce((sum, b) => sum + guestCount(b), 0)), note: "tonight" },
    { label: "Rooms available", value: `${freeRooms} / ${usableRooms.length}`, note: "tonight" },
  ];

  return (
    <div>
      <header className="relative mb-6 overflow-hidden rounded-3xl sm:mb-8">
        <Photo src={PHOTOS.villa} alt={`${villa.name} seen from the pool`} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/5" />
        <div className="relative flex min-h-52 flex-col justify-end p-5 text-white sm:min-h-60 sm:p-8">
          <h1 className="text-[1.875rem] leading-tight font-semibold sm:text-[2.5rem]">
            {greeting()}, {villa.ownerName}
          </h1>
          <p className="mt-1 text-lg text-white/85">
            {villa.name}, {fmtLong(today)}
          </p>
        </div>
      </header>

      <section aria-label="Today in numbers" className="mb-8 grid grid-cols-2 overflow-hidden rounded-card border border-line bg-card shadow-card sm:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`p-5 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
            <div className="text-muted">{s.label}</div>
            <div className="tnum mt-1 text-[2.5rem] leading-none font-semibold">{s.value}</div>
            <div className="mt-1 text-sm text-muted">{s.note}</div>
          </div>
        ))}
      </section>

      <section className="mb-8">
        <SectionTitle>Villa availability today</SectionTitle>
        <VillaStrip date={today} />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <section>
            <SectionTitle>Today&apos;s activity</SectionTitle>
            {arrivals.length + departures.length === 0 ? (
              <Card className="p-5 text-muted">A quiet day. Nobody is checking in or out.</Card>
            ) : (
              <div className="space-y-3">
                {departures.map((b) => (
                  <ActivityCard key={b.id} booking={b} kind="out" />
                ))}
                {arrivals.map((b) => (
                  <ActivityCard key={b.id} booking={b} kind="in" />
                ))}
              </div>
            )}
          </section>

          <QuickActions className="lg:hidden" />

          <section>
            <SectionTitle
              action={
                <Link href="/bookings" className="font-medium text-brass-deep underline-offset-4 hover:underline">
                  All bookings
                </Link>
              }
            >
              Upcoming bookings
            </SectionTitle>
            <Card className="divide-y divide-line overflow-hidden">
              {upcoming.length === 0 ? (
                <p className="p-5 text-muted">Nothing booked yet. Tap New booking to add one.</p>
              ) : (
                upcoming.slice(0, 4).map((b) => (
                  <BookingRow key={b.id} booking={b} right={<span className="tnum shrink-0 text-sm text-muted">{plural(guestCount(b), "guest")}</span>} />
                ))
              )}
            </Card>
          </section>
        </div>

        <div className="space-y-8">
          <QuickActions className="hidden lg:block" />

          <section>
            <SectionTitle>Payments pending</SectionTitle>
            <Card className="overflow-hidden">
              {pending.length === 0 ? (
                <p className="p-5 text-muted">Every booking is fully paid.</p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-4">
                    <span className="text-muted">Still to collect</span>
                    <span className="tnum text-2xl font-semibold">{money(pendingTotal)}</span>
                  </div>
                  <div className="divide-y divide-line">
                    {pending.slice(0, 4).map((b) => (
                      <BookingRow key={b.id} booking={b} right={<span className="tnum shrink-0 font-semibold text-amber-deep">{money(b.total - b.paid)}</span>} />
                    ))}
                  </div>
                </>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle
              action={
                <Link href="/money" className="font-medium text-brass-deep underline-offset-4 hover:underline">
                  See details
                </Link>
              }
            >
              {fmtMonthLong(monthKey(today)).split(" ")[0]} so far
            </SectionTitle>
            <Card className="p-5">
              <div className="flex items-baseline justify-between py-1.5">
                <span className="text-muted">Revenue</span>
                <span className="tnum font-medium">{money(month.revenue)}</span>
              </div>
              <div className="flex items-baseline justify-between py-1.5">
                <span className="text-muted">Expenses</span>
                <span className="tnum font-medium">{money(month.expenses)}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                <span className="font-medium">Estimated profit</span>
                <span className="tnum text-2xl font-semibold text-sage-deep">{money(month.profit)}</span>
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle
              action={
                <Link href="/expenses" className="font-medium text-brass-deep underline-offset-4 hover:underline">
                  All expenses
                </Link>
              }
            >
              Latest expenses
            </SectionTitle>
            <Card className="divide-y divide-line">
              {recentExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="text-sm text-muted">
                      {e.category}, {fmtDay(e.date)}
                    </div>
                  </div>
                  <div className="tnum shrink-0 font-medium">{money(e.amount)}</div>
                </div>
              ))}
              {recentExpenses.length === 0 ? <p className="p-5 text-muted">No expenses added yet.</p> : null}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function QuickActions({ className }: { className?: string }) {
  const { setExpenseFormOpen, setGuestFormOpen } = useStore();
  const startBooking = useStartBooking();
  return (
    <section className={className}>
      <SectionTitle>Quick actions</SectionTitle>
      <div className="grid gap-3">
        <Button size="lg" block onClick={() => startBooking()}>
          <Plus /> New booking
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" className="px-3" onClick={() => setExpenseFormOpen(true)}>
            <Receipt /> Add expense
          </Button>
          <Button variant="secondary" size="lg" className="px-3" onClick={() => setGuestFormOpen(true)}>
            <UserPlus /> Add guest
          </Button>
        </div>
      </div>
    </section>
  );
}

function ActivityCard({ booking, kind }: { booking: Booking; kind: "in" | "out" }) {
  const { openBooking, openCheckout, checkIn, notify } = useStore();
  const { guestName, placeName, checkInTime, checkOutTime } = useLookups();
  const name = guestName(booking.guestId);
  const done = kind === "in" ? booking.status !== "confirmed" : booking.status === "checked_out";
  const Icon = kind === "in" ? LogIn : LogOut;

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
      <span className={`grid size-12 shrink-0 place-items-center rounded-full ${kind === "in" ? "bg-amber-soft text-amber-deep" : "bg-well text-ink"}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <div className="text-sm text-muted">
          {kind === "in" ? "Check-in" : "Check-out"}, {kind === "in" ? checkInTime(booking) : checkOutTime(booking)}
        </div>
        <div className="truncate text-xl leading-tight font-semibold">{name}</div>
        <div className="text-muted">
          {placeName(booking)}, {plural(guestCount(booking), "guest")}
        </div>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => openBooking(booking.id)}>
          View booking
        </Button>
        {done ? (
          <span className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-sage-soft px-4 font-medium text-sage-deep sm:flex-none">
            {kind === "in" ? "Checked in" : "Checked out"}
          </span>
        ) : (
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => {
              // Check-out goes through the bill first: extra items, then payment.
              if (kind === "out") return openCheckout(booking.id);
              checkIn(booking.id);
              notify(`${name} checked in`);
            }}
          >
            {kind === "in" ? "Check in" : "Check out"}
          </Button>
        )}
      </div>
    </Card>
  );
}
