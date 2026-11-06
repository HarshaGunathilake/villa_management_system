"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Card, PageHeader } from "@/components/app-shell";
import { guestCount } from "@/lib/availability";
import { downloadCsv } from "@/lib/csv";
import { addMonths, fmtMonthLong, monthKey, nightsBetween } from "@/lib/dates";
import { buildReport, type ReportMonth, type VillaReport } from "@/lib/reports";
import { useLookups, useStore } from "@/lib/store";
import { cn, money } from "@/lib/utils";

/*
 * Reports for the villa owner: income, expenses and profit over a chosen
 * period, where the money comes from and goes to, and CSV files of it all.
 */

// Two series, checked with the colour validator against the white card: blue for income, brass for expenses.
const INCOME = "#2f6da3";
const EXPENSE = "#b5763a";

type Preset = "this_month" | "last_month" | "3" | "6" | "12" | "this_year" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "3", label: "3 months" },
  { id: "6", label: "6 months" },
  { id: "12", label: "12 months" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Choose months" },
];

const shortMonth = (key: string, year = false) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", year ? { month: "short", year: "2-digit" } : { month: "short" });
const compact = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M` : a >= 1000 ? `${Math.round(a / 1000)}k` : String(Math.round(a));
  return n < 0 ? `-${s}` : s;
};

export default function ReportsPage() {
  const store = useStore();
  const { today } = store;
  const { guest } = useLookups();
  const thisMonth = monthKey(today);
  const [preset, setPreset] = useState<Preset>("6");
  const [custom, setCustom] = useState({ from: addMonths(thisMonth, -2), to: thisMonth });

  const [from, to] = useMemo((): [string, string] => {
    switch (preset) {
      case "this_month":
        return [thisMonth, thisMonth];
      case "last_month":
        return [addMonths(thisMonth, -1), addMonths(thisMonth, -1)];
      case "this_year":
        return [`${thisMonth.slice(0, 4)}-01`, thisMonth];
      case "custom":
        return custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
      default:
        return [addMonths(thisMonth, -(Number(preset) - 1)), thisMonth];
    }
  }, [preset, custom, thisMonth]);

  const report = useMemo(() => buildReport(store, from, to), [store, from, to]);
  const period = from === to ? fmtMonthLong(from) : `${fmtMonthLong(from)} to ${fmtMonthLong(to)}`;
  const fileTag = from === to ? from : `${from}_to_${to}`;
  const hasAnything = report.income > 0 || report.expenses > 0;

  /* ------------------------------------------------------------ CSV files */

  const exportSummary = () =>
    downloadCsv(
      `villa-summary-${fileTag}.csv`,
      ["Month", "Income (LKR)", "Expenses (LKR)", "Profit (LKR)", "Bookings", "Nights booked", "Occupancy %"],
      [...report.months.map((m) => [m.month, m.income, m.expenses, m.profit, m.bookings, m.nightsBooked, m.occupancy]), ["Total", report.income, report.expenses, report.profit, report.bookings.length, report.nightsBooked, report.occupancy]],
    );
  const exportBookings = () =>
    downloadCsv(
      `villa-bookings-${fileTag}.csv`,
      ["Booking", "Guest", "Phone", "Stay", "Check-in", "Check-out", "Nights", "Guests", "Source", "Status", "Total (LKR)", "Paid (LKR)", "Balance (LKR)", "Nights in period", "Income in period (LKR)"],
      report.bookings.map((r) => {
        const b = r.booking;
        const g = guest(b.guestId);
        return [
          r.number,
          g?.name,
          g?.phone,
          b.type === "villa" ? "Entire Villa" : store.rooms.find((x) => x.id === b.roomId)?.name ?? "Room",
          b.checkIn,
          b.checkOut,
          nightsBetween(b.checkIn, b.checkOut),
          guestCount(b),
          b.source,
          b.status.replace("_", " "),
          b.total,
          b.paid,
          Math.max(b.total - b.paid, 0),
          r.nightsInPeriod,
          r.incomeInPeriod,
        ];
      }),
    );
  const exportExpenses = () => {
    const list = store.expenses.filter((e) => monthKey(e.date) >= from && monthKey(e.date) <= to).sort((a, b) => a.date.localeCompare(b.date));
    downloadCsv(
      `villa-expenses-${fileTag}.csv`,
      ["Date", "Expense", "Category", "Amount (LKR)", "Note"],
      list.map((e) => [e.date, e.name, e.category, e.amount, e.note ?? ""]),
    );
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle={period} action={<ExportMenu onSummary={exportSummary} onBookings={exportBookings} onExpenses={exportExpenses} />} />

      {/* Period */}
      <div className="mb-6">
        <div role="radiogroup" aria-label="Period" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-[0.9375rem] font-medium whitespace-nowrap",
                preset === p.id ? "border-ink bg-ink text-white" : "border-line-strong bg-card text-ink hover:bg-well",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              From
              <input type="month" value={custom.from} max={thisMonth} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} className="min-h-12 rounded-xl border border-line-strong bg-card px-3 text-base" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              To
              <input type="month" value={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} className="min-h-12 rounded-xl border border-line-strong bg-card px-3 text-base" />
            </label>
          </div>
        ) : null}
      </div>

      {/* Headline figures */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label="Income" value={money(report.income)} note={`${report.bookings.length} ${report.bookings.length === 1 ? "booking" : "bookings"}`} />
        <Tile label="Expenses" value={money(report.expenses)} note={report.byCategory[0] ? `Most on ${report.byCategory[0].label.toLowerCase()}` : "None recorded"} />
        <Tile
          label="Profit"
          value={money(report.profit)}
          tone={report.profit < 0 ? "loss" : report.profit > 0 ? "gain" : undefined}
          note={report.income > 0 ? `${Math.round((report.profit / report.income) * 100)}% of income` : "Income minus expenses"}
        />
        <Tile label="Occupancy" value={`${report.occupancy}%`} note={report.nightsBooked > 0 ? `${report.nightsBooked} nights, ${money(report.averageNight)} a night` : "No nights booked"} />
      </div>

      {!hasAnything ? (
        <Card className="mt-6 p-8 text-center">
          <p className="text-lg font-semibold">Nothing to show for {period}</p>
          <p className="mt-1 text-muted">Bookings and expenses in this period will appear here. Try a longer period.</p>
        </Card>
      ) : (
        <>
          <section aria-labelledby="trend-heading" className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="trend-heading" className="text-xl font-semibold">
                Income and expenses
              </h2>
              <Legend />
            </div>
            <Card className="p-5 sm:p-6">
              <MonthBars months={report.months} />
            </Card>
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Breakdown title="Expenses by category" items={report.byCategory} total={report.expenses} color={EXPENSE} empty="No expenses in this period." />
            <Breakdown title="Income by room" items={report.byPlace} total={report.income} color={INCOME} empty="No income in this period." />
            <Breakdown title="Income by booking source" items={report.bySource} total={report.income} color={INCOME} empty="No income in this period." />
            <Collect report={report} />
          </div>

          <MonthTable report={report} />
        </>
      )}

      <p className="mt-6 text-sm text-muted">
        Income is the value of the nights stayed or booked in each month, so a stay across two months is split between them. Cancelled bookings are left out. Expenses count on their date.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- pieces */

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "gain" | "loss" }) {
  return (
    <Card className={cn("p-4 sm:p-5", tone === "gain" && "border-sage/40 bg-sage-soft", tone === "loss" && "border-clay/30 bg-clay-soft")}>
      <div className="text-[0.9375rem] text-muted">{label}</div>
      <div className={cn("tnum mt-1 text-[1.25rem] leading-tight font-semibold whitespace-nowrap sm:text-[1.75rem]", tone === "gain" && "text-sage-deep", tone === "loss" && "text-clay")}>{value}</div>
      {note ? <div className="mt-1 text-sm text-muted">{note}</div> : null}
    </Card>
  );
}

function Legend() {
  return (
    <div className="flex gap-4 text-sm text-muted">
      {[
        { label: "Income", color: INCOME },
        { label: "Expenses", color: EXPENSE },
      ].map((l) => (
        <span key={l.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm" style={{ background: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  );
}

/** Income and expense bars side by side for each month. Hover or focus a month for its figures. */
function MonthBars({ months }: { months: ReportMonth[] }) {
  const [active, setActive] = useState<string | null>(null);
  const peak = Math.max(1, ...months.flatMap((m) => [m.income, m.expenses]));
  const many = months.length > 8;
  const years = new Set(months.map((m) => m.month.slice(0, 4))).size > 1;
  const shown = months.find((m) => m.month === active);
  const ticks = [0, 0.5, 1].map((f) => Math.round(peak * f));

  return (
    <div>
      <div className="relative">
        {/* Recessive guide lines */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-7">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${(t / peak) * 100}%` }}>
              <span className="tnum absolute -top-2.5 left-0 bg-card pr-1 text-[0.6875rem] text-muted">{compact(t)}</span>
            </div>
          ))}
        </div>
        <ol className={cn("relative flex h-64 items-end pl-9", many ? "gap-1" : "gap-2 sm:gap-4")} aria-label="Income and expenses by month">
          {months.map((m, i) => (
            <li key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <button
                type="button"
                onMouseEnter={() => setActive(m.month)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(m.month)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === m.month ? null : m.month)}
                aria-label={`${fmtMonthLong(m.month)}: income ${money(m.income)}, expenses ${money(m.expenses)}, profit ${money(m.profit)}`}
                className={cn("flex h-[calc(100%-1.75rem)] w-full items-end justify-center gap-0.5 rounded-t-md focus-visible:outline-2 focus-visible:outline-offset-2", active === m.month && "bg-well/70")}
              >
                {[
                  { v: m.income, c: INCOME },
                  { v: m.expenses, c: EXPENSE },
                ].map((s, k) => (
                  <span
                    key={k}
                    className="w-full max-w-7 rounded-t"
                    style={{ height: `${s.v > 0 ? Math.max(1.5, (s.v / peak) * 100) : 0}%`, background: s.c }}
                  />
                ))}
              </button>
              <span aria-hidden className={cn("mt-2 h-5 text-xs whitespace-nowrap text-muted sm:text-sm", many && i % 2 === 1 && "max-sm:invisible", active === m.month && "font-semibold text-ink")}>
                {shortMonth(m.month, years && (i === 0 || m.month.endsWith("-01")))}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* The figures for the month under the pointer, or a hint */}
      <div className="mt-4 min-h-12 rounded-xl bg-well/60 px-4 py-2.5 text-[0.9375rem]" aria-live="polite">
        {shown ? (
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="font-semibold">{fmtMonthLong(shown.month)}</span>
            <span className="tnum">
              Income <b>{money(shown.income)}</b>
            </span>
            <span className="tnum">
              Expenses <b>{money(shown.expenses)}</b>
            </span>
            <span className={cn("tnum", shown.profit < 0 && "text-clay")}>
              Profit <b>{money(shown.profit)}</b>
            </span>
            <span className="tnum text-muted">{shown.occupancy}% booked</span>
          </div>
        ) : (
          <span className="text-muted">Point at or tap a month to see its figures.</span>
        )}
      </div>
    </div>
  );
}

/** One measure split into parts, largest first, as horizontal bars with the amount and share written out. */
function Breakdown({ title, items, total, color, empty }: { title: string; items: { label: string; value: number }[]; total: number; color: string; empty: string }) {
  const [all, setAll] = useState(false);
  const peak = Math.max(1, ...items.map((i) => i.value));
  const list = all ? items : items.slice(0, 6);
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      <Card className="p-5 sm:p-6">
        {items.length === 0 ? (
          <p className="text-muted">{empty}</p>
        ) : (
          <ul className="space-y-4">
            {list.map((i) => (
              <li key={i.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{i.label}</span>
                  <span className="tnum shrink-0">
                    <b>{money(i.value)}</b> <span className="text-sm text-muted">{total > 0 ? `${Math.round((i.value / total) * 100)}%` : ""}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 rounded-full bg-well" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (i.value / peak) * 100)}%`, background: color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {items.length > 6 ? (
          <button type="button" onClick={() => setAll(!all)} className="mt-4 min-h-11 font-medium text-brass-deep underline-offset-4 hover:underline">
            {all ? "Show fewer" : `Show all ${items.length}`}
          </button>
        ) : null}
      </Card>
    </section>
  );
}

function Collect({ report }: { report: VillaReport }) {
  const { guestName } = useLookups();
  const owing = report.bookings.filter((r) => r.booking.total > r.booking.paid).sort((a, b) => b.booking.total - b.booking.paid - (a.booking.total - a.booking.paid));
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Still to collect</h2>
      <Card className="p-5 sm:p-6">
        <div className="tnum text-[1.75rem] leading-tight font-semibold text-amber-deep">{money(report.toCollect)}</div>
        <p className="text-sm text-muted">
          Balances on {owing.length} {owing.length === 1 ? "booking" : "bookings"} in this period
        </p>
        {owing.length > 0 ? (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {owing.slice(0, 5).map((r) => (
              <li key={r.booking.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{guestName(r.booking.guestId)}</span> <span className="text-sm text-muted">{r.number}</span>
                </span>
                <span className="tnum shrink-0 font-semibold">{money(r.booking.total - r.booking.paid)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}

function MonthTable({ report }: { report: VillaReport }) {
  return (
    <section aria-labelledby="table-heading" className="mt-8">
      <h2 id="table-heading" className="mb-3 text-xl font-semibold">
        Month by month
      </h2>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left whitespace-nowrap">
          <thead className="border-b border-line bg-well/50 text-sm text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Month</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Income</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Expenses</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Profit</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Bookings</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Booked</th>
            </tr>
          </thead>
          <tbody className="tnum divide-y divide-line">
            {[...report.months].reverse().map((m) => (
              <tr key={m.month}>
                <th scope="row" className="px-5 py-3 font-medium">{fmtMonthLong(m.month)}</th>
                <td className="px-4 py-3 text-right">{money(m.income)}</td>
                <td className="px-4 py-3 text-right">{money(m.expenses)}</td>
                <td className={cn("px-4 py-3 text-right font-semibold", m.profit < 0 && "text-clay")}>{money(m.profit)}</td>
                <td className="px-4 py-3 text-right">{m.bookings}</td>
                <td className="px-5 py-3 text-right">{m.occupancy}%</td>
              </tr>
            ))}
          </tbody>
          {report.months.length > 1 ? (
            <tfoot className="tnum border-t border-line-strong font-semibold">
              <tr>
                <th scope="row" className="px-5 py-3">Total</th>
                <td className="px-4 py-3 text-right">{money(report.income)}</td>
                <td className="px-4 py-3 text-right">{money(report.expenses)}</td>
                <td className={cn("px-4 py-3 text-right", report.profit < 0 && "text-clay")}>{money(report.profit)}</td>
                <td className="px-4 py-3 text-right">{report.bookings.length}</td>
                <td className="px-5 py-3 text-right">{report.occupancy}%</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </Card>
    </section>
  );
}

/** Three CSV files: the monthly summary, the bookings, and the expenses, all for the chosen period. */
function ExportMenu({ onSummary, onBookings, onExpenses }: { onSummary: () => void; onBookings: () => void; onExpenses: () => void }) {
  const [open, setOpen] = useState(false);
  const pick = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-ink px-5 font-medium text-white hover:bg-black"
      >
        <Download className="size-5" aria-hidden /> Export CSV <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" aria-hidden onClick={() => setOpen(false)} />
          <div role="menu" className="absolute left-0 z-40 mt-2 w-72 sm:right-0 sm:left-auto overflow-hidden rounded-card border border-line bg-card shadow-float" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
            {[
              { label: "Monthly summary", hint: "Income, expenses and profit per month", fn: onSummary },
              { label: "Bookings", hint: "Every booking, with amounts and balances", fn: onBookings },
              { label: "Expenses", hint: "Every expense, with its category", fn: onExpenses },
            ].map((o) => (
              <button key={o.label} type="button" role="menuitem" onClick={pick(o.fn)} className="block w-full px-4 py-3 text-left hover:bg-well focus-visible:bg-well">
                <span className="block font-medium">{o.label}</span>
                <span className="block text-sm text-muted">{o.hint}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
