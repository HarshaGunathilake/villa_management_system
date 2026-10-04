"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { TimeSelect } from "@/components/stay-times";
import { Field, Input, MoneyInput, Stepper } from "@/components/ui/field";
import { useStore } from "@/lib/store";

export default function SettingsPage() {
  const { villa, updateVilla, resetDemo, notify } = useStore();
  const [draft, setDraft] = useState(villa);
  const [confirmReset, setConfirmReset] = useState(false);
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

      <h2 className="mt-12 mb-3 text-xl font-semibold">Demo data</h2>
      <Card className="p-5 sm:p-6">
        <p className="text-muted">
          This prototype keeps everything in this browser. Start again with the sample bookings, guests and expenses whenever you like.
        </p>
        {confirmReset ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-auto font-medium">Replace everything with the sample data?</span>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Keep my changes
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
                notify("Sample data restored");
              }}
            >
              Reset
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="mt-4" onClick={() => setConfirmReset(true)}>
            <RotateCcw /> Reset sample data
          </Button>
        )}
      </Card>
    </div>
  );
}
