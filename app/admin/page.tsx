"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import {
  AdminCard,
  AdminHeader,
  fmtDate,
  StatTile,
  VillaStatusBadge,
} from "@/components/admin/ui";
import { CreateVillaSheet } from "@/components/admin/villa-forms";
import { Button } from "@/components/ui/button";
import { villaAlerts } from "@/lib/admin-logic";
import { useAdminData } from "@/lib/admin-store";
import { villaBadge } from "@/lib/admin-types";
import { addDays, addMonths, fmtLong, monthKey } from "@/lib/dates";
import { money } from "@/lib/utils";

/*
 * The Super Admin dashboard, for running LankaStay as a subscription business:
 * what comes in each month, who signed up, who has not paid yet, and which
 * card payments are in trouble.
 */

/** Dodo is retrying a failed renewal. */
const CARD_TROUBLE = ["on_hold", "past_due"];
const SHORT_MONTH = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
    month: "short",
  });

export default function AdminDashboard() {
  const { villas, admins, payments, today, settings } = useAdminData();
  const [creating, setCreating] = useState(false);

  // Monthly recurring income: villas whose card subscription is active.
  const paying = villas.filter(
    (v) => v.card.status === "active" && v.accountStatus === "active",
  );
  const recurring = paying.reduce((sum, v) => sum + v.monthlyAmount, 0);

  // Card payments, by month.
  const thisMonth = monthKey(today);
  const months = Array.from({ length: 6 }, (_, i) =>
    addMonths(thisMonth, i - 5),
  );
  const byMonth = new Map(months.map((m) => [m, 0]));
  for (const p of payments) {
    const m = monthKey(p.paymentDate);
    if (byMonth.has(m)) byMonth.set(m, byMonth.get(m)! + p.amount);
  }
  const collected = byMonth.get(thisMonth) ?? 0;
  const collectedCount = payments.filter(
    (p) => monthKey(p.paymentDate) === thisMonth,
  ).length;
  const peak = Math.max(1, ...byMonth.values());

  // Sign-ups in the last 30 days, and how many of them have paid.
  const since = addDays(today, -30);
  const signups = villas.filter(
    (v) => v.signedUp && v.createdAt.slice(0, 10) >= since,
  );
  const signupsPaid = signups.filter(
    (v) => v.disabledReason !== "unpaid",
  ).length;
  const awaiting = villas.filter((v) => v.disabledReason === "unpaid");
  const trouble = villas.filter(
    (v) => v.card.status && CARD_TROUBLE.includes(v.card.status),
  );

  // Sign-ups that have not paid yet are counted in their own tile, so they do not crowd this list.
  const alerts = villaAlerts(villas, admins, today).filter(
    (a) => !awaiting.some((v) => v.id === a.villaId),
  );
  const recentSignups = [...villas]
    .filter((v) => v.signedUp)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const villaName = new Map(villas.map((v) => [v.id, v.name]));
  const recentPayments = payments.slice(0, 6);

  return (
    <div>
      <AdminHeader
        title="Dashboard"
        subtitle={fmtLong(today)}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Add villa
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-1">
          <StatTile
            label="Monthly income"
            value={money(recurring)}
            note={`${paying.length} ${paying.length === 1 ? "villa" : "villas"} paying by card`}
          />
        </div>
        <StatTile
          label="Collected this month"
          value={money(collected)}
          note={`${collectedCount} card ${collectedCount === 1 ? "payment" : "payments"}`}
        />
        <StatTile
          label="New sign-ups"
          value={signups.length}
          note={`Last 30 days · ${signupsPaid} paid`}
        />
        <StatTile
          label="Awaiting first payment"
          value={awaiting.length}
          tone={awaiting.length > 0 ? "warn" : undefined}
          note="Signed up, not paid yet"
        />
        <StatTile
          label="Card problems"
          value={trouble.length}
          tone={trouble.length > 0 ? "warn" : undefined}
          note={
            trouble.length > 0 ? "Dodo is retrying" : "All card payments fine"
          }
        />
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="income-heading">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id="income-heading" className="text-xl font-semibold">
                Card payments received
              </h2>
              <span className="text-sm text-muted">
                {money(settings.defaultMonthlyAmount)} a month per villa
              </span>
            </div>
            <AdminCard className="p-5 sm:p-6">
              <ol
                className="flex h-48 items-end gap-3 sm:gap-5"
                aria-label="Card payments received in each of the last six months"
              >
                {months.map((m) => {
                  const value = byMonth.get(m)!;
                  const current = m === thisMonth;
                  return (
                    <li
                      key={m}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    >
                      <span className="tnum text-xs whitespace-nowrap text-muted sm:text-sm">
                        {value > 0 ? money(value).replace("LKR ", "") : ""}
                      </span>
                      <span
                        className={`w-full max-w-14 rounded-t-lg ${current ? "bg-ink" : "bg-line-strong"}`}
                        style={{
                          height: `${Math.max(value > 0 ? 6 : 2, (value / peak) * 100)}%`,
                        }}
                        title={`${money(value)} in ${SHORT_MONTH(m)}`}
                      />
                      <span
                        className={`text-sm ${current ? "font-semibold" : "text-muted"}`}
                      >
                        {SHORT_MONTH(m)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </AdminCard>
          </section>

          <section aria-labelledby="signups-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="signups-heading" className="text-xl font-semibold">
                Recent sign-ups
              </h2>
              <Link
                href="/admin/villas"
                className="font-medium text-brass-deep underline-offset-4 hover:underline"
              >
                All villas
              </Link>
            </div>
            <AdminCard className="divide-y divide-line overflow-hidden">
              {recentSignups.map((v) => (
                <Link
                  key={v.id}
                  href={`/admin/villas/${v.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-sand/70"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg leading-tight font-semibold">
                      {v.name}
                    </span>
                    <span className="block truncate text-muted">
                      {v.location ? `${v.location} · ` : ""}signed up{" "}
                      {fmtDate(v.createdAt.slice(0, 10))}
                    </span>
                  </span>
                  <VillaStatusBadge status={villaBadge(v)} />
                  <ChevronRight
                    className="size-5 shrink-0 text-line-strong"
                    aria-hidden
                  />
                </Link>
              ))}
              {recentSignups.length === 0 ? (
                <p className="p-5 text-muted">
                  No sign-ups yet.{" "}
                  {settings.signupsOpen
                    ? "Villa owners can register from the landing page."
                    : "Sign-ups are closed in Settings."}
                </p>
              ) : null}
            </AdminCard>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="alerts-heading">
            <h2 id="alerts-heading" className="mb-3 text-xl font-semibold">
              Needs attention
            </h2>
            <AdminCard className="divide-y divide-line overflow-hidden">
              {alerts.length === 0 ? (
                <p className="p-5 text-muted">
                  Nothing needs attention. Every subscription is up to date.
                </p>
              ) : (
                alerts.slice(0, 7).map((a, i) => (
                  <Link
                    key={`${a.villaId}-${a.kind}-${i}`}
                    href={`/admin/villas/${a.villaId}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-sand/70"
                  >
                    <span
                      aria-hidden
                      className={`size-2.5 shrink-0 rounded-full ${a.kind === "overdue" ? "bg-clay" : a.kind === "disabled" || a.kind === "never_signed_in" ? "bg-stone" : "bg-amber"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {a.villaName}
                      </span>
                      <span className="block text-[0.9375rem] text-muted">
                        {a.text}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-5 shrink-0 text-line-strong"
                      aria-hidden
                    />
                  </Link>
                ))
              )}
              {alerts.length > 7 ? (
                <Link
                  href="/admin/subscriptions"
                  className="block px-5 py-3 text-center font-medium text-brass-deep hover:bg-sand/70"
                >
                  {alerts.length - 7} more
                </Link>
              ) : null}
            </AdminCard>
          </section>

          <section aria-labelledby="payments-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="payments-heading" className="text-xl font-semibold">
                Latest card payments
              </h2>
              <Link
                href="/admin/subscriptions"
                className="font-medium text-brass-deep underline-offset-4 hover:underline"
              >
                Subscriptions
              </Link>
            </div>
            <AdminCard className="divide-y divide-line overflow-hidden">
              {recentPayments.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/villas/${p.villaId}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-sand/70"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {villaName.get(p.villaId) ?? "Removed villa"}
                    </span>
                    <span className="block text-[0.9375rem] text-muted">
                      {fmtDate(p.paymentDate)}
                    </span>
                  </span>
                  <span className="tnum font-semibold">{money(p.amount)}</span>
                </Link>
              ))}
              {recentPayments.length === 0 ? (
                <p className="p-5 text-muted">
                  No payments yet. They appear here as soon as a card payment
                  goes through.
                </p>
              ) : null}
            </AdminCard>
          </section>
        </div>
      </div>

      <CreateVillaSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
