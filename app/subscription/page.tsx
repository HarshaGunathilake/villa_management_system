"use client";

import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/app-shell";
import { PaymentPanel, SubscriptionSummary, SupportContact } from "@/components/subscription-card";
import { addDays, fmtFull } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { money, plural } from "@/lib/utils";

/** The villa's subscription with the platform: paying by card, and every payment recorded for it. */
export default function SubscriptionPage() {
  const { subscription: s, today, villa, reload } = useStore();

  if (!s) {
    return (
      <div>
        <PageHeader title="Subscription" />
        <EmptyState title="Subscription details are not available right now">Try again in a moment.</EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Subscription" subtitle={`${villa.name}'s plan and payment records`} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="space-y-6">
          <Card>
            <SubscriptionSummary subscription={s} today={today} />
          </Card>
          <Card className="p-5">
            <PaymentPanel subscription={s} onRefresh={reload} />
            {s.support.email || s.support.phone ? (
              <div className="mt-5 border-t border-line pt-4">
                <SupportContact support={s.support} />
              </div>
            ) : null}
          </Card>
        </div>

        <section>
          <SectionTitle action={<span className="text-muted">{plural(s.payments.length, "payment")}</span>}>Payment records</SectionTitle>
          {s.payments.length === 0 ? (
            <EmptyState title="No payments recorded yet">
              Card payments show here as soon as they go through.
            </EmptyState>
          ) : (
            <Card className="overflow-hidden">
              {/* Wide screens: a table. Phones: the same rows stacked. */}
              <table className="hidden w-full text-left sm:table">
                <thead>
                  <tr className="border-b border-line text-sm text-muted">
                    <th className="px-5 py-3 font-medium">Paid on</th>
                    <th className="px-5 py-3 font-medium">Period covered</th>
                    <th className="px-5 py-3 font-medium">Note</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="tnum divide-y divide-line">
                  {s.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3.5 font-medium whitespace-nowrap">{fmtFull(p.paymentDate)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {fmtFull(p.periodStart)} to {fmtFull(p.periodEnd)}
                      </td>
                      <td className="px-5 py-3.5 text-muted">{p.note}</td>
                      <td className="px-5 py-3.5 text-right font-semibold whitespace-nowrap">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ul className="divide-y divide-line sm:hidden">
                {s.payments.map((p) => (
                  <li key={p.id} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">Paid {fmtFull(p.paymentDate)}</span>
                      <span className="tnum font-semibold">{money(p.amount)}</span>
                    </div>
                    <div className="text-sm text-muted">
                      For {fmtFull(p.periodStart)} to {fmtFull(p.periodEnd)}
                    </div>
                    {p.note ? <div className="text-sm text-muted">{p.note}</div> : null}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <p className="mt-3 text-sm text-muted">
            {s.freeUntil
              ? `Free access until ${fmtFull(s.freeUntil)}. Each payment after that covers one month.`
              : s.endsAtPeriodEnd
                ? `Cancelled. You can use everything until ${fmtFull(addDays(s.nextPaymentDate, -1))}.`
                : s.trialOffer > 0
                  ? "Your first payment is at the end of the free trial. Each payment covers one month."
                  : s.trialEndsOn
                    ? `Free until ${fmtFull(addDays(s.trialEndsOn, -1))}. The first payment is on ${fmtFull(s.trialEndsOn)}, and each payment covers one month.`
                    : `Paid until ${fmtFull(addDays(s.nextPaymentDate, -1))}. Each payment covers one month.`}
          </p>
        </section>
      </div>
    </div>
  );
}
