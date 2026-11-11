"use client";

import { useState } from "react";
import { CalendarClock, Gift, XCircle } from "lucide-react";
import { ConfirmButtons, fmtDate, FormError, Modal } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import { shiftMonths } from "@/lib/admin-logic";
import type { AdminVilla } from "@/lib/admin-types";

type Action = { type: string } & Record<string, unknown>;
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

/*
 * What the Super Admin can do with a villa's subscription:
 *  - a villa paying by card: cancel at the end of the paid month, cancel now, or undo a cancellation;
 *  - a villa not paying by card: give free access up to a date, change that date, or end it.
 */

const LIVE = ["active", "on_hold", "past_due", "paused"];

type Open = null | "end" | "now" | "keep" | "free" | "stopFree";

export function SubscriptionActions({ villa, size = "sm" }: { villa: AdminVilla; size?: "sm" | "md" }) {
  const [open, setOpen] = useState<Open>(null);
  const paying = LIVE.includes(villa.card.status ?? "");
  const off = villa.accountStatus === "disabled" && villa.disabledReason === "manual";
  const btn = size === "sm" ? "sm" : undefined;

  return (
    <>
      {paying ? (
        villa.cancelAtPeriodEnd ? (
          <Button variant="secondary" size={btn} onClick={() => setOpen("keep")}>
            <CalendarClock /> Undo cancellation
          </Button>
        ) : (
          <>
            <Button variant="secondary" size={btn} onClick={() => setOpen("end")}>
              <CalendarClock /> Cancel at end of month
            </Button>
            <Button variant="danger" size={btn} onClick={() => setOpen("now")}>
              <XCircle /> Cancel now
            </Button>
          </>
        )
      ) : (
        <>
          <Button variant="secondary" size={btn} disabled={off} title={off ? "Enable the villa's access first" : undefined} onClick={() => setOpen("free")}>
            <Gift /> {villa.freeUntil ? "Change free access" : "Give free access"}
          </Button>
          {villa.freeUntil ? (
            <Button variant="danger" size={btn} onClick={() => setOpen("stopFree")}>
              End free access
            </Button>
          ) : null}
        </>
      )}

      {open === "end" || open === "now" || open === "keep" ? <CancelModal villa={villa} mode={open} onClose={() => setOpen(null)} /> : null}
      {open === "free" ? <FreeAccessModal villa={villa} onClose={() => setOpen(null)} /> : null}
      {open === "stopFree" ? <EndFreeModal villa={villa} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** One line under the subscription saying what's set: ends on, free until. */
export function SubscriptionNote({ villa }: { villa: AdminVilla }) {
  if (villa.cancelAtPeriodEnd && LIVE.includes(villa.card.status ?? "")) {
    return (
      <p className="rounded-xl bg-amber-soft px-3.5 py-2.5 text-[0.9375rem] font-medium text-amber-deep">
        Cancelled: no more charges. Access ends on {fmtDate(villa.nextPaymentDate)}.
      </p>
    );
  }
  if (villa.freeUntil) {
    return (
      <p className="rounded-xl bg-dusk-soft px-3.5 py-2.5 text-[0.9375rem] font-medium text-dusk">
        Free access, no card, until {fmtDate(villa.freeUntil)}. The villa switches off after that unless the owner adds a card.
      </p>
    );
  }
  return null;
}

function useRun(onClose: () => void) {
  const { act, notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (body: Action, done: string) => {
    setBusy(true);
    setError(null);
    const result = await act(body);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    notify(done);
    onClose();
  };
  return { busy, error, run };
}

function CancelModal({ villa, mode, onClose }: { villa: AdminVilla; mode: "end" | "now" | "keep"; onClose: () => void }) {
  const { busy, error, run } = useRun(onClose);
  const until = villa.trialEndsOn ?? villa.nextPaymentDate;
  const lastDay = fmtDate(addDays(until, -1));
  const copy = {
    end: {
      title: "Cancel at the end of the month?",
      body: (
        <>
          <p>
            {villa.name} won&apos;t be charged again. The owner keeps full access until {lastDay}
            {villa.trialEndsOn ? ", the end of the free trial" : ", the end of the month they paid for"}, then the villa switches off.
          </p>
          <p className="text-muted">You can undo this any time before then. The owner can also subscribe again later. Nothing is deleted.</p>
        </>
      ),
      label: "Cancel at end of month",
      body2: { type: "cancelSubscription", id: villa.id, when: "period_end" },
      done: "Subscription set to end",
      danger: false,
    },
    now: {
      title: "Cancel now?",
      body: (
        <>
          <p>
            {villa.name}&apos;s card subscription ends straight away and the villa switches off. The owner can still sign in, but only to subscribe again.
          </p>
          <p className="font-medium">Nothing is refunded automatically. If the owner should get money back, refund it in the Dodo dashboard.</p>
          <p className="text-muted">Their bookings, guests and records are kept.</p>
        </>
      ),
      label: "Cancel now",
      body2: { type: "cancelSubscription", id: villa.id, when: "now" },
      done: "Subscription cancelled",
      danger: true,
    },
    keep: {
      title: "Undo the cancellation?",
      body: <p>{villa.name}&apos;s card subscription carries on, and the card is charged as usual on {fmtDate(until)}.</p>,
      label: "Keep subscription",
      body2: { type: "keepSubscription", id: villa.id },
      done: "Cancellation undone",
      danger: false,
    },
  }[mode];

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={copy.title}
      footer={<ConfirmButtons onCancel={onClose} onConfirm={() => void run(copy.body2, copy.done)} confirmLabel={busy ? "Working…" : copy.label} danger={copy.danger} busy={busy} />}
    >
      {copy.body}
      <FormError message={error} />
    </Modal>
  );
}

function FreeAccessModal({ villa, onClose }: { villa: AdminVilla; onClose: () => void }) {
  const { today } = useAdminData();
  const { busy, error, run } = useRun(onClose);
  // The last free day: a month from today unless free access is already set.
  const start = villa.freeUntil && villa.freeUntil >= today ? villa.freeUntil : today;
  const presets = [
    { label: "1 month", until: addDays(shiftMonths(today, 1), -1) },
    { label: "3 months", until: addDays(shiftMonths(today, 3), -1) },
    { label: "6 months", until: addDays(shiftMonths(today, 6), -1) },
  ];
  const [until, setUntil] = useState(villa.freeUntil && villa.freeUntil >= today ? start : presets[0].until);
  const maxDay = addDays(today, 366);
  const valid = until >= today && until <= maxDay;

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={villa.freeUntil ? "Change free access" : "Give free access"}
      footer={
        <ConfirmButtons
          onCancel={onClose}
          onConfirm={() => void run({ type: "giveFreeAccess", id: villa.id, until }, "Free access saved")}
          confirmLabel={busy ? "Saving…" : "Give free access"}
          busy={busy || !valid}
        />
      }
    >
      <p>
        {villa.name} can use everything without paying until the date you choose. No card is needed and nothing is charged.
      </p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setUntil(p.until)}
            className={cn(
              "min-h-10 rounded-full border px-4 text-[0.9375rem] font-medium",
              until === p.until ? "border-ink bg-ink text-white" : "border-line-strong bg-card hover:bg-well",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Field label="Free until (last free day)" hint={valid ? `Access switches off after ${fmtDate(until)} unless the owner adds a card before then.` : "Choose a date from today, up to a year ahead."}>
        {(id) => <Input id={id} type="date" value={until} min={today} max={maxDay} onChange={(e) => setUntil(e.target.value)} className="w-48" />}
      </Field>
      <p className="text-sm text-muted">
        If the owner adds a card during the free access, their first charge is the day after it ends.
        {villa.accountStatus === "disabled" ? " This also switches the villa back on." : ""}
      </p>
      <FormError message={error} />
    </Modal>
  );
}

function EndFreeModal({ villa, onClose }: { villa: AdminVilla; onClose: () => void }) {
  const { busy, error, run } = useRun(onClose);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="End free access now?"
      footer={<ConfirmButtons onCancel={onClose} onConfirm={() => void run({ type: "endFreeAccess", id: villa.id }, "Free access ended")} confirmLabel="End free access" danger busy={busy} />}
    >
      <p>{villa.name} switches off now. The owner can sign in to subscribe by card. Their records are kept.</p>
      <FormError message={error} />
    </Modal>
  );
}
