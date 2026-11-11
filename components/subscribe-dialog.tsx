"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, CreditCard, Gift, Loader2, Lock, ReceiptText, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goToPayments } from "@/lib/billing-client";
import { addDays, fmtFull } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { money } from "@/lib/utils";

/*
 * A new sign-up lands on the dashboard before paying. They can look around,
 * but nothing works until they subscribe: this popup opens on arrival, and
 * again whenever they try to add or change something.
 */

/** Pays by card on Dodo's page; the villa opens as soon as the payment is confirmed (back on the Subscription page). */
function useStartSubscription() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    const problem = await goToPayments("checkout");
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  };
  return { busy, error, start };
}

export function SubscribeDialog() {
  const { awaitingPayment, subscribeOpen, setSubscribeOpen, support, subscription, signOut, villa, today } = useStore();
  const { busy, error, start } = useStartSubscription();
  if (!awaitingPayment) return null;
  const price = money(awaitingPayment.monthlyAmount);
  const trial = awaitingPayment.trialDays ?? 0;
  // Dodo charges first on the day the trial ends.
  const firstCharge = trial > 0 && today ? fmtFull(addDays(today, trial)) : null;
  const help = support ?? subscription?.support ?? null;
  const contact = help?.email ? `mailto:${help.email}?subject=${encodeURIComponent("Villa subscription")}` : help?.phone ? `tel:${help.phone.replace(/\s/g, "")}` : null;

  return (
    <Dialog.Root open={subscribeOpen} onOpenChange={setSubscribeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-[70] bg-ink/45" />
        <Dialog.Content className="anim-fade fixed top-1/2 left-1/2 z-[80] max-h-[92dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-sand p-6 shadow-float outline-none sm:p-8">
          <Dialog.Close className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-muted hover:bg-well hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </Dialog.Close>
          <span className="grid size-14 place-items-center rounded-full bg-brass-soft text-brass-deep">
            {trial > 0 ? <Gift className="size-7" aria-hidden /> : <CreditCard className="size-7" aria-hidden />}
          </span>
          <Dialog.Title className="mt-5 text-[1.625rem] leading-tight font-semibold">{trial > 0 ? `Start your ${trial}-day free trial` : "Start your subscription"}</Dialog.Title>
          <Dialog.Description className="mt-2 text-lg text-muted">
            {villa.name ? `${villa.name} is set up.` : "Your villa is set up."}{" "}
            {trial > 0 ? "Add your card to start taking bookings. You can look around first." : "Subscribe to start taking bookings. You can look around first."}
          </Dialog.Description>

          <ul className="mt-5 space-y-2.5">
            {[
              { icon: CalendarDays, text: "Bookings for the whole villa or by the room" },
              { icon: Users, text: "Guests, check-in, check-out and invoices" },
              { icon: ReceiptText, text: "Expenses, bills, staff payslips and reports" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="size-5 shrink-0 text-sage-deep" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {awaitingPayment.canPay ? (
            trial > 0 ? (
              <div className="mt-6 rounded-card border border-line bg-card p-4">
                <div className="text-2xl font-semibold">
                  Free for {trial} {trial === 1 ? "day" : "days"}
                </div>
                <p className="tnum mt-0.5 text-[0.9375rem] text-muted">
                  Nothing is charged today. Then {price} a month{firstCharge ? `, from ${firstCharge}` : ""}. Cancel before then and you pay nothing.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-card border border-line bg-card p-4">
                <div className="tnum text-2xl font-semibold">
                  {price} <span className="text-base font-normal text-muted">a month</span>
                </div>
                <p className="mt-0.5 text-sm text-muted">Paid by card every month. Cancel any time.</p>
              </div>
            )
          ) : (
            <p className="mt-6 rounded-card bg-well p-4 text-[0.9375rem]">Card payments are not available right now. Please contact us to start your subscription.</p>
          )}

          {error ? (
            <p role="alert" className="mt-4 rounded-xl bg-clay-soft px-4 py-3 text-clay">
              {error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3">
            {awaitingPayment.canPay ? (
              <Button size="lg" onClick={start} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <CreditCard />} {trial > 0 ? "Add card and start free trial" : `Subscribe for ${price} a month`}
              </Button>
            ) : contact ? (
              <a href={contact} className="inline-flex min-h-14 items-center justify-center rounded-xl bg-ink px-6 text-[1.0625rem] font-semibold text-white hover:opacity-90">
                Contact us
              </a>
            ) : null}
            <Button variant="secondary" size="lg" onClick={() => setSubscribeOpen(false)}>
              Look around first
            </Button>
          </div>
          <div className="mt-4 text-center">
            <button type="button" onClick={signOut} className="min-h-11 text-muted underline-offset-4 hover:text-ink hover:underline">
              Sign out
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Across the top of every page until they subscribe. */
export function SubscribeBanner() {
  const { awaitingPayment, setSubscribeOpen } = useStore();
  if (!awaitingPayment) return null;
  const trial = awaitingPayment.trialDays ?? 0;
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card bg-brass-soft px-5 py-4 text-brass-deep">
      <Lock className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-semibold">{trial > 0 ? `Start your ${trial}-day free trial to use your villa` : "Subscribe to start using your villa"}</p>
        <p className="text-[0.9375rem]">
          {trial > 0
            ? "You can look around. Add your card and bookings and other changes start working. Nothing is charged until the trial ends."
            : "You can look around. Bookings and other changes start working once you subscribe."}
        </p>
      </div>
      <Button onClick={() => setSubscribeOpen(true)} className="shrink-0">
        {trial > 0 ? <Gift /> : <CreditCard />} {trial > 0 ? "Start free trial" : `Subscribe, ${money(awaitingPayment.monthlyAmount)} a month`}
      </Button>
    </div>
  );
}
