"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, Lock, Mail, Phone, RotateCw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Renewal, SupportContact } from "@/lib/api";
import { cameBackFromPayment, goToPayments } from "@/lib/billing-client";
import { money } from "@/lib/utils";

/** Shown instead of the app when the Super Admin has switched off the villa or the user. */
export function AccessDisabled({ support, onSignOut }: { support: SupportContact | null; onSignOut?: () => void }) {
  const contact = support?.email ? `mailto:${support.email}?subject=${encodeURIComponent("Villa account access")}` : support?.phone ? `tel:${support.phone.replace(/\s/g, "")}` : null;
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-well text-ink">
          <Lock className="size-9" aria-hidden />
        </span>
        <h1 className="mt-6 text-[1.875rem] leading-tight font-semibold sm:text-4xl">Access temporarily unavailable</h1>
        <p className="mt-3 text-lg text-muted">Your villa account is currently inactive.</p>
        <p className="mt-1 text-lg text-muted">Please contact the platform administrator to reactivate your account.</p>

        {support?.email || support?.phone ? (
          <div className="mt-6 space-y-2 rounded-card border border-line bg-card p-5 text-left">
            {support.email ? (
              <div className="flex items-center gap-3 break-all">
                <Mail className="size-5 shrink-0 text-muted" /> {support.email}
              </div>
            ) : null}
            {support.phone ? (
              <div className="flex items-center gap-3">
                <Phone className="size-5 shrink-0 text-muted" /> {support.phone}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {contact ? (
            <a href={contact} className="inline-flex min-h-14 items-center justify-center rounded-xl bg-ink px-6 text-[1.0625rem] font-medium text-white hover:bg-black">
              Contact support
            </a>
          ) : null}
          {onSignOut ? (
            <Button variant="secondary" size="lg" onClick={onSignOut}>
              Back to sign in
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Shown when the server or the database cannot be reached. */
export function ServerUnavailable({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-clay-soft text-clay">
          <ServerCrash className="size-9" aria-hidden />
        </span>
        <h1 className="mt-6 text-[1.875rem] leading-tight font-semibold">The app could not load</h1>
        <p className="mt-3 text-lg text-muted">{message ?? "Could not reach the server."}</p>
        <Button size="lg" className="mt-6" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * Shown when access went off because the card subscription was cancelled or
 * expired. Paying again switches the villa back on by itself, once Dodo confirms.
 */
export function SubscriptionEnded({
  support,
  renewal,
  onSignOut,
  onCheckAgain,
}: {
  support: SupportContact | null;
  renewal: Renewal | null;
  onSignOut: () => void;
  onCheckAgain: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Back from Dodo's payment page: the payment is confirmed within moments, by webhook. Keep checking for a minute.
  useEffect(() => {
    if (!cameBackFromPayment()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirming(true);
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void onCheckAgain();
      if (tries >= 20) {
        clearInterval(timer);
        setConfirming(false);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [onCheckAgain]);

  const pay = async () => {
    setBusy(true);
    setError(null);
    const problem = await goToPayments("checkout");
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  };

  const contact = support?.email ? `mailto:${support.email}?subject=${encodeURIComponent("Villa subscription")}` : support?.phone ? `tel:${support.phone.replace(/\s/g, "")}` : null;

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-amber-soft text-amber-deep">
          <CreditCard className="size-9" aria-hidden />
        </span>
        <h1 className="mt-6 text-[1.875rem] leading-tight font-semibold sm:text-4xl">Your subscription has ended</h1>
        <p className="mt-3 text-lg text-muted">Your bookings, guests and records are all kept. Pay to switch your villa back on straight away.</p>

        {confirming ? (
          <p role="status" className="mt-6 flex items-center justify-center gap-2 rounded-card bg-sage-soft px-4 py-3 font-medium text-sage-deep">
            <Loader2 className="size-5 animate-spin" aria-hidden /> Confirming your payment…
          </p>
        ) : null}

        {renewal?.canPay ? (
          <div className="mt-6 rounded-card border border-line bg-card p-5 text-left">
            <div className="text-muted">Monthly subscription</div>
            <div className="tnum text-2xl font-semibold">
              {money(renewal.monthlyAmount)} <span className="text-base font-normal text-muted">a month, by card</span>
            </div>
            <p className="mt-1 text-sm text-muted">Charged every month until you cancel. Payments are handled by Dodo Payments.</p>
          </div>
        ) : (
          <p className="mt-4 text-lg text-muted">Please contact the platform administrator to restart your subscription.</p>
        )}

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-clay-soft px-4 py-3 text-left text-clay">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          {renewal?.canPay ? (
            <Button size="lg" onClick={pay} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <CreditCard />} Pay {money(renewal.monthlyAmount)} by card
            </Button>
          ) : null}
          {confirming ? (
            <Button variant="secondary" size="lg" onClick={() => void onCheckAgain()}>
              <RotateCw /> Check again
            </Button>
          ) : null}
          {contact ? (
            <a href={contact} className="inline-flex min-h-14 items-center justify-center rounded-xl border border-line-strong bg-card px-6 text-[1.0625rem] font-medium hover:bg-well">
              Contact support
            </a>
          ) : null}
          <Button variant="ghost" size="lg" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
