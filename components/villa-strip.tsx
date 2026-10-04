"use client";

import { ChevronRight, Home, Lock } from "lucide-react";
import { useStartBooking } from "@/components/app-shell";
import { Badge, StateIcons } from "@/components/ui/badge";
import { isActive, roomNight, villaNight } from "@/lib/availability";
import { fmtDay } from "@/lib/dates";
import { useLookups, useStore } from "@/lib/store";
import { cn, money, plural } from "@/lib/utils";

/**
 * The villa drawn as it is sold: one band for the whole house sitting on top of
 * its rooms. Whatever is booked fills in, and whatever that blocks is hatched.
 */
export function VillaStrip({ date }: { date: string }) {
  const { bookings, rooms, villa, openBooking, today } = useStore();
  const { guestName } = useLookups();
  const startBooking = useStartBooking();
  const { villa: villaBooking, roomBookings } = villaNight(date, bookings);
  const isToday = date === today;
  const night = isToday ? "tonight" : "that night";

  return (
    <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      {/* Entire villa */}
      {villaBooking ? (
        <button
          type="button"
          onClick={() => openBooking(villaBooking.id)}
          className="flex w-full items-center gap-4 bg-dusk px-5 py-4 text-left text-white"
        >
          <Home className="size-6 shrink-0" aria-hidden />
          <span className="flex-1">
            <span className="block text-sm text-white/75">Entire villa, booked</span>
            <span className="block text-xl leading-tight font-semibold">{guestName(villaBooking.guestId)}</span>
            <span className="block text-sm text-white/75">
              {fmtDay(villaBooking.checkIn)} – {fmtDay(villaBooking.checkOut)}
            </span>
          </span>
          <ChevronRight className="size-5 text-white/70" aria-hidden />
        </button>
      ) : roomBookings.length > 0 ? (
        <div className="hatch-stone flex items-center gap-4 px-5 py-4">
          <Home className="size-6 shrink-0 text-muted" aria-hidden />
          <div className="flex-1">
            <div className="font-semibold">Entire villa</div>
            <div className="text-[0.9375rem] text-muted">
              Can&apos;t be booked whole {night}. {plural(roomBookings.length, "room has", "rooms have")} guests.
            </div>
          </div>
          <Badge tone="stone" icon={Lock} className="hidden sm:inline-flex">Not available</Badge>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => startBooking({ mode: "villa", checkIn: date })}
          className="flex w-full items-center gap-4 bg-sage-soft px-5 py-4 text-left hover:bg-[#dcebe1]"
        >
          <Home className="size-6 shrink-0 text-sage-deep" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold">Entire villa</span>
            <span className="block text-[0.9375rem] text-sage-deep">
              Free {night}. {money(villa.price)} a night, up to {villa.maxGuests} guests.
            </span>
          </span>
          <Badge tone="sage" icon={StateIcons.available} className="bg-white">Available</Badge>
        </button>
      )}

      {/* Rooms */}
      <div className="grid divide-y divide-line border-t border-line sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:divide-x sm:divide-y-0">
        {rooms.map((room) => {
          const state = room.enabled ? roomNight(room.id, date, bookings) : null;
          const leaving = bookings.find(
            (b) => isActive(b) && b.checkOut === date && (b.type === "villa" || b.roomId === room.id) && b.status !== "checked_out",
          );
          const base = "flex min-h-[5.5rem] w-full items-center gap-3 px-5 py-4 text-left sm:min-h-32 sm:flex-col sm:items-start sm:justify-between";

          if (!state) {
            return (
              <div key={room.id} className={cn(base, "bg-well/60 text-muted")}>
                <div className="flex-1 font-semibold">{room.name}</div>
                <Badge tone="stone">Not in use</Badge>
              </div>
            );
          }

          if (state.state === "villa") {
            return (
              <div key={room.id} className={cn(base, "hatch-clay")}>
                <div className="flex-1">
                  <div className="font-semibold">{room.name}</div>
                  <div className="text-[0.9375rem] text-clay">Part of the villa booking</div>
                </div>
                <Badge tone="clay" icon={Lock} className="bg-white/80">Unavailable</Badge>
              </div>
            );
          }

          if (state.state === "booked") {
            const b = state.booking;
            const arriving = b.checkIn === date && b.status === "confirmed";
            return (
              <button key={room.id} type="button" onClick={() => openBooking(b.id)} className={cn(base, "bg-dusk-soft/60 hover:bg-dusk-soft")}>
                <span className="flex-1">
                  <span className="block text-sm text-muted">{room.name}</span>
                  <span className="block text-lg leading-tight font-semibold">{guestName(b.guestId)}</span>
                  <span className="block text-[0.9375rem] text-muted">
                    {arriving ? `Arrives ${isToday ? "today" : fmtDay(date)}, ${villa.checkInTime}` : `Staying until ${fmtDay(b.checkOut)}`}
                  </span>
                </span>
                {arriving ? (
                  <Badge tone="amber" icon={StateIcons.arriving}>Check-in today</Badge>
                ) : (
                  <Badge tone="dusk" icon={StateIcons.booked}>Booked</Badge>
                )}
              </button>
            );
          }

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => startBooking({ mode: "room", roomId: room.id, checkIn: date })}
              className={cn(base, "hover:bg-sand/70")}
            >
              <span className="flex-1">
                <span className="block text-lg leading-tight font-semibold">{room.name}</span>
                <span className="block text-[0.9375rem] text-muted">
                  {leaving ? `${guestName(leaving.guestId)} checks out ${villa.checkOutTime}` : `${money(room.price)} a night`}
                </span>
              </span>
              <Badge tone="sage" icon={StateIcons.available}>Available</Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
