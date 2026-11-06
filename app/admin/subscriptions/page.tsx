"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import {
  AdminCard,
  AdminHeader,
  CARD_LABEL,
  CardBadge,
  FilterSelect,
  fmtDate,
  relativeDay,
  SearchInput,
  StatTile,
  TabBar,
  VillaStatusBadge,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import { BADGE_LABEL, villaBadge, type AdminUser, type AdminVilla, type SubscriptionPayment } from "@/lib/admin-types";
import { downloadCsv } from "@/lib/csv";
import { addMonths, fmtMonthLong, monthKey } from "@/lib/dates";
import { cn, money } from "@/lib/utils";

/*
 * Every villa's subscription in one place: what Dodo says about the card,
 * when it is charged next, what it has paid, and the full payment history.
 */

type Filter = "all" | "paying" | "awaiting" | "trouble" | "due" | "ended" | "off";
type Sort = "next" | "name" | "paid" | "newest";

const TROUBLE = ["on_hold", "past_due"];

function filterOf(v: AdminVilla): Exclude<Filter, "all"> | null {
  if (v.accountStatus === "disabled") return v.disabledReason === "unpaid" ? "awaiting" : v.disabledReason === "subscription" ? "ended" : "off";
  if (v.card.status && TROUBLE.includes(v.card.status)) return "trouble";
  if (v.subscriptionStatus !== "active") return "due";
  if (v.card.status === "active") return "paying";
  return null;
}

interface Row {
  villa: AdminVilla;
  owner: AdminUser | undefined;
  payments: SubscriptionPayment[];
  total: number;
  last: SubscriptionPayment | undefined;
}

export default function SubscriptionsPage() {
  const { act, notify } = useAdmin();
  const { villas, admins, payments, today } = useAdminData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("next");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      villas.map((villa) => {
        const own = payments.filter((p) => p.villaId === villa.id);
        return { villa, owner: admins.find((a) => a.villaId === villa.id), payments: own, total: own.reduce((s, p) => s + p.amount, 0), last: own[0] };
      }),
    [villas, admins, payments],
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.villa.name, r.villa.location, r.villa.email, r.owner?.name, r.owner?.email, r.villa.card.subscriptionId, r.villa.card.customerId].some((s) => s?.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const count = (f: Filter) => (f === "all" ? searched.length : searched.filter((r) => filterOf(r.villa) === f).length);
  const list = (filter === "all" ? searched : searched.filter((r) => filterOf(r.villa) === filter)).sort((a, b) => {
    if (sort === "name") return a.villa.name.localeCompare(b.villa.name);
    if (sort === "paid") return b.total - a.total;
    if (sort === "newest") return b.villa.createdAt.localeCompare(a.villa.createdAt);
    return a.villa.nextPaymentDate.localeCompare(b.villa.nextPaymentDate);
  });

  // Figures for the tiles
  const paying = villas.filter((v) => v.card.status === "active" && v.accountStatus === "active");
  const thisMonth = monthKey(today);
  const collected = payments.filter((p) => monthKey(p.paymentDate) === thisMonth).reduce((s, p) => s + p.amount, 0);
  const lastMonth = payments.filter((p) => monthKey(p.paymentDate) === addMonths(thisMonth, -1)).reduce((s, p) => s + p.amount, 0);
  const lifetime = payments.reduce((s, p) => s + p.amount, 0);

  const markDue = async (v: AdminVilla) => {
    const result = await act({ type: "setSubscriptionStatus", id: v.id, status: "payment_due" });
    notify(result.ok ? `${v.name} marked as payment due` : result.error);
  };

  const exportCsv = () => {
    downloadCsv(
      `subscriptions-${today}.csv`,
      ["Villa", "Location", "Owner", "Owner email", "Status", "Card (Dodo)", "Monthly price (LKR)", "Next charge", "Last payment", "Last amount (LKR)", "Payments", "Total paid (LKR)", "Signed up", "Dodo subscription id", "Dodo customer id"],
      list.map((r) => [
        r.villa.name,
        r.villa.location,
        r.owner?.name,
        r.owner?.email,
        BADGE_LABEL[villaBadge(r.villa)],
        CARD_LABEL(r.villa.card.status),
        r.villa.monthlyAmount,
        r.villa.card.status === "active" ? r.villa.nextPaymentDate : "",
        r.last?.paymentDate,
        r.last?.amount,
        r.payments.length,
        r.total,
        r.villa.createdAt.slice(0, 10),
        r.villa.card.subscriptionId,
        r.villa.card.customerId,
      ]),
    );
  };

  return (
    <div>
      <AdminHeader
        title="Subscriptions"
        subtitle="Villas pay by card through Dodo Payments. Payments are recorded by themselves."
        action={
          <Button variant="secondary" onClick={exportCsv} disabled={list.length === 0}>
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Monthly income" value={money(paying.reduce((s, v) => s + v.monthlyAmount, 0))} note={`${paying.length} paying by card`} />
        <StatTile
          label="Collected this month"
          value={money(collected)}
          note={lastMonth > 0 ? `${money(lastMonth)} last month` : "Nothing last month"}
        />
        <StatTile label="Collected in total" value={money(lifetime)} note={`${payments.length} card ${payments.length === 1 ? "payment" : "payments"}`} />
        <StatTile
          label="Card problems"
          value={villas.filter((v) => v.card.status && TROUBLE.includes(v.card.status)).length}
          tone={villas.some((v) => v.card.status && TROUBLE.includes(v.card.status)) ? "warn" : undefined}
          note="Dodo is retrying"
        />
      </div>

      <div className="mt-8 mb-4 flex flex-wrap gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by villa, owner, email or Dodo id" label="Search subscriptions" />
        <FilterSelect
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          label="Sort by"
          options={[
            { value: "next", label: "Next charge first" },
            { value: "name", label: "Villa name" },
            { value: "paid", label: "Most paid" },
            { value: "newest", label: "Newest first" },
          ]}
        />
      </div>

      <TabBar
        label="Filter subscriptions"
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "all", label: "All", count: count("all") },
          { id: "paying", label: "Paying", count: count("paying") },
          { id: "trouble", label: "Card problems", count: count("trouble") },
          { id: "due", label: "Payment due", count: count("due") },
          { id: "awaiting", label: "Awaiting first payment", count: count("awaiting") },
          { id: "ended", label: "Ended", count: count("ended") },
          { id: "off", label: "Switched off", count: count("off") },
        ]}
      />

      {list.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-lg font-semibold">No subscriptions here</p>
          <p className="mt-1 text-muted">Try a different search or filter.</p>
        </div>
      ) : (
        <AdminCard className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_2.5rem] gap-4 border-b border-line bg-sand/60 px-5 py-3 text-sm font-medium text-muted lg:grid">
            <span>Villa and owner</span>
            <span>Status</span>
            <span>Next charge</span>
            <span>Last payment</span>
            <span className="text-right">Total paid</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {list.map((r) => {
              const expanded = open === r.villa.id;
              const charging = r.villa.card.status === "active";
              return (
                <li key={r.villa.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : r.villa.id)}
                    aria-expanded={expanded}
                    className="grid w-full gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-sand/60 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_2.5rem] lg:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg leading-tight font-semibold">{r.villa.name}</span>
                      <span className="block truncate text-[0.9375rem] text-muted">{r.owner ? `${r.owner.name} · ${r.owner.email}` : "No owner login"}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <VillaStatusBadge status={villaBadge(r.villa)} />
                      <CardBadge status={r.villa.card.status} />
                    </span>
                    <span>
                      <span className="text-sm text-muted lg:hidden">Next charge: </span>
                      {charging ? (
                        <>
                          <span className="tnum font-medium">{fmtDate(r.villa.nextPaymentDate)}</span>
                          <span className="block text-sm text-muted">
                            {money(r.villa.monthlyAmount)}, {relativeDay(today, r.villa.nextPaymentDate)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">None scheduled</span>
                      )}
                    </span>
                    <span>
                      <span className="text-sm text-muted lg:hidden">Last payment: </span>
                      {r.last ? (
                        <>
                          <span className="tnum font-medium">{fmtDate(r.last.paymentDate)}</span>
                          <span className="block text-sm text-muted">{money(r.last.amount)}</span>
                        </>
                      ) : (
                        <span className="text-muted">No payment yet</span>
                      )}
                    </span>
                    <span className="lg:text-right">
                      <span className="text-sm text-muted lg:hidden">Total paid: </span>
                      <span className="tnum font-semibold">{money(r.total)}</span>
                      <span className="block text-sm text-muted">
                        {r.payments.length} {r.payments.length === 1 ? "payment" : "payments"}
                      </span>
                    </span>
                    <ChevronDown className={cn("hidden size-5 justify-self-end text-muted transition-transform lg:block", expanded && "rotate-180")} aria-hidden />
                  </button>

                  {expanded ? (
                    <div className="grid gap-6 border-t border-line bg-sand/40 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.9375rem]">
                        <dt className="text-muted">Price</dt>
                        <dd>{money(r.villa.monthlyAmount)} a month</dd>
                        <dt className="text-muted">Started</dt>
                        <dd>{fmtDate(r.villa.subscriptionStartDate)}</dd>
                        <dt className="text-muted">Signed up</dt>
                        <dd>
                          {fmtDate(r.villa.createdAt.slice(0, 10))}
                          {r.villa.signedUp ? ", on the Register page" : ", added by you"}
                        </dd>
                        <dt className="text-muted">Owner phone</dt>
                        <dd>{r.owner?.phone || r.villa.phone || "Not given"}</dd>
                        <dt className="text-muted">Dodo subscription</dt>
                        <dd className="truncate font-mono text-sm">{r.villa.card.subscriptionId ?? "None yet"}</dd>
                        <dt className="text-muted">Dodo customer</dt>
                        <dd className="truncate font-mono text-sm">{r.villa.card.customerId ?? "None yet"}</dd>
                      </dl>
                      <div className="min-w-0">
                        <h3 className="mb-2 font-semibold">Payments</h3>
                        {r.payments.length === 0 ? (
                          <p className="text-muted">No payments yet.</p>
                        ) : (
                          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                            {r.payments.map((p) => (
                              <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 px-4 py-2.5 text-[0.9375rem]">
                                <span className="tnum w-28 shrink-0">{fmtDate(p.paymentDate)}</span>
                                <span className="min-w-0 flex-1 text-muted">
                                  Covers {fmtDate(p.periodStart)} to {fmtDate(p.periodEnd)}
                                </span>
                                <span className="tnum font-semibold">{money(p.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/admin/villas/${r.villa.id}`} className="inline-flex min-h-10 items-center rounded-[0.625rem] border border-line-strong bg-card px-3.5 text-[0.9375rem] font-medium hover:bg-well">
                            Open villa
                          </Link>
                          <Button variant="secondary" size="sm" disabled={r.villa.subscriptionStatus !== "active" || r.villa.accountStatus !== "active"} onClick={() => markDue(r.villa)}>
                            Mark payment due
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </AdminCard>
      )}

      <PaymentHistory />
    </div>
  );
}

/** Every card payment, filterable by month and villa, with CSV export. */
function PaymentHistory() {
  const { villas, payments, today } = useAdminData();
  const [month, setMonth] = useState("all");
  const [villaId, setVillaId] = useState("all");
  const villaName = new Map(villas.map((v) => [v.id, v.name]));
  const months = [...new Set(payments.map((p) => monthKey(p.paymentDate)))].sort().reverse();
  const list = payments.filter((p) => (month === "all" || monthKey(p.paymentDate) === month) && (villaId === "all" || p.villaId === villaId));
  const total = list.reduce((s, p) => s + p.amount, 0);

  const exportCsv = () =>
    downloadCsv(
      `card-payments-${month === "all" ? today : month}.csv`,
      ["Date", "Villa", "Amount (LKR)", "Covers from", "Covers to", "Method", "Status"],
      list.map((p) => [p.paymentDate, villaName.get(p.villaId) ?? "Removed villa", p.amount, p.periodStart, p.periodEnd, p.note || "Card payment", p.status]),
    );

  return (
    <section aria-labelledby="history-heading" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-heading" className="text-xl font-semibold">
          Payment history
        </h2>
        <div className="flex flex-wrap gap-2">
          <FilterSelect value={month} onChange={setMonth} label="Month" options={[{ value: "all", label: "All months" }, ...months.map((m) => ({ value: m, label: fmtMonthLong(m) }))]} />
          <FilterSelect value={villaId} onChange={setVillaId} label="Villa" options={[{ value: "all", label: "All villas" }, ...villas.map((v) => ({ value: v.id, label: v.name }))]} className="max-w-56" />
          <Button variant="secondary" onClick={exportCsv} disabled={list.length === 0}>
            <Download /> CSV
          </Button>
        </div>
      </div>
      <AdminCard>
        {list.length === 0 ? (
          <p className="p-5 text-muted">No payments{month !== "all" || villaId !== "all" ? " for this filter" : " recorded yet"}.</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {list.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-5 py-3.5">
                  <span className="tnum w-28 shrink-0 text-muted">{fmtDate(p.paymentDate)}</span>
                  <span className="min-w-0 flex-1 basis-52">
                    <Link href={`/admin/villas/${p.villaId}`} className="font-medium underline-offset-4 hover:underline">
                      {villaName.get(p.villaId) ?? "Removed villa"}
                    </Link>
                    <span className="text-muted">
                      , {fmtDate(p.periodStart)} to {fmtDate(p.periodEnd)}
                    </span>
                  </span>
                  <span className="tnum font-semibold">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-line px-5 py-3.5 font-semibold">
              <span>
                {list.length} {list.length === 1 ? "payment" : "payments"}
              </span>
              <span className="tnum">{money(total)}</span>
            </div>
          </>
        )}
      </AdminCard>
    </section>
  );
}
