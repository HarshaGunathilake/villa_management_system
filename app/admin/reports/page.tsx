"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { AdminCard, AdminHeader, FilterSelect, StatTile } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { ReportMonth, Reports } from "@/lib/admin-types";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { fmtMonthLong } from "@/lib/dates";
import { cn, money } from "@/lib/utils";

/*
 * Super Admin → Reports: how the subscription business is doing, month by month.
 */

const short = (key: string, withYear: boolean) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", withYear ? { month: "short", year: "2-digit" } : { month: "short" });
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en-US"));

export default function ReportsPage() {
  const [range, setRange] = useState("12");
  const [reports, setReports] = useState<Reports | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void api<{ reports: Reports }>(`/api/admin/reports?months=${range}`).then((r) => {
      if (!live) return;
      if (r.ok) {
        setReports(r.reports);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [range]);

  const exportCsv = () => {
    if (!reports) return;
    downloadCsv(
      `lankastay-report-${reports.today}.csv`,
      ["Month", "Income (LKR)", "Card payments", "Sign-ups", "Sign-ups that paid", "Added by Super Admin", "First payments", "Cancellations"],
      reports.months.map((m) => [m.month, m.income, m.payments, m.signups, m.signupsPaid, m.added, m.firstPayments, m.cancellations]),
    );
  };

  const months = reports?.months ?? [];
  const total = (k: keyof Omit<ReportMonth, "month">) => months.reduce((s, m) => s + m[k], 0);
  const signups = total("signups");
  const paid = total("signupsPaid");
  const conversion = reports && reports.now.signups > 0 ? Math.round((reports.now.signupsPaid / reports.now.signups) * 100) : null;

  return (
    <div>
      <AdminHeader
        title="Reports"
        subtitle="Card income, sign-ups and cancellations, month by month"
        action={
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              value={range}
              onChange={setRange}
              label="Period"
              options={[
                { value: "6", label: "Last 6 months" },
                { value: "12", label: "Last 12 months" },
                { value: "24", label: "Last 24 months" },
              ]}
            />
            <Button variant="secondary" onClick={exportCsv} disabled={!reports}>
              <Download /> Export CSV
            </Button>
          </div>
        }
      />

      {error ? <AdminCard className="p-5 text-clay">{error}</AdminCard> : null}
      {!reports && !error ? <AdminCard className="h-64 animate-pulse" aria-label="Loading reports" /> : null}

      {reports ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile label={`Income, last ${range} months`} value={money(total("income"))} note={`${total("payments")} card payments`} />
            <StatTile label="Monthly income now" value={money(reports.now.monthlyIncome)} note={`${reports.now.payingVillas} paying villas`} />
            <StatTile label="Sign-ups that paid" value={conversion === null ? "None yet" : `${conversion}%`} note={`${reports.now.signupsPaid} of ${reports.now.signups} sign-ups, all time`} />
            <StatTile
              label={`Cancellations, last ${range} months`}
              value={total("cancellations")}
              tone={total("cancellations") > 0 ? "warn" : undefined}
              note={`${reports.now.ended} villas ended now`}
            />
          </div>

          <div className="mt-8 grid gap-8 xl:grid-cols-2">
            <section aria-labelledby="income-chart" className="min-w-0">
              <h2 id="income-chart" className="mb-3 text-xl font-semibold">
                Income
              </h2>
              <AdminCard className="p-5 sm:p-6">
                <Bars months={months} series={[{ key: "income", label: "Card income", className: "bg-ink" }]} format={(n) => compact(n)} describe={(m) => `${money(m.income)} from ${m.payments} payments`} />
              </AdminCard>
            </section>

            <section aria-labelledby="signups-chart" className="min-w-0">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="signups-chart" className="text-xl font-semibold">
                  Sign-ups and paid
                </h2>
                <Legend items={[{ label: "Signed up", className: "bg-line-strong" }, { label: "Have paid", className: "bg-sage" }]} />
              </div>
              <AdminCard className="p-5 sm:p-6">
                <Bars
                  months={months}
                  series={[
                    { key: "signups", label: "Signed up", className: "bg-line-strong" },
                    { key: "signupsPaid", label: "Have paid", className: "bg-sage" },
                  ]}
                  format={(n) => String(n)}
                  describe={(m) => `${m.signups} signed up, ${m.signupsPaid} of them have paid`}
                />
              </AdminCard>
            </section>
          </div>

          <section aria-labelledby="table-heading" className="mt-8">
            <h2 id="table-heading" className="mb-3 text-xl font-semibold">
              Month by month
            </h2>
            <AdminCard className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left whitespace-nowrap">
                <thead className="border-b border-line bg-sand/60 text-sm text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Month</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Income</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Payments</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Sign-ups</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Paid since</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">First payments</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Added by you</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Cancellations</th>
                  </tr>
                </thead>
                <tbody className="tnum divide-y divide-line">
                  {[...months].reverse().map((m) => (
                    <tr key={m.month}>
                      <th scope="row" className="px-5 py-3 font-medium">{fmtMonthLong(m.month)}</th>
                      <td className="px-4 py-3 text-right font-semibold">{money(m.income)}</td>
                      <td className="px-4 py-3 text-right">{m.payments}</td>
                      <td className="px-4 py-3 text-right">{m.signups}</td>
                      <td className="px-4 py-3 text-right">{m.signupsPaid}</td>
                      <td className="px-4 py-3 text-right">{m.firstPayments}</td>
                      <td className="px-4 py-3 text-right">{m.added}</td>
                      <td className={cn("px-5 py-3 text-right", m.cancellations > 0 && "font-semibold text-clay")}>{m.cancellations}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="tnum border-t border-line-strong font-semibold">
                  <tr>
                    <th scope="row" className="px-5 py-3">Total</th>
                    <td className="px-4 py-3 text-right">{money(total("income"))}</td>
                    <td className="px-4 py-3 text-right">{total("payments")}</td>
                    <td className="px-4 py-3 text-right">{signups}</td>
                    <td className="px-4 py-3 text-right">{paid}</td>
                    <td className="px-4 py-3 text-right">{total("firstPayments")}</td>
                    <td className="px-4 py-3 text-right">{total("added")}</td>
                    <td className="px-5 py-3 text-right">{total("cancellations")}</td>
                  </tr>
                </tfoot>
              </table>
            </AdminCard>
            <p className="mt-3 text-sm text-muted">
              “Paid since” counts the month’s sign-ups that have made at least one card payment by now. Cancellations are card subscriptions that were cancelled or expired.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex gap-4 text-sm text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-3 rounded-sm", i.className)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

type NumberKey = keyof Omit<ReportMonth, "month">;

/** Month columns with one or two bars each; values are written above, so colour is never the only cue. */
function Bars({ months, series, format, describe }: { months: ReportMonth[]; series: { key: NumberKey; label: string; className: string }[]; format: (n: number) => string; describe: (m: ReportMonth) => string }) {
  const peak = Math.max(1, ...months.flatMap((m) => series.map((s) => m[s.key])));
  const many = months.length > 12;
  const yearChanges = new Set(months.map((m) => m.month.slice(0, 4))).size > 1;
  return (
    <ol className={cn("flex h-56 items-end", many ? "gap-1" : "gap-2 sm:gap-3")} aria-label={series.map((s) => s.label).join(" and ")}>
      {months.map((m, i) => (
        <li key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${fmtMonthLong(m.month)}: ${describe(m)}`}>
          <span className="sr-only">
            {fmtMonthLong(m.month)}: {describe(m)}
          </span>
          <div className="flex h-full w-full items-end justify-center gap-0.5" aria-hidden>
            {series.map((s) => {
              const value = m[s.key];
              return (
                <div key={s.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" style={{ maxWidth: series.length > 1 ? "1.5rem" : "3rem" }}>
                  {!many && value > 0 ? <span className={cn("tnum text-[0.6875rem] whitespace-nowrap text-muted sm:text-xs", months.length > 6 && "max-sm:hidden")}>{format(value)}</span> : null}
                  <span className={cn("w-full rounded-t-md", value > 0 ? s.className : "bg-line")} style={{ height: `${Math.max(value > 0 ? 4 : 1.5, (value / peak) * 82)}%` }} />
                </div>
              );
            })}
          </div>
          <span aria-hidden className={cn("max-w-full overflow-hidden text-xs whitespace-nowrap text-muted sm:text-sm", i % 2 === 1 && (many ? "invisible" : months.length > 6 && "max-sm:invisible"))}>
            {short(m.month, yearChanges && i > 0 && m.month.endsWith("-01"))}
          </span>
        </li>
      ))}
    </ol>
  );
}
