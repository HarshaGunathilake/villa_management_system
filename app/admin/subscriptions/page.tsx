"use client";

import Link from "next/link";
import { AccessBadge, AdminCard, AdminHeader, CardBadge, fmtDate, relativeDay, StatTile, SubscriptionBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { paymentNeedsAttention } from "@/lib/admin-logic";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import type { AdminVilla } from "@/lib/admin-types";
import { monthKey } from "@/lib/dates";
import { money } from "@/lib/utils";

export default function SubscriptionsPage() {
  const { act, notify } = useAdmin();
  const { villas, payments, today } = useAdminData();

  const byDueDate = [...villas].sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate));
  const active = villas.filter((v) => v.accountStatus === "active");
  const received = payments.filter((p) => monthKey(p.paymentDate) === monthKey(today)).reduce((sum, p) => sum + p.amount, 0);
  const villaName = (id: string) => villas.find((v) => v.id === id)?.name ?? "Villa";

  const markDue = async (v: AdminVilla) => {
    const result = await act({ type: "setSubscriptionStatus", id: v.id, status: "payment_due" });
    notify(result.ok ? `${v.name} marked as payment due` : result.error);
  };

  return (
    <div>
      <AdminHeader title="Subscriptions" subtitle="Villas pay by card through Dodo Payments. Payments are recorded by themselves." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile label="Monthly from active villas" value={<span className="text-2xl">{money(active.reduce((s, v) => s + v.monthlyAmount, 0))}</span>} />
        <StatTile label="Received this month" value={<span className="text-2xl">{money(received)}</span>} />
        <StatTile label="Need attention" value={villas.filter((v) => paymentNeedsAttention(v, today)).length} note="Late, or due within 7 days" />
      </div>

      <h2 className="mt-8 mb-3 text-xl font-semibold">By next payment date</h2>
      <div className="space-y-3">
        {byDueDate.map((v) => (
          <AdminCard key={v.id} className="p-5">
            <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_auto] lg:items-center">
              <div className="min-w-0">
                <Link href={`/admin/villas/${v.id}`} className="block truncate text-lg leading-tight font-semibold underline-offset-4 hover:underline">
                  {v.name}
                </Link>
                <div className="truncate text-muted">{v.location}</div>
              </div>
              <div>
                <div className="tnum font-medium">{money(v.monthlyAmount)}</div>
                <div className="text-sm text-muted">{v.plan}, monthly</div>
              </div>
              <div>
                <div className="tnum font-medium">{fmtDate(v.nextPaymentDate)}</div>
                <div className="text-sm text-muted">Next payment, {relativeDay(today, v.nextPaymentDate)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SubscriptionBadge status={v.subscriptionStatus} />
                <CardBadge status={v.card.status} />
                <AccessBadge status={v.accountStatus} labels={["Access on", "Access off"]} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" disabled={v.subscriptionStatus !== "active"} onClick={() => markDue(v)}>
                  Payment due
                </Button>
              </div>
            </div>
          </AdminCard>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-xl font-semibold">Payment history</h2>
      <AdminCard>
        {payments.length === 0 ? (
          <p className="p-5 text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-5 py-3.5">
                <span className="tnum w-28 shrink-0 text-muted">{fmtDate(p.paymentDate)}</span>
                <span className="min-w-0 flex-1 basis-52">
                  <span className="font-medium">{villaName(p.villaId)}</span>
                  <span className="text-muted">
                    , {fmtDate(p.periodStart)} to {fmtDate(p.periodEnd)}
                    {p.note ? `. ${p.note}` : ""}
                  </span>
                </span>
                <span className="tnum font-semibold">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

    </div>
  );
}
