"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { EmptyState, PageHeader, useStartBooking } from "@/components/app-shell";
import { BookingCard } from "@/components/booking-bits";
import { Button } from "@/components/ui/button";
import { bookingPhase } from "@/lib/availability";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "current", label: "Current" },
  { id: "completed", label: "Completed" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function BookingsPage() {
  const { bookings, today } = useStore();
  const startBooking = useStartBooking();
  const [tab, setTab] = useState<Tab>("upcoming");

  const groups = {
    upcoming: bookings.filter((b) => bookingPhase(b, today) === "upcoming").sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    current: bookings.filter((b) => bookingPhase(b, today) === "current").sort((a, b) => a.checkOut.localeCompare(b.checkOut)),
    completed: bookings
      .filter((b) => ["completed", "cancelled"].includes(bookingPhase(b, today)))
      .sort((a, b) => b.checkOut.localeCompare(a.checkOut)),
  };
  const list = groups[tab];

  return (
    <div>
      <PageHeader
        title="Bookings"
        action={
          <Button className="hidden lg:inline-flex" onClick={() => startBooking()}>
            <Plus /> New booking
          </Button>
        }
      />

      <div role="tablist" aria-label="Bookings" className="mb-6 grid grid-cols-3 rounded-2xl bg-well p-1.5 sm:inline-grid sm:min-w-[28rem]">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "min-h-12 rounded-xl px-1 text-[0.9375rem] font-medium whitespace-nowrap text-muted transition-colors sm:px-3 sm:text-base",
              tab === t.id && "bg-card text-ink shadow-card",
            )}
          >
            {t.label} <span className="tnum ml-0.5 text-sm font-normal text-muted">{groups[t.id].length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={tab === "upcoming" ? "No upcoming bookings" : tab === "current" ? "Nobody is staying right now" : "No completed stays yet"}
          action={
            tab !== "completed" ? (
              <Button onClick={() => startBooking()}>
                <Plus /> New booking
              </Button>
            ) : undefined
          }
        >
          {tab === "upcoming" ? "New bookings will show up here." : undefined}
        </EmptyState>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {list.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}
