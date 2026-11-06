"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreditCard, Download, HandCoins } from "lucide-react";
import { IncomeBars } from "@/components/admin/income-bars";
import { AdminCard, AdminHeader, FilterSelect, fmtDate, SearchInput, StatTile } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { useAdminData } from "@/lib/admin-store";
import type { SubscriptionPayment } from "@/lib/admin-types";
import { downloadCsv } from "@/lib/csv";
import { addDays, addMonths, fmtMonthLong, monthKey } from "@/lib/dates";
import { cn, money } from "@/lib/utils";

/*
 * Every subscription payment the platform has received, on its own page:
 * income by month, the payments coming up, and the full list with filters and CSV.
 */

type Method = "all" | "card" | "manual";

const isCard = (p: SubscriptionPayment) => p.createdBy === "Dodo Payments";
const methodLabel = (p: SubscriptionPayment) => (isCard(p) ? "Card (Dodo)" : p.note || "Recorded by hand");
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export default function PaymentsPage() {
  const { villas, payments, today } = useAdminData();
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const [villaId, setVillaId] = useState("all");
  const [method, setMethod] = useState<Method>("all");

  const villaName = useMemo(() => new Map(villas.map((v) => [v.id, v.name])), [villas]);
  const nameOf = (id: string) => villaName.get(id) ?? "Removed villa";

  // Tiles
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);
  const sumWhere = (keep: (p: SubscriptionPayment) => boolean) => payments.filter(keep).reduce((s, p) => s + p.amount, 0);
  const countWhere = (keep: (p: SubscriptionPayment) => boolean) => payments.filter(keep).length;
  const inMonth = (m: string) => (p: SubscriptionPayment) => monthKey(p.paymentDate) === m;
  const year = today.slice(0, 4);
  const thisYear = (p: SubscriptionPayment) => p.paymentDate.startsWith(year);
  const now = sumWhere(inMonth(thisMonth));
  const before = sumWhere(inMonth(lastMonth));
  const change = before > 0 ? Math.round(((now - before) / before) * 100) : null;

  // Coming up: live card subscriptions charging in the next 30 days
  const horizon = addDays(today, 30);
  const upcoming = villas
    .filter((v) => v.card.status === "active" && v.accountStatus === "active" && v.nextPaymentDate >= today && v.nextPaymentDate <= horizon)
    .sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate));
  const upcomingTotal = upcoming.reduce((s, v) => s + v.monthlyAmount, 0);

  // Last 12 months for the chart
  const months = Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, i - 11));
  const byMonth = new Map(months.map((m) => [m, sumWhere(inMonth(m))]));
  const countByMonth = new Map(months.map((m) => [m, countWhere(inMonth(m))]));

  // The list
  const monthOptions = [...new Set(payments.map((p) => monthKey(p.paymentDate)))].sort().reverse();
  const paidVillas = villas.filter((v) => payments.some((p) => p.villaId === v.id)).sort((a, b) => a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  const list = payments.filter(
    (p) =>
      (month === "all" || monthKey(p.paymentDate) === month) &&
      (villaId === "all" || p.villaId === villaId) &&
      (method === "all" || (method === "card") === isCard(p)) &&
      (!q || [nameOf(p.villaId), p.note, p.createdBy, String(p.amount)].some((s) => s.toLowerCase().includes(q))),
  );
  const listTotal = list.reduce((s, p) => s + p.amount, 0);
  const filtered = !!q || month !== "all" || villaId !== "all" || method !== "all";

  const exportCsv = () =>
    downloadCsv(
      `payments-${month === "all" ? today : month}.csv`,
      ["Date", "Villa", "Amount (LKR)", "Covers from", "Covers to", "Method", "Recorded by", "Status"],
      list.map((p) => [p.paymentDate, nameOf(p.villaId), p.amount, p.periodStart, p.periodEnd, isCard(p) ? "Card" : p.note || "By hand", p.createdBy, p.status]),
    );

  return (
    <div>
      <AdminHeader
        title="Payments"
        subtitle="Every subscription payment received from villas. Card payments are added by themselves when Dodo confirms them."
        action={
          <Button variant="secondary" onClick={exportCsv} disabled={list.length === 0}>
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="This month"
          value={money(now)}
          note={change === null ? plural(countWhere(inMonth(thisMonth)), "payment") : `${change >= 0 ? "+" : ""}${change}% on last month`}
        />
        <StatTile label="Last month" value={money(before)} note={plural(countWhere(inMonth(lastMonth)), "payment")} />
        <StatTile label={`So far in ${year}`} value={money(sumWhere(thisYear))} note={plural(countWhere(thisYear), "payment")} />
        <StatTile label="All time" value={money(sumWhere(() => true))} note={plural(payments.length, "payment")} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <AdminCard className="p-5">
          <h2 className="text-lg font-semibold">Income by month</h2>
          <p className="text-sm text-muted">The last 12 months</p>
          <IncomeBars months={months} byMonth={byMonth} countByMonth={countByMonth} thisMonth={thisMonth} label="Payments received in each of the last 12 months" />
        </AdminCard>

        <AdminCard className="flex flex-col p-5">
          <h2 className="text-lg font-semibold">Coming up</h2>
          <p className="text-sm text-muted">Card charges in the next 30 days</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tnum font-display text-[1.75rem] leading-none font-bold">{money(upcomingTotal)}</span>
            <span className="text-sm text-muted">from {plural(upcoming.length, "villa")}</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-muted">No card charges due in the next 30 days.</p>
          ) : (
            <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto">
              {upcoming.map((v) => (
                <li key={v.id} className="flex items-baseline gap-3 py-2.5">
                  <span className="tnum w-20 shrink-0 text-sm text-muted">{fmtDate(v.nextPaymentDate).replace(/ \d{4}$/, "")}</span>
                  <Link href={`/admin/villas/${v.id}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                    {v.name}
                  </Link>
                  <span className="tnum font-semibold">{money(v.monthlyAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <section aria-labelledby="all-payments" className="mt-10">
        <h2 id="all-payments" className="mb-3 text-xl font-semibold">
          All payments
        </h2>
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by villa, note or amount" label="Search payments" />
          <FilterSelect value={month} onChange={setMonth} label="Month" options={[{ value: "all", label: "All months" }, ...monthOptions.map((m) => ({ value: m, label: fmtMonthLong(m) }))]} />
          <FilterSelect value={villaId} onChange={setVillaId} label="Villa" options={[{ value: "all", label: "All villas" }, ...paidVillas.map((v) => ({ value: v.id, label: v.name }))]} className="max-w-56" />
          <FilterSelect
            value={method}
            onChange={(v) => setMethod(v as Method)}
            label="Method"
            options={[
              { value: "all", label: "Card and by hand" },
              { value: "card", label: "Card only" },
              { value: "manual", label: "By hand only" },
            ]}
          />
        </div>

        <AdminCard className="overflow-hidden">
          {list.length === 0 ? (
            <p className="p-5 text-muted">{filtered ? "No payments match these filters." : "No payments received yet."}</p>
          ) : (
            <>
              <div className="hidden grid-cols-[7.5rem_minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_7.5rem] gap-4 border-b border-line bg-sand/60 px-5 py-3 text-sm font-medium text-muted md:grid">
                <span>Date</span>
                <span>Villa</span>
                <span>Covers</span>
                <span>Method</span>
                <span className="text-right">Amount</span>
              </div>
              <ul className="divide-y divide-line">
                {list.map((p) => {
                  const card = isCard(p);
                  const Icon = card ? CreditCard : HandCoins;
                  return (
                    <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-5 py-3.5 md:grid-cols-[7.5rem_minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_7.5rem] md:items-center">
                      <span className="tnum col-span-2 text-sm text-muted md:col-span-1 md:text-base md:text-ink">{fmtDate(p.paymentDate)}</span>
                      <Link href={`/admin/villas/${p.villaId}`} className="min-w-0 truncate font-semibold underline-offset-4 hover:underline md:font-medium">
                        {nameOf(p.villaId)}
                      </Link>
                      <span className="tnum row-start-2 col-start-2 text-right font-semibold md:hidden">{money(p.amount)}</span>
                      <span className="col-span-2 text-[0.9375rem] text-muted md:col-span-1">
                        {fmtDate(p.periodStart)} to {fmtDate(p.periodEnd)}
                      </span>
                      <span className={cn("col-span-2 flex min-w-0 items-center gap-1.5 text-[0.9375rem] md:col-span-1", card ? "text-ink" : "text-muted")}>
                        <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                        <span className="truncate">
                          {methodLabel(p)}
                          {!card && p.createdBy ? `, by ${p.createdBy}` : ""}
                        </span>
                      </span>
                      <span className="tnum hidden text-right font-semibold md:block">{money(p.amount)}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-between border-t border-line bg-sand/40 px-5 py-3.5 font-semibold">
                <span>{plural(list.length, "payment")}</span>
                <span className="tnum">{money(listTotal)}</span>
              </div>
            </>
          )}
        </AdminCard>
      </section>
    </div>
  );
}
