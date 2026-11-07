"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Pencil, Phone, Plus, UserPlus } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/app-shell";
import { MonthNav } from "@/components/month-nav";
import { PayslipSheet, StaffSheet } from "@/components/staff-sheets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addMonths, fmtDay, fmtMonthLong, monthKey } from "@/lib/dates";
import { payslipNumber, payslipTotals } from "@/lib/payroll";
import { useStore } from "@/lib/store";
import type { Staff } from "@/lib/types";
import { money } from "@/lib/utils";

/*
 * The people who work at the villa and their payslips. A payslip is made for
 * one month; daily-paid staff get the days they worked times their wage.
 * Marking a payslip paid adds it to Expenses under Staff.
 */

export default function StaffPage() {
  const { staff, payslips, today } = useStore();
  const thisMonth = monthKey(today);
  const [month, setMonth] = useState(addMonths(thisMonth, -1));
  const [editing, setEditing] = useState<Staff | null>(null);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const current = staff.filter((s) => s.active);
  const past = staff.filter((s) => !s.active);
  const slips = payslips.filter((p) => p.month === month);
  const totals = slips.reduce((acc, p) => {
    const t = payslipTotals(p);
    return { net: acc.net + t.net, cost: acc.cost + t.cost, unpaid: acc.unpaid + (p.paidOn ? 0 : t.net) };
  }, { net: 0, cost: 0, unpaid: 0 });
  const missing = current.filter((s) => !slips.some((p) => p.staffId === s.id));

  const card = (s: Staff) => {
    const slip = slips.find((p) => p.staffId === s.id);
    return (
      <Card key={s.id} className="flex flex-col p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brass-soft font-semibold text-brass-deep" aria-hidden>
            {s.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg leading-tight font-semibold">{s.name}</div>
            <div className="text-muted">{s.role || "Staff"}</div>
          </div>
          <button type="button" onClick={() => setEditing(s)} className="-mt-1 -mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-well hover:text-ink" aria-label={`Edit ${s.name}`}>
            <Pencil className="size-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
          <span className="tnum text-xl font-semibold">{money(s.rate)}</span>
          <span className="text-muted">{s.payType === "monthly" ? "a month" : "a day"}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {s.epf ? <Badge tone="dusk">EPF and ETF</Badge> : null}
          {s.phone ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Phone className="size-4" aria-hidden /> {s.phone}
            </span>
          ) : null}
        </div>
        <div className="mt-auto pt-4">
          {slip ? (
            <Link href={`/payslip?p=${slip.id}`} className="flex min-h-12 items-center gap-3 rounded-xl bg-well px-4 hover:bg-well/70">
              <FileText className="size-5 shrink-0 text-brass-deep" aria-hidden />
              <span className="min-w-0 flex-1 font-medium">{fmtMonthLong(month)} payslip</span>
              <Badge tone={slip.paidOn ? "sage" : "amber"}>{slip.paidOn ? "Paid" : "Not paid"}</Badge>
            </Link>
          ) : s.active ? (
            <Button variant="secondary" block onClick={() => setPaying(s.id)}>
              <Plus /> Payslip for {fmtMonthLong(month).split(" ")[0]}
            </Button>
          ) : null}
        </div>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="The people who work at your villa, and their payslips."
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus /> Add staff
          </Button>
        }
      />

      {staff.length === 0 ? (
        <EmptyState
          title="No staff added yet"
          action={
            <Button onClick={() => setAdding(true)}>
              <UserPlus /> Add staff
            </Button>
          }
        >
          Add your caretaker, cook or cleaners, with a monthly salary or a daily wage. Then make their payslips each month.
        </EmptyState>
      ) : (
        <>
          <MonthNav value={month} onChange={setMonth} max={thisMonth} />

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-muted">Net pay</div>
              <div className="tnum mt-1 text-2xl font-semibold">{money(totals.net)}</div>
              <div className="text-sm text-muted">{slips.length} {slips.length === 1 ? "payslip" : "payslips"}</div>
            </Card>
            <Card className="p-4">
              <div className="text-muted">Cost to the villa</div>
              <div className="tnum mt-1 text-2xl font-semibold">{money(totals.cost)}</div>
              <div className="text-sm text-muted">Including EPF and ETF</div>
            </Card>
            <Card className="p-4">
              <div className="text-muted">Still to pay</div>
              <div className={`tnum mt-1 text-2xl font-semibold ${totals.unpaid ? "text-amber-deep" : ""}`}>{money(totals.unpaid)}</div>
              <div className="text-sm text-muted">{missing.length ? `${missing.length} without a payslip` : "Everyone has a payslip"}</div>
            </Card>
          </div>

          {current.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{current.map(card)}</div> : null}

          {slips.length ? (
            <section className="mt-8" aria-labelledby="slips-title">
              <h2 id="slips-title" className="mb-3 text-xl font-semibold">
                Payslips for {fmtMonthLong(month)}
              </h2>
              <Card className="divide-y divide-line overflow-hidden">
                {slips.map((p) => {
                  const t = payslipTotals(p);
                  return (
                    <Link key={p.id} href={`/payslip?p=${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-well/60">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{p.staffName}</div>
                        <div className="text-sm text-muted">
                          {payslipNumber(p.number)}
                          {p.payType === "daily" ? `, ${p.days} days` : ""}
                          {p.paidOn ? `, paid ${fmtDay(p.paidOn)}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tnum font-semibold">{money(t.net)}</div>
                        <Badge tone={p.paidOn ? "sage" : "amber"} className="mt-1">
                          {p.paidOn ? "Paid" : "Not paid"}
                        </Badge>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />
                    </Link>
                  );
                })}
              </Card>
            </section>
          ) : null}

          {past.length ? (
            <section className="mt-8">
              <button type="button" onClick={() => setShowPast(!showPast)} className="min-h-11 font-medium text-brass-deep underline-offset-4 hover:underline" aria-expanded={showPast}>
                {showPast ? "Hide" : "Show"} past staff ({past.length})
              </button>
              {showPast ? <div className="mt-3 grid gap-4 opacity-80 sm:grid-cols-2 xl:grid-cols-3">{past.map(card)}</div> : null}
            </section>
          ) : null}
        </>
      )}

      <StaffSheet open={adding || !!editing} staff={editing} onClose={() => { setAdding(false); setEditing(null); }} />
      <PayslipSheet open={!!paying} staffId={paying} month={month} onClose={() => setPaying(null)} />
    </div>
  );
}
