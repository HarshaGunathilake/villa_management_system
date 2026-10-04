"use client";

import { useState } from "react";
import { Globe, Mail, Pencil, Phone, Plus } from "lucide-react";
import { useStartBooking } from "@/components/app-shell";
import { Avatar, PlaceIcon } from "@/components/booking-bits";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { isActive } from "@/lib/availability";
import { fmtMonthShort, nightsBetween } from "@/lib/dates";
import { useLookups, useStore } from "@/lib/store";
import type { Booking, Guest } from "@/lib/types";
import { money, plural } from "@/lib/utils";

export function guestStats(guestId: string, bookings: Booking[]) {
  const stays = bookings.filter((b) => b.guestId === guestId && isActive(b)).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return {
    stays,
    spent: stays.reduce((sum, b) => sum + b.paid, 0),
    last: stays[0],
  };
}

type GuestDraft = Omit<Guest, "id">;

export function GuestFields({ value, onChange }: { value: GuestDraft; onChange: (v: GuestDraft) => void }) {
  const set = (key: keyof GuestDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="space-y-4">
      <Field label="Full name">
        {(id) => <Input id={id} value={value.name} onChange={set("name")} autoComplete="off" placeholder="e.g. Sarah Fernando" />}
      </Field>
      <Field label="Phone">
        {(id) => <Input id={id} type="tel" inputMode="tel" value={value.phone} onChange={set("phone")} autoComplete="off" placeholder="+94 77 123 4567" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" optional>
          {(id) => <Input id={id} type="email" value={value.email ?? ""} onChange={set("email")} autoComplete="off" />}
        </Field>
        <Field label="Country" optional>
          {(id) => <Input id={id} value={value.country ?? ""} onChange={set("country")} autoComplete="off" />}
        </Field>
      </div>
    </div>
  );
}

export const emptyGuest: GuestDraft = { name: "", phone: "", email: "", country: "" };
export const guestIsValid = (g: GuestDraft) => g.name.trim().length > 1 && g.phone.trim().length > 5;

export function GuestFormSheet() {
  const { guestFormOpen, setGuestFormOpen, addGuest, notify, openGuest } = useStore();
  const [draft, setDraft] = useState<GuestDraft>(emptyGuest);

  const close = (open: boolean) => {
    setGuestFormOpen(open);
    if (!open) setDraft(emptyGuest);
  };

  return (
    <Sheet
      open={guestFormOpen}
      onOpenChange={close}
      title="Add guest"
      footer={
        <Button
          size="lg"
          block
          disabled={!guestIsValid(draft)}
          onClick={() => {
            const g = addGuest({ ...draft, name: draft.name.trim(), phone: draft.phone.trim() });
            notify("Guest added");
            close(false);
            openGuest(g.id);
          }}
        >
          Save guest
        </Button>
      }
    >
      <GuestFields value={draft} onChange={setDraft} />
    </Sheet>
  );
}

export function GuestSheet() {
  const { openGuestId, openGuest, guests } = useStore();
  const guest = guests.find((g) => g.id === openGuestId);
  return (
    <Sheet open={!!guest} onOpenChange={(open) => !open && openGuest(null)} title="Guest">
      {guest ? <GuestProfile key={guest.id} guest={guest} /> : null}
    </Sheet>
  );
}

function GuestProfile({ guest }: { guest: Guest }) {
  const { bookings, updateGuest, openBooking, openGuest, notify } = useStore();
  const { placeName } = useLookups();
  const startBooking = useStartBooking();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GuestDraft>(guest);
  const { stays, spent } = guestStats(guest.id, bookings);

  if (editing) {
    return (
      <div className="space-y-6">
        <GuestFields value={draft} onChange={setDraft} />
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => setEditing(false)}>
            Back
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={!guestIsValid(draft)}
            onClick={() => {
              updateGuest(guest.id, draft);
              notify("Guest updated");
              setEditing(false);
            }}
          >
            Save changes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={guest.name} className="size-16 text-xl" />
        <div className="text-2xl leading-tight font-semibold">{guest.name}</div>
      </div>

      <div className="space-y-2.5 rounded-card border border-line bg-card p-5">
        <a href={`tel:${guest.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 font-medium underline-offset-4 hover:underline">
          <Phone className="size-5 text-muted" /> {guest.phone}
        </a>
        {guest.email ? (
          <div className="flex items-center gap-3 break-all">
            <Mail className="size-5 shrink-0 text-muted" /> {guest.email}
          </div>
        ) : null}
        {guest.country ? (
          <div className="flex items-center gap-3">
            <Globe className="size-5 text-muted" /> {guest.country}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-line bg-card p-5">
          <div className="text-muted">Total stays</div>
          <div className="tnum text-3xl font-semibold">{stays.length}</div>
        </div>
        <div className="rounded-card border border-line bg-card p-5">
          <div className="text-muted">Total spent</div>
          <div className="tnum text-2xl leading-9 font-semibold">{money(spent)}</div>
        </div>
      </div>

      <div className="rounded-card border border-line bg-card">
        <h3 className="px-5 pt-4 pb-1 text-sm font-medium text-muted">Booking history</h3>
        {stays.length === 0 ? (
          <p className="px-5 pb-5 text-muted">No stays yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {stays.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-sand/70"
                  onClick={() => {
                    openGuest(null);
                    openBooking(b.id);
                  }}
                >
                  <PlaceIcon type={b.type} />
                  <span className="flex-1">
                    <span className="block font-medium">{fmtMonthShort(b.checkIn)}</span>
                    <span className="block text-sm text-muted">{placeName(b)}</span>
                  </span>
                  <span className="tnum text-sm text-muted">{plural(nightsBetween(b.checkIn, b.checkOut), "night")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 pt-2">
        <Button size="lg" block onClick={() => startBooking({ guestId: guest.id })}>
          <Plus /> New booking for {guest.name.split(" ")[0]}
        </Button>
        <Button variant="secondary" size="lg" block onClick={() => setEditing(true)}>
          <Pencil /> Edit details
        </Button>
      </div>
    </div>
  );
}
