"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Plus } from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/app-shell";
import { BillSheet, DueRow, PayBillSheet, dueTone } from "@/components/bill-sheets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BILL_AHEAD_DAYS, billsToPay, dueText, nextDue, repeatText, type BillDue } from "@/lib/bills";
import { fmtDay, fmtFull, fmtMonthLong } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { Bill } from "@/lib/types";
import { money } from "@/lib/utils";

/*
 * Bills that come round again: electricity, water, internet, insurance.
 * Due ones show here and on Home; marking one paid adds it to Expenses.
 */

export default function BillsPage() {
  const { bills, billPayments, today, undoBillPayment, notify, readOnly } = useStore();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [paying, setPaying] = useState<BillDue | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);

  const toPay = billsToPay(bills, billPayments, today);
  const current = bills.filter((b) => b.active);
  const past = bills.filter((b) => !b.active);
  const recent = billPayments.slice(0, 8);
  const nameOf = (id: string) => bills.find((b) => b.id === id)?.name ?? "Deleted bill";

  const card = (b: Bill) => {
    const next = b.active ? nextDue(b, billPayments, today) : null;
    return (
      <Card key={b.id} className="flex flex-col p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-lg leading-tight font-semibold">{b.name}</div>
            <div className="text-muted">{b.category}</div>
          </div>
          <button type="button" onClick={() => setEditing(b)} className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-well hover:text-ink" aria-label={`Edit ${b.name}`}>
            <Pencil className="size-5" />
          </button>
        </div>
        <div className="tnum mt-3 text-xl font-semibold">{b.amount ? money(b.amount) : <span className="text-base font-normal text-muted">No usual amount</span>}</div>
        <div className="mt-1 text-[0.9375rem] text-muted">{repeatText(b)}</div>
        <div className="mt-auto pt-4">
          {next ? (
            next.status === "later" ? (
              <div className="text-[0.9375rem]">Next due {fmtFull(next.due)}</div>
            ) : (
              <button type="button" onClick={() => setPaying(next)} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-well px-4 text-left hover:bg-well/70">
                <span className="min-w-0 flex-1 font-medium">{fmtMonthLong(next.period).split(" ")[0]} bill</span>
                <Badge tone={dueTone(next.status)}>{dueText(next)}</Badge>
              </button>
            )
          ) : (
            <Badge tone="stone">Not paying any more</Badge>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Bills"
        subtitle="Electricity, water, internet and other bills that come round again."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add bill
          </Button>
        }
      />

      {bills.length === 0 ? (
        <EmptyState
          title="No bills added yet"
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus /> Add bill
            </Button>
          }
        >
          Add your electricity, water and internet bills with the day they are due. They show on Home a week before, and go into Expenses when you mark them paid.
        </EmptyState>
      ) : (
        <>
          <section className="mb-8" aria-labelledby="to-pay">
            <SectionTitle>
              <span id="to-pay">To pay</span>
            </SectionTitle>
            {toPay.length ? (
              <Card className="divide-y divide-line overflow-hidden">
                {toPay.map((d) => (
                  <DueRow key={`${d.bill.id}-${d.period}`} due={d} onPay={() => setPaying(d)} />
                ))}
              </Card>
            ) : (
              <Card className="flex items-center gap-3 p-5">
                <CheckCircle2 className="size-6 shrink-0 text-sage-deep" aria-hidden />
                <span>Nothing due in the next {BILL_AHEAD_DAYS} days.</span>
              </Card>
            )}
          </section>

          {current.length ? (
            <section className="mb-8">
              <SectionTitle>Your bills</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{current.map(card)}</div>
            </section>
          ) : null}

          {recent.length ? (
            <section className="mb-8">
              <SectionTitle>Paid lately</SectionTitle>
              <Card className="divide-y divide-line overflow-hidden">
                {recent.map((p) => {
                  const key = `${p.billId}-${p.period}`;
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                      <div className="min-w-0 flex-[1_1_12rem]">
                        <div className="font-medium">
                          {nameOf(p.billId)}, {fmtMonthLong(p.period)}
                        </div>
                        <div className="text-sm text-muted">{p.skipped ? `Skipped ${fmtDay(p.paidOn)}` : `Paid ${fmtDay(p.paidOn)}`}</div>
                      </div>
                      <div className="tnum font-medium">{p.skipped ? <span className="text-muted">Skipped</span> : money(p.amount)}</div>
                      {undoing === key ? (
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setUndoing(null)}>
                            Keep
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              undoBillPayment(p.billId, p.period);
                              notify(p.skipped ? "Skip undone" : "Payment undone and removed from expenses");
                              setUndoing(null);
                            }}
                          >
                            {p.skipped ? "Undo skip" : "Undo payment"}
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => setUndoing(key)}>
                          Undo
                        </Button>
                      )}
                    </div>
                  );
                })}
              </Card>
            </section>
          ) : null}

          {past.length ? (
            <section>
              <button type="button" onClick={() => setShowPast(!showPast)} className="min-h-11 font-medium text-brass-deep underline-offset-4 hover:underline" aria-expanded={showPast}>
                {showPast ? "Hide" : "Show"} bills you no longer pay ({past.length})
              </button>
              {showPast ? <div className="mt-3 grid gap-4 opacity-80 sm:grid-cols-2 xl:grid-cols-3">{past.map(card)}</div> : null}
            </section>
          ) : null}
        </>
      )}

      <BillSheet
        open={adding || !!editing}
        bill={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
      <PayBillSheet due={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
