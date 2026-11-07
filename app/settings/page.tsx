"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BedDouble, ChevronRight, ConciergeBell, CreditCard, Home, KeyRound, Mail, Moon, Send, UserRound } from "lucide-react";
import { Card, PageHeader } from "@/components/app-shell";
import { TimeSelect } from "@/components/stay-times";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, PasswordInput, Stepper, Toggle } from "@/components/ui/field";
import { addMonths, fmtMonthLong, monthKey } from "@/lib/dates";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * Villa settings, in short tabs so nothing needs a long scroll: the villa's
 * details, how stays work, the monthly report email, and the owner's password.
 */

type Tab = "villa" | "stays" | "report" | "password";
const TABS: { id: Tab; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "villa", label: "Villa details", short: "Details", icon: Home },
  { id: "stays", label: "Stays and price", short: "Stays", icon: Moon },
  { id: "report", label: "Monthly report", short: "Report", icon: Mail },
  { id: "password", label: "Password", short: "Password", icon: KeyRound },
];

export default function SettingsPage() {
  const { villa, updateVilla, notify, readOnly } = useStore();
  const [tab, setTab] = useState<Tab>("villa");
  const [draft, setDraft] = useState(villa);
  const dirty = JSON.stringify(draft) !== JSON.stringify(villa);
  const ccValid = !draft.reportCc.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.reportCc.trim());
  const valid = draft.name.trim().length > 0 && draft.price > 0 && ccValid;
  const set = (key: keyof typeof villa) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [key]: e.target.value });

  // Open the tab named in the address (?tab=password), so other screens can link straight to it.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (TABS.some((t) => t.id === wanted)) setTab(wanted as Tab);
  }, []);

  const save = () => {
    updateVilla({ ...draft, reportCc: draft.reportCc.trim().toLowerCase() });
    notify("Settings saved");
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Villa settings" subtitle="Your villa's details, how stays work, and your sign-in." />

      <div role="tablist" aria-label="Settings sections" className="mb-5 grid grid-cols-4 gap-1.5 sm:flex">
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
              "flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border px-2 text-[0.9375rem] font-medium whitespace-nowrap sm:px-4 sm:text-base",
              tab === t.id ? "border-ink bg-ink text-white" : "border-line-strong bg-card text-ink hover:bg-well",
            )}
          >
            <t.icon className="hidden size-[1.125rem] shrink-0 sm:block" aria-hidden />
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

      {tab === "report" ? (
        <section role="tabpanel" id="panel-report" aria-labelledby="tab-report">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Email me a report every month</h2>
                <p className="mt-1 text-[0.9375rem] text-muted">
                  On the 1st of each month, get last month&apos;s income, expenses, profit and occupancy by email, with every booking, expense and payslip attached as a spreadsheet.
                </p>
              </div>
              <Toggle checked={draft.monthlyReport} onChange={(v) => setDraft({ ...draft, monthlyReport: v })} label="Email me a report every month" />
            </div>
            <div className="mt-5 space-y-4 border-t border-line pt-5">
              <div className="flex items-center gap-3 text-[0.9375rem]">
                <UserRound className="size-5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0">
                  Sent to <span className="font-medium break-all">{villa.ownerEmail || "your sign-in email"}</span>
                </span>
              </div>
              <Field label="Also send to" optional hint={ccValid ? "Your accountant or a partner, for example." : "Enter a full email address, or leave this empty."}>
                {(id) => (
                  <Input id={id} type="email" inputMode="email" autoComplete="off" value={draft.reportCc} onChange={set("reportCc")} placeholder="accountant@example.com" aria-invalid={!ccValid} />
                )}
              </Field>
            </div>
          </Card>
          <SendReportNow />
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

/** Email any past month's report straight away, whether the monthly email is on or not. */
function SendReportNow() {
  const { today, villa } = useStore();
  const thisMonth = monthKey(today || new Date().toISOString().slice(0, 10));
  const months = Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, -i));
  const [month, setMonth] = useState(addMonths(thisMonth, -1));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    const r = await api<{ to: string[] }>("/api/villa/report-email", { month });
    setBusy(false);
    setResult(r.ok ? { ok: true, text: `Sent the ${fmtMonthLong(month)} report to ${r.to.join(" and ")}.` } : { ok: false, text: r.error });
  };

  return (
    <Card className="mt-5 p-5 sm:p-6">
      <h2 className="font-semibold">Send a report now</h2>
      <p className="mt-1 text-[0.9375rem] text-muted">Email the report for any month, for example to see what it looks like.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Month" className="min-w-0 flex-[1_1_12rem]">
          {(id) => (
            <select id={id} value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-12 w-full rounded-xl border border-line-strong bg-card px-4 text-base focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none">
              {months.map((m) => (
                <option key={m} value={m}>
                  {fmtMonthLong(m)}
                  {m === thisMonth ? " (so far)" : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Button variant="secondary" onClick={send} disabled={busy || !villa.ownerEmail}>
          <Send /> {busy ? "Sending" : "Email this report"}
        </Button>
      </div>
      {result ? (
        <p role="status" className={cn("mt-4 rounded-xl px-4 py-3 text-[0.9375rem]", result.ok ? "bg-sage-soft text-sage-deep" : "bg-clay-soft text-clay")}>
          {result.text}
        </p>
      ) : null}
    </Card>
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
