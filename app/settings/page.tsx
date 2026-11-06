"use client";

import { useState } from "react";
import { Card, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { TimeSelect } from "@/components/stay-times";
import { Field, Input, MoneyInput, Stepper } from "@/components/ui/field";
import { useStore } from "@/lib/store";

export default function SettingsPage() {
  const { villa, updateVilla, notify } = useStore();
  const [draft, setDraft] = useState(villa);
  const dirty = JSON.stringify(draft) !== JSON.stringify(villa);
  const set = (key: keyof typeof villa) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [key]: e.target.value });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Villa settings" />

      <Card className="space-y-5 p-5 sm:p-6">
        <Field label="Villa name">{(id) => <Input id={id} value={draft.name} onChange={set("name")} />}</Field>
        <Field label="Location">{(id) => <Input id={id} value={draft.location} onChange={set("location")} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={draft.phone} onChange={set("phone")} />}</Field>
        <Field label="Your name" hint="Used for the greeting on the home screen.">
          {(id) => <Input id={id} value={draft.ownerName} onChange={set("ownerName")} />}
        </Field>
      </Card>

      <h2 className="mt-8 mb-3 text-xl font-semibold">Entire villa</h2>
      <Card className="space-y-2 p-5 sm:p-6">
        <Field label="Entire villa price per night">
          {(id) => <MoneyInput id={id} value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} />}
        </Field>
        <Stepper label="Maximum guests" hint="When the whole villa is booked" value={draft.maxGuests} min={1} max={30} onChange={(v) => setDraft({ ...draft, maxGuests: v })} />
        <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
          <Field label="Check-in from">{(id) => <TimeSelect id={id} value={draft.checkInTime} onChange={(t) => setDraft({ ...draft, checkInTime: t })} />}</Field>
          <Field label="Check-out by">{(id) => <TimeSelect id={id} value={draft.checkOutTime} onChange={(t) => setDraft({ ...draft, checkOutTime: t })} />}</Field>
        </div>
      </Card>

      <Button
        size="lg"
        className="mt-6"
        disabled={!dirty || !draft.name.trim() || draft.price <= 0}
        onClick={() => {
          updateVilla(draft);
          notify("Settings saved");
        }}
      >
        Save changes
      </Button>
    </div>
  );
}
