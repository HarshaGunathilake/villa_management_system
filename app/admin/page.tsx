"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight, CreditCard, Globe, Hourglass, Plus, BellRing, UserPlus, Wallet } from "lucide-react";
import { AdminCard, fmtDate, VillaStatusBadge } from "@/components/admin/ui";
import { IncomeBars } from "@/components/admin/income-bars";
import { CreateVillaSheet } from "@/components/admin/villa-forms";
import { Button } from "@/components/ui/button";
import { villaAlerts } from "@/lib/admin-logic";
import { useAdminData } from "@/lib/admin-store";
import { villaBadge } from "@/lib/admin-types";
import { addDays, addMonths, monthKey } from "@/lib/dates";
import { cn, money } from "@/lib/utils";

/*
 * The Super Admin dashboard: LankaStay as a subscription business at a glance.
 * What comes in each month, who signed up, who has not paid yet, which card
 * payments are in trouble, and how the website is set.
 */

const CARD_TROUBLE = ["on_hold", "past_due"];
const SHORT_MONTH = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" });

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function AdminDashboard() {
  const { villas, admins, payments, today, settings, me } = useAdminData();
  const [creating, setCreating] = useState(false);

  // On a free trial: the card is saved but nothing has been charged yet, so not counted as paying.
  const paying = villas.filter((v) => v.card.status === "active" && v.accountStatus === "active" && !v.trialEndsOn);
  const recurring = paying.reduce((sum, v) => sum + v.monthlyAmount, 0);
  const weekAhead = addDays(today, 7);
  const renewing = paying.filter((v) => v.nextPaymentDate >= today && v.nextPaymentDate <= weekAhead);

  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, i - 5));
  const byMonth = new Map(months.map((m) => [m, 0]));
  const countByMonth = new Map(months.map((m) => [m, 0]));
  for (const p of payments) {
    const m = monthKey(p.paymentDate);
    if (byMonth.has(m)) {
      byMonth.set(m, byMonth.get(m)! + p.amount);
      countByMonth.set(m, countByMonth.get(m)! + 1);
    }
  }
  const collected = byMonth.get(thisMonth) ?? 0;
  const collectedLast = byMonth.get(lastMonth) ?? 0;
  const change = collectedLast > 0 ? Math.round(((collected - collectedLast) / collectedLast) * 100) : null;

  const since = addDays(today, -30);
  const signups = villas.filter((v) => v.signedUp && v.createdAt.slice(0, 10) >= since);
  const signupsPaid = signups.filter((v) => v.disabledReason !== "unpaid").length;
  const awaiting = villas.filter((v) => v.disabledReason === "unpaid");
  const trouble = villas.filter((v) => v.card.status && CARD_TROUBLE.includes(v.card.status));
  const ended = villas.filter((v) => v.disabledReason === "subscription");

  const alerts = villaAlerts(villas, admins, today).filter((a) => !awaiting.some((v) => v.id === a.villaId));
  const recentSignups = [...villas]
    .filter((v) => v.signedUp)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const villaName = new Map(villas.map((v) => [v.id, v.name]));
  const recentPayments = payments.slice(0, 5);
  const first = me.name.split(/\s+/)[0];

  return (
    <div>
      {/* Greeting */}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.875rem] leading-tight font-semibold sm:text-[2.25rem]">
            {greeting()}, {first}
          </h1>
          <p className="mt-1 text-muted">
            {villas.length} {villas.length === 1 ? "villa" : "villas"} on {settings.platformName}, {paying.length} paying by card.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/reports" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line-strong bg-card px-4 font-medium hover:bg-well">
            <BarChart3 className="size-5" /> Reports
          </Link>
          <Button onClick={() => setCreating(true)}>
            <Plus /> Add villa
          </Button>
        </div>
      </header>

      {/* Headline figures */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <div className="relative col-span-2 overflow-hidden rounded-card bg-[#0b5d50] p-6 text-white md:col-span-3 xl:col-span-1 xl:row-span-2">
          <div className="flex items-center gap-2 text-white/75">
            <Wallet className="size-5" aria-hidden /> Monthly recurring income
          </div>
          <div className="tnum mt-3 font-display text-[2.5rem] leading-none font-bold tracking-[-0.03em] sm:text-[3rem]">{money(recurring)}</div>
          <p className="mt-2 text-white/75">
            {paying.length} {paying.length === 1 ? "villa" : "villas"} × {money(settings.defaultMonthlyAmount)}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/15 pt-5">
            <div>
              <div className="text-sm text-white/65">Collected in {SHORT_MONTH(thisMonth)}</div>
              <div className="tnum mt-0.5 text-xl font-semibold">{money(collected)}</div>
            </div>
            <div>
              <div className="text-sm text-white/65">vs {SHORT_MONTH(lastMonth)}</div>
              <div className="tnum mt-0.5 flex items-center gap-1 text-xl font-semibold">
                {change === null ? (
                  "—"
                ) : (
                  <>
                    {change >= 0 ? <ArrowUpRight className="size-5 text-[#8fd3b4]" aria-hidden /> : <ArrowDownRight className="size-5 text-[#f2b35e]" aria-hidden />}
                    {change >= 0 ? "+" : ""}
                    {change}%
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-white/[0.08] px-4 py-3">
            <div className="text-sm text-white/65">Renewing in the next 7 days</div>
            <div className="tnum mt-0.5 font-semibold">
              {renewing.length} {renewing.length === 1 ? "villa" : "villas"} · {money(renewing.reduce((s, v) => s + v.monthlyAmount, 0))}
            </div>
          </div>
        </div>

        <Kpi icon={UserPlus} label="New sign-ups" value={signups.length} note={`Last 30 days · ${signupsPaid} paid`} />
        <Kpi icon={Hourglass} label="Awaiting first payment" value={awaiting.length} note="Signed up, not paid yet" tone={awaiting.length > 0 ? "amber" : undefined} href="/admin/villas" />
        <Kpi icon={AlertTriangle} label="Card problems" value={trouble.length} note={trouble.length > 0 ? "Dodo is retrying" : "All card payments fine"} tone={trouble.length > 0 ? "clay" : undefined} href="/admin/subscriptions" />
        <Kpi icon={CreditCard} label="Paying villas" value={paying.length} note={`${ended.length} ended`} />
        <Kpi
          icon={Globe}
          label="Website"
          value={settings.comingSoon ? "Coming soon" : settings.signupsOpen ? "Open" : "Sign-ups closed"}
          note={settings.comingSoon || !settings.searchIndexing ? "Hidden from search engines" : "Visible to search engines"}
          href="/admin/settings"
          small
        />
        <Kpi icon={BellRing} label="Needs attention" value={alerts.length} note={alerts.length ? "See the list below" : "Nothing to do"} tone={alerts.length ? "amber" : undefined} />
      </div>

      {/* Chart + attention */}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <AdminCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Card payments received</h2>
            <span className="text-sm text-muted">Last 6 months</span>
          </div>
          <IncomeBars months={months} byMonth={byMonth} countByMonth={countByMonth} thisMonth={thisMonth} />
        </AdminCard>

        <AdminCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">Needs attention</h2>
            <span className="tnum rounded-full bg-well px-2.5 py-0.5 text-sm font-medium">{alerts.length}</span>
          </div>
          <div className="divide-y divide-line">
            {alerts.length === 0 ? (
              <p className="p-5 text-muted">Nothing needs attention. Every subscription is up to date.</p>
            ) : (
              alerts.slice(0, 6).map((a, i) => (
                <Link key={`${a.villaId}-${a.kind}-${i}`} href={`/admin/villas/${a.villaId}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-sand">
                  <span
                    aria-hidden
                    className={cn("size-2.5 shrink-0 rounded-full", a.kind === "overdue" ? "bg-clay" : a.kind === "disabled" || a.kind === "never_signed_in" ? "bg-stone" : "bg-amber")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.villaName}</span>
                    <span className="block text-[0.9375rem] text-muted">{a.text}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />
                </Link>
              ))
            )}
            {alerts.length > 6 ? (
              <Link href="/admin/subscriptions" className="block px-5 py-3 text-center font-medium text-brass-deep hover:bg-sand">
                {alerts.length - 6} more
              </Link>
            ) : null}
          </div>
        </AdminCard>
      </div>

      {/* Lists */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <ListCard title="Recent sign-ups" href="/admin/villas" linkLabel="All villas">
          {recentSignups.map((v) => (
            <Link key={v.id} href={`/admin/villas/${v.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-sand">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brass-soft font-display font-semibold text-brass-deep" aria-hidden>
                {v.name.replace(/^villa\s+/i, "").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{v.name}</span>
                <span className="block truncate text-sm text-muted">
                  {v.location ? `${v.location} · ` : ""}
                  {fmtDate(v.createdAt.slice(0, 10))}
                </span>
              </span>
              <VillaStatusBadge status={villaBadge(v)} />
            </Link>
          ))}
          {recentSignups.length === 0 ? (
            <p className="p-5 text-muted">No sign-ups yet. {settings.signupsOpen ? "Villa owners can register from the website." : "Sign-ups are closed in Settings."}</p>
          ) : null}
        </ListCard>

        <ListCard title="Latest card payments" href="/admin/subscriptions" linkLabel="Subscriptions">
          {recentPayments.map((p) => (
            <Link key={p.id} href={`/admin/villas/${p.villaId}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-sand">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage-soft text-sage-deep" aria-hidden>
                <CreditCard className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{villaName.get(p.villaId) ?? "Removed villa"}</span>
                <span className="block text-sm text-muted">{fmtDate(p.paymentDate)}</span>
              </span>
              <span className="tnum font-semibold">{money(p.amount)}</span>
            </Link>
          ))}
          {recentPayments.length === 0 ? <p className="p-5 text-muted">No payments yet. They appear here as soon as a card payment goes through.</p> : null}
        </ListCard>
      </div>

      <CreateVillaSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  note,
  tone,
  href,
  small,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  note: string;
  tone?: "amber" | "clay";
  href?: string;
  small?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-sm text-muted sm:text-[0.9375rem]">{label}</span>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            tone === "amber" ? "bg-amber-soft text-amber-deep" : tone === "clay" ? "bg-clay-soft text-clay" : "bg-brass-soft text-brass-deep",
          )}
          aria-hidden
        >
          <Icon className="size-[1.125rem]" />
        </span>
      </div>
      <div className={cn("tnum mt-2 font-display leading-none font-bold tracking-[-0.02em]", small ? "text-[1.25rem] sm:text-[1.5rem]" : "text-[1.75rem] sm:text-[2rem]", tone === "amber" && "text-amber-deep", tone === "clay" && "text-clay")}>
        {value}
      </div>
      <div className="mt-2 text-sm text-muted">{note}</div>
    </>
  );
  const cls = "block min-w-0 rounded-card border border-line bg-card p-4 shadow-card sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-line-strong")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ListCard({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <AdminCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-brass-deep underline-offset-4 hover:underline">
          {linkLabel} <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </AdminCard>
  );
}

/** Card income per month, with light guide lines; hover or focus a month for the exact figures. */
