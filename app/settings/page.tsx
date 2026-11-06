"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BedDouble, ChevronRight, ConciergeBell, CreditCard, Home, KeyRound, Moon } from "lucide-react";
import { Card, PageHeader } from "@/components/app-shell";
import { TimeSelect } from "@/components/stay-times";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, PasswordInput, Stepper } from "@/components/ui/field";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * Villa settings, in three short tabs so nothing needs a long scroll:
 * the villa's details, how stays work, and the owner's password.
 */

type Tab = "villa" | "stays" | "password";
const TABS: { id: Tab; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "villa", label: "Villa details", short: "Details", icon: Home },
  { id: "stays", label: "Stays and price", short: "Stays", icon: Moon },
  { id: "password", label: "Password", short: "Password", icon: KeyRound },
];

export default function SettingsPage() {
  const { villa, updateVilla, notify, readOnly } = useStore();
  const [tab, setTab] = useState<Tab>("villa");
  const [draft, setDraft] = useState(villa);
  const dirty = JSON.stringify(draft) !== JSON.stringify(villa);
  const valid = draft.name.trim().length > 0 && draft.price > 0;
  const set = (key: keyof typeof villa) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [key]: e.target.value });

  // Open the tab named in the address (?tab=password), so other screens can link straight to it.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wanted === "villa" || wanted === "stays" || wanted === "password") setTab(wanted);
  }, []);

  const save = () => {
    updateVilla(draft);
    notify("Settings saved");
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Villa settings" subtitle="Your villa's details, how stays work, and your sign-in." />

      <div role="tablist" aria-label="Settings sections" className="mb-5 grid grid-cols-3 gap-1.5 sm:flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border px-3 font-medium whitespace-nowrap sm:px-4",
              tab === t.id ? "border-ink bg-ink text-white" : "border-line-strong bg-card text-ink hover:bg-well",
            )}
          >
            <t.icon className="size-[1.125rem] shrink-0" aria-hidden />
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "villa" ? (
        <section role="tabpanel" id="panel-villa" aria-labelledby="tab-villa">
          <Card className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <Field label="Villa name">{(id) => <Input id={id} value={draft.name} onChange={set("name")} />}</Field>
            <Field label="Location">{(id) => <Input id={id} value={draft.location} onChange={set("location")} placeholder="e.g. Mirissa, Matara" />}</Field>
            <Field label="Phone">{(id) => <Input id={id} type="tel" value={draft.phone} onChange={set("phone")} />}</Field>
            <Field label="Your name" hint="Used for the greeting on the home screen.">
              {(id) => <Input id={id} value={draft.ownerName} onChange={set("ownerName")} />}
            </Field>
          </Card>
          <MoreSettings />
        </section>
      ) : null}

      {tab === "stays" ? (
        <section role="tabpanel" id="panel-stays" aria-labelledby="tab-stays">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold">Booking the entire villa</h2>
            <p className="mt-0.5 text-[0.9375rem] text-muted">Room prices are set on the Rooms page.</p>
            <div className="mt-4 grid items-end gap-x-6 gap-y-2 sm:grid-cols-2">
              <Field label="Price per night">{(id) => <MoneyInput id={id} value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} />}</Field>
              <Stepper label="Maximum guests" value={draft.maxGuests} min={1} max={30} onChange={(v) => setDraft({ ...draft, maxGuests: v })} />
            </div>

            <h2 className="mt-6 border-t border-line pt-5 font-semibold">Check-in and check-out</h2>
            <p className="mt-0.5 text-[0.9375rem] text-muted">For every booking, rooms and entire villa.</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Check-in from">{(id) => <TimeSelect id={id} value={draft.checkInTime} onChange={(t) => setDraft({ ...draft, checkInTime: t })} />}</Field>
              <Field label="Check-out by">{(id) => <TimeSelect id={id} value={draft.checkOutTime} onChange={(t) => setDraft({ ...draft, checkOutTime: t })} />}</Field>
            </div>
          </Card>
        </section>
      ) : null}

      {tab === "password" ? (
        <section role="tabpanel" id="panel-password" aria-labelledby="tab-password">
          <ChangePassword />
        </section>
      ) : null}

      {/* Shows only when something changed, on either of the first two tabs. */}
      {dirty && tab !== "password" ? (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mt-5 lg:bottom-4">
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-card/95 px-4 py-3 shadow-float backdrop-blur sm:px-5">
            <span className="min-w-0 flex-1 font-medium">{readOnly ? "Changes are paused until the payment is made." : valid ? "Unsaved changes" : draft.price <= 0 ? "Enter a price per night" : "Enter the villa name"}</span>
            <Button variant="ghost" onClick={() => setDraft(villa)}>
              Discard
            </Button>
            <Button disabled={readOnly || !valid} onClick={save}>
              Save changes
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The other places the villa is set up, so the owner finds them from here. */
function MoreSettings() {
  const links = [
    { href: "/rooms", label: "Rooms", hint: "Names, prices and which rooms take bookings", icon: BedDouble },
    { href: "/amenities", label: "Amenities", hint: "Extras guests can add, like a BBQ or meals", icon: ConciergeBell },
    { href: "/subscription", label: "Subscription", hint: "Your plan, card and payments", icon: CreditCard },
  ];
  return (
    <Card className="mt-5 divide-y divide-line overflow-hidden">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="flex items-center gap-4 px-5 py-4 hover:bg-well/60">
          <l.icon className="size-5 shrink-0 text-muted" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{l.label}</span>
            <span className="block truncate text-sm text-muted">{l.hint}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />
        </Link>
      ))}
    </Card>
  );
}

/** Works while a payment is due too: it changes the sign-in, not the villa. */
function ChangePassword() {
  const { notify } = useStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setError("The two new passwords do not match.");
    setBusy(true);
    const result = await api("/api/auth/password", { current, next });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    setCurrent("");
    setNext("");
    setConfirm("");
    notify("Password changed. Other devices are signed out.");
  };

  return (
    <form onSubmit={submit} noValidate>
      <Card className="space-y-5 p-5 sm:p-6">
        <p className="text-[0.9375rem] text-muted">Changing your password signs you out on every other phone or computer.</p>
        <Field label="Current password">{(id) => <PasswordInput id={id} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}</Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="New password" hint="At least 8 characters">{(id) => <PasswordInput id={id} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}</Field>
          <Field label="Type it again">{(id) => <PasswordInput id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />}</Field>
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-clay-soft px-4 py-3 text-[0.9375rem] text-clay">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={!current || next.length < 8 || !confirm || busy}>
            {busy ? "Saving" : "Change password"}
          </Button>
          <Link href="/forgot-password" className="font-medium text-brass-deep underline-offset-4 hover:underline">
            Forgot your current password?
          </Link>
        </div>
      </Card>
    </form>
  );
}
