"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, Field, Input, MoneyInput, Textarea, Toggle } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { REPEAT_LABEL, dueDate, dueText, firstDueMonth, ordinal, repeatText, type BillDue } from "@/lib/bills";
import { addMonths, fmtFull, fmtMonthLong, fmtMonthShort, monthKey } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { BILL_REPEATS, EXPENSE_CATEGORIES, type Bill, type BillRepeat, type ExpenseCategory } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { ReceiptPicker, type Receipt } from "@/components/receipt-picker";

const selectClass =
  "min-h-12 w-full rounded-xl border border-line-strong bg-card px-4 text-base focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none";

/** Common bills, and the expense category each one goes under. */
const SUGGESTIONS: { name: string; category: ExpenseCategory }[] = [
  { name: "Electricity", category: "Electricity" },
  { name: "Water", category: "Water" },
  { name: "Internet", category: "Internet" },
  { name: "Phone", category: "Internet" },
  { name: "TV", category: "Internet" },
  { name: "Gas", category: "Other" },
  { name: "Insurance", category: "Other" },
  { name: "Rent", category: "Other" },
];

/** The number of bills overdue or due in the next 3 days; red when any is overdue. Nothing when none. */
export function BillCount({ dues, className }: { dues: BillDue[]; className?: string }) {
  if (dues.length === 0) return null;
  const overdue = dues.some((d) => d.status === "overdue");
  return (
    <span
      className={cn("tnum grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[0.8125rem] leading-none font-semibold text-white", overdue ? "bg-clay" : "bg-amber-deep", className)}
      aria-label={`${dues.length} ${dues.length === 1 ? "bill" : "bills"} ${overdue ? "overdue or due soon" : "due soon"}`}
    >
      {dues.length}
    </span>
  );
}

/* ------------------------------------------------------------ add or edit */

export function BillSheet({ open, onClose, bill }: { open: boolean; onClose: () => void; bill?: Bill | null }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={bill ? "Edit bill" : "Add a bill"}>
      {open ? <BillForm bill={bill ?? null} onClose={onClose} /> : null}
    </Sheet>
  );
}

function BillForm({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const { addBill, updateBill, removeBill, billPayments, today, notify } = useStore();
  const [name, setName] = useState(bill?.name ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(bill?.category ?? "Other");
  const [amount, setAmount] = useState(bill?.amount ?? 0);
  const [repeat, setRepeat] = useState<BillRepeat>(bill?.repeat ?? "monthly");
  const [dueDay, setDueDay] = useState(bill?.dueDay ?? 10);
  const [startMonth, setStartMonth] = useState(bill?.startMonth ?? firstDueMonth(10, today));
  const [startTouched, setStartTouched] = useState(!!bill);
  const [note, setNote] = useState(bill?.note ?? "");
  const [active, setActive] = useState(bill?.active ?? true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const paidCount = bill ? billPayments.filter((p) => p.billId === bill.id && !p.skipped).length : 0;

  const thisMonth = monthKey(today);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, i));
  if (!months.includes(startMonth)) months.unshift(startMonth);
  const valid = name.trim().length >= 2;

  const pickDay = (day: number) => {
    setDueDay(day);
    if (!startTouched) setStartMonth(firstDueMonth(day, today));
  };

  const save = () => {
    const input = { name: name.trim(), category, amount, repeat, dueDay, startMonth, note: note.trim() || undefined, active };
    if (bill) {
      updateBill(bill.id, input);
      notify("Saved");
    } else if (addBill(input)) notify(`${input.name} added`);
    onClose();
  };

  return (
    <div className="space-y-6">
      <div>
        <Field label="Bill">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="e.g. Electricity" />}</Field>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Chip
              key={s.name}
              selected={name === s.name}
              onClick={() => {
                setName(s.name);
                setCategory(s.category);
              }}
              className="min-h-10 px-3.5 text-sm"
            >
              {s.name}
            </Chip>
          ))}
        </div>
      </div>

      <Field label="Usual amount" hint="Used when you mark it paid. You can change it then if this month's bill is different.">
        {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
      </Field>

      <div>
        <div className="mb-2 font-medium">How often?</div>
        <div className="grid grid-cols-3 gap-2">
          {BILL_REPEATS.map((r) => (
            <Chip key={r} selected={repeat === r} onClick={() => setRepeat(r)} className="px-2 leading-tight">
              {REPEAT_LABEL[r]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due on" hint={dueDay > 28 ? "Shorter months use their last day." : undefined}>
          {(id) => (
            <select id={id} value={dueDay} onChange={(e) => pickDay(Number(e.target.value))} className={selectClass}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  The {ordinal(d)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={repeat === "monthly" ? "Starting from" : "Next due in"}>
          {(id) => (
            <select
              id={id}
              value={startMonth}
              onChange={(e) => {
                setStartMonth(e.target.value);
                setStartTouched(true);
              }}
              className={selectClass}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {fmtMonthLong(m)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <p className="-mt-3 rounded-xl bg-well px-4 py-3 text-[0.9375rem]">
        {repeatText({ repeat, dueDay, startMonth })}. First one due {fmtFull(dueDate({ dueDay }, startMonth))}.
      </p>

      <div>
        <div className="mb-2 font-medium">Goes into Expenses as</div>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.filter((c) => c !== "Staff").map((c) => (
            <Chip key={c} selected={category === c} onClick={() => setCategory(c)} className="min-h-10 px-3.5 text-sm">
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <Field label="Note" optional>
        {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" placeholder="e.g. Account no. 1234 5678, pay at the CEB office" />}
      </Field>

      {bill ? (
        <div className="flex items-start gap-4 rounded-xl border border-line bg-card p-4">
          <div className="min-w-0 flex-1">
            <div className="font-medium">Still paying this bill</div>
            <div className="text-sm text-muted">Turn off to stop the reminders. Past payments are kept.</div>
          </div>
          <Toggle checked={active} onChange={setActive} label="Still paying this bill" />
        </div>
      ) : null}

      <Button size="lg" block disabled={!valid} onClick={save}>
        {bill ? "Save changes" : "Add bill"}
      </Button>

      {bill ? (
        confirmRemove ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto">Delete {bill.name}?{paidCount ? " Its payments stay in Expenses." : ""}</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(false)}>
              Keep
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                removeBill(bill.id);
                notify(`${bill.name} deleted`);
                onClose();
              }}
            >
              Delete
            </Button>
          </div>
        ) : (
          <Button variant="ghost" block onClick={() => setConfirmRemove(true)} className="text-clay">
            Delete this bill
          </Button>
        )
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- pay */

/** Mark one due date of a bill paid (it goes into Expenses) or skip it. */
export function PayBillSheet({ due, onClose }: { due: BillDue | null; onClose: () => void }) {
  return (
    <Sheet open={!!due} onOpenChange={(o) => !o && onClose()} title={due ? `Pay ${due.bill.name}` : "Pay bill"} description={due ? `For ${fmtMonthLong(due.period)}` : undefined}>
      {due ? <PayBillForm due={due} onClose={onClose} /> : null}
    </Sheet>
  );
}

export const dueTone = (status: BillDue["status"]) => (status === "overdue" ? "clay" : status === "later" ? "stone" : "amber");

function PayBillForm({ due, onClose }: { due: BillDue; onClose: () => void }) {
  const { payBill, skipBill, today, notify, readOnly } = useStore();
  const [amount, setAmount] = useState(due.bill.amount);
  const [paidOn, setPaidOn] = useState(today);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-6">
      <div className={cn("rounded-xl px-4 py-3 font-medium", due.status === "overdue" ? "bg-clay-soft text-clay" : due.status === "later" ? "bg-well" : "bg-amber-soft text-amber-deep")}>
        {dueText(due)}
        <span className="font-normal">{due.days === 0 || due.days > 7 ? "" : `, ${fmtFull(due.due)}`}</span>
      </div>

      <Field label="Amount paid">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
      <Field label="Paid on">{(id) => <Input id={id} type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />}</Field>
      {due.bill.note ? <p className="rounded-xl bg-well px-4 py-3 text-[0.9375rem] whitespace-pre-wrap">{due.bill.note}</p> : null}
      <ReceiptPicker value={receipt} onChange={setReceipt} onBusy={setUploading} label="Attach the bill or receipt" />

      <Button
        size="lg"
        block
        disabled={readOnly || amount <= 0 || !paidOn || uploading}
        onClick={() => {
          payBill(due.bill.id, due.period, paidOn, amount, receipt);
          notify(`${due.bill.name} paid and added to expenses`);
          onClose();
        }}
      >
        Mark paid, {money(amount)}
      </Button>

      <div className="border-t border-line pt-4">
        <Button
          variant="ghost"
          block
          disabled={readOnly}
          onClick={() => {
            skipBill(due.bill.id, due.period);
            notify(`${due.bill.name} for ${fmtMonthLong(due.period)} skipped`);
            onClose();
          }}
        >
          Skip this one
        </Button>
        <p className="mt-1 text-center text-sm text-muted">Nothing to pay this time, or already in Expenses. It won&apos;t be added again.</p>
      </div>
    </div>
  );
}

/** One bill to pay: name, when it's due, and a Pay button. Used here and on Home. */
export function DueRow({ due, onPay }: { due: BillDue; onPay: () => void }) {
  const { readOnly } = useStore();
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {due.bill.name}
          <span className="font-normal text-muted">, {fmtMonthShort(`${due.period}-01`).split(" ")[0]}</span>
        </div>
        <Badge tone={dueTone(due.status)} className="mt-1">
          {dueText(due)}
        </Badge>
      </div>
      {due.bill.amount ? <div className="tnum shrink-0 font-medium whitespace-nowrap">{money(due.bill.amount)}</div> : null}
      <Button size="sm" disabled={readOnly} onClick={onPay} className="shrink-0">
        Pay
      </Button>
    </div>
  );
}
