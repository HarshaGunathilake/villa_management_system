"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, CreditCard, Loader2, Mail, Phone } from "lucide-react";
import { Card } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cameBackFromPayment, goToPayments } from "@/lib/billing-client";
import { addDays, fmtFull, nightsBetween } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { VillaSubscription } from "@/lib/types";
import { money } from "@/lib/utils";

/*
 * The villa's own subscription with the platform. The villa pays by card
 * through Dodo Payments; the amount and plan are set by the platform administrator.
 */

const dayWord = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** The one thing the admin most needs to know about their subscription right now, or nothing. */
export function subscriptionHeadline(s: VillaSubscription, today: string) {
  const days = nightsBetween(today, s.nextPaymentDate);
  if (s.status === "overdue") return `Payment is overdue${days < 0 ? `, it was due ${dayWord(-days)} ago` : ""}`;
  if (s.status === "payment_due") return `Payment is due${days < 0 ? `, ${dayWord(-days)} late` : ""}`;
  if (days < 0) return `Payment was due ${dayWord(-days)} ago`;
  if (days === 0) return "Payment is due today";
  if (days <= 7) return `Next payment in ${dayWord(days)}`;
  return null;
}

export function SubscriptionStatusBadge({ status }: { status: VillaSubscription["status"] }) {
  if (status === "active") return <Badge tone="sage" icon={CheckCircle2}>Active</Badge>;
  if (status === "payment_due") return <Badge tone="amber" icon={Clock3}>Payment due</Badge>;
  return <Badge tone="clay" icon={AlertTriangle}>Overdue</Badge>;
}

/** Plan, price, status and the key dates. */
export function SubscriptionSummary({ subscription: s, today }: { subscription: VillaSubscription; today: string }) {
  const headline = subscriptionHeadline(s, today);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="tnum text-right font-medium">{value}</dd>
    </div>
  );
  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div>
          <div className="text-muted">{s.plan} plan</div>
          <div className="tnum text-2xl leading-tight font-semibold">
            {money(s.monthlyAmount)} <span className="text-base font-normal text-muted">a month</span>
          </div>
        </div>
        <SubscriptionStatusBadge status={s.status} />
      </div>
      {headline ? (
        <p className={`mt-3 rounded-xl px-3.5 py-2.5 text-[0.9375rem] font-medium ${s.status === "overdue" ? "bg-clay-soft text-clay" : "bg-amber-soft text-amber-deep"}`}>{headline}</p>
      ) : null}
      <dl className="mt-3 border-t border-line pt-2">
        {row("Next payment due", fmtFull(s.nextPaymentDate))}
        {row("Paid until", fmtFull(addDays(s.nextPaymentDate, -1)))}
        {row("Subscribed since", fmtFull(s.startDate))}
      </dl>
    </div>
  );
}

export function SupportContact({ support }: { support: VillaSubscription["support"] }) {
  if (!support.email && !support.phone) return null;
  return (
    <div className="space-y-1.5 text-[0.9375rem]">
      <p className="text-muted">Questions about your subscription:</p>
      {support.email ? (
        <a href={`mailto:${support.email}`} className="flex items-center gap-2 font-medium break-all underline-offset-4 hover:underline">
          <Mail className="size-4 shrink-0 text-muted" /> {support.email}
        </a>
      ) : null}
      {support.phone ? (
        <a href={`tel:${support.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 font-medium underline-offset-4 hover:underline">
          <Phone className="size-4 shrink-0 text-muted" /> {support.phone}
        </a>
      ) : null}
    </div>
  );
}

/** The short version on the home screen: summary, the latest payments, and a way to the full records. */
export function SubscriptionCard() {
  const { subscription: s, today } = useStore();
  if (!s) return null;
  const latest = s.payments.slice(0, 2);

  return (
    <Card className="overflow-hidden">
      <SubscriptionSummary subscription={s} today={today} />
      <div className="border-t border-line">
        <h3 className="px-5 pt-4 pb-1 text-sm font-medium text-muted">Latest payments</h3>
        {latest.length === 0 ? (
          <p className="px-5 pb-4 text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {latest.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="font-medium">Paid {fmtFull(p.paymentDate)}</div>
                  <div className="text-sm text-muted">
                    For {fmtFull(p.periodStart)} to {fmtFull(p.periodEnd)}
                  </div>
                </div>
                <div className="tnum shrink-0 font-semibold">{money(p.amount)}</div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/subscription" className="flex min-h-12 items-center border-t border-line px-5 font-medium text-brass-deep hover:bg-sand/70">
          Subscription and payment records
        </Link>
      </div>
    </Card>
  );
}

/**
 * Paying by card: start paying, update a card that failed, or open Dodo's
 * billing portal. After paying, Dodo sends the admin back here and the payment
 * is confirmed within moments.
 */
export function PaymentPanel({ subscription: s, onRefresh }: { subscription: VillaSubscription; onRefresh: () => Promise<void> }) {
  const b = s.billing;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Back from the payment page and not confirmed yet: keep checking for a minute.
  useEffect(() => {
    if (!cameBackFromPayment()) return;
    if (b.state === "active") {
      window.history.replaceState(null, "", window.location.pathname);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirming(false);
      return;
    }
    setConfirming(true);
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void onRefresh();
      if (tries >= 20) {
        clearInterval(timer);
        setConfirming(false);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [b.state, onRefresh]);

  const go = async (action: "checkout" | "portal") => {
    setBusy(true);
    setError(null);
    const problem = await goToPayments(action);
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  };

  const spinner = busy ? <Loader2 className="animate-spin" /> : <CreditCard />;
  let body: React.ReactNode;

  if (!b.enabled) {
    body = <p className="text-muted">Card payments are not set up yet. Please contact the platform administrator.</p>;
  } else if (b.state === "active") {
    body = (
      <>
        <p className="flex items-start gap-2 font-medium text-sage-deep">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> Paying automatically by card
        </p>
        <p className="mt-1 text-muted">
          {money(s.monthlyAmount)} is charged every month. Next charge on {fmtFull(s.nextPaymentDate)}.
        </p>
        <Button variant="secondary" size="lg" block className="mt-4" disabled={busy} onClick={() => go("portal")}>
          {spinner} Manage card and billing
        </Button>
      </>
    );
  } else if (b.state === "attention") {
    body = (
      <>
        <p className="flex items-start gap-2 font-medium text-clay">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          {b.dodoStatus === "paused" ? "Card payments are paused" : "Your last card payment did not go through"}
        </p>
        <p className="mt-1 text-muted">
          {b.dodoStatus === "past_due" ? "It will be tried again. " : ""}Update your card so your subscription carries on. If it ends, your villa is switched off until you pay again.
        </p>
        <Button size="lg" block className="mt-4" disabled={busy} onClick={() => go("portal")}>
          {spinner} Update card
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-muted">
          Pay {money(s.monthlyAmount)} a month by card. You are charged now, then every month until you cancel.
          {b.state === "pending" ? " You started a payment earlier that was not finished." : ""}
        </p>
        <Button size="lg" block className="mt-4" disabled={busy || confirming} onClick={() => go("checkout")}>
          {spinner} {b.state === "pending" ? "Continue to payment" : "Pay by card"}
        </Button>
      </>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Payment</h2>
      {confirming ? (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-sage-soft px-3.5 py-2.5 font-medium text-sage-deep">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Confirming your payment…
        </p>
      ) : null}
      {body}
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-clay-soft px-3.5 py-2.5 text-clay">
          {error}
        </p>
      ) : null}
      {b.enabled ? <p className="mt-3 text-sm text-muted">Card payments are handled securely by Dodo Payments. Your card details never reach this app.</p> : null}
    </div>
  );
}
