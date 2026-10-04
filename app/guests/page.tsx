"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app-shell";
import { Avatar } from "@/components/booking-bits";
import { guestStats } from "@/components/guest-sheets";
import { Button } from "@/components/ui/button";
import { fmtMonthShort } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { plural } from "@/lib/utils";

export default function GuestsPage() {
  const { guests, bookings, openGuest, setGuestFormOpen } = useStore();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")))
      .map((g) => ({ guest: g, ...guestStats(g.id, bookings) }))
      .sort((a, b) => (b.last?.checkIn ?? "").localeCompare(a.last?.checkIn ?? ""));
  }, [guests, bookings, query]);

  return (
    <div>
      <PageHeader
        title="Guests"
        subtitle={plural(guests.length, "guest")}
        action={
          <Button onClick={() => setGuestFormOpen(true)}>
            <UserPlus /> Add guest
          </Button>
        }
      />

      <div className="relative mb-5 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone"
          aria-label="Search guests"
          className="min-h-14 w-full rounded-xl border border-line-strong bg-card pr-4 pl-12 text-lg placeholder:text-muted/70 focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No guest found">Check the spelling, or add them as a new guest.</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card">
          {rows.map(({ guest, stays, last }) => (
            <li key={guest.id}>
              <button type="button" onClick={() => openGuest(guest.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-sand/70">
                <Avatar name={guest.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg leading-tight font-semibold">{guest.name}</span>
                  <span className="block text-muted">
                    {plural(stays.length, "stay")}
                    {last ? `, last stay ${fmtMonthShort(last.checkIn)}` : ""}
                  </span>
                </span>
                <span className="hidden text-muted sm:block">{guest.country}</span>
                <ChevronRight className="size-5 text-line-strong" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
