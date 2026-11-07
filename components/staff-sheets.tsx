"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, Field, Input, MoneyInput, Stepper, Textarea, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { addMonths, daysInMonth, fmtMonthLong, monthKey } from "@/lib/dates";
import { payslipTotals } from "@/lib/payroll";
import { useStore } from "@/lib/store";
import type { PayLine, PayType, Staff } from "@/lib/types";
import { cn, money } from "@/lib/utils";

/* ---------------------------------------------------------------- staff */

const ROLES = ["Caretaker", "Cook", "Housekeeper", "Gardener", "Security", "Driver"];

/** Add someone, or change their details (staff = the person to edit). */
export function StaffSheet({ open, onClose, staff }: { open: boolean; onClose: () => void; staff?: Staff | null }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={staff ? "Edit staff member" : "Add staff member"}>
      {open ? <StaffForm staff={staff ?? null} onClose={onClose} /> : null}
    </Sheet>
  );
}

function StaffForm({ staff, onClose }: { staff: Staff | null; onClose: () => void }) {
  const { addStaff, updateStaff, removeStaff, payslips, notify } = useStore();
  const [name, setName] = useState(staff?.name ?? "");
  const [role, setRole] = useState(staff?.role ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [payType, setPayType] = useState<PayType>(staff?.payType ?? "monthly");
  const [rate, setRate] = useState(staff?.rate ?? 0);
  const [epf, setEpf] = useState(staff?.epf ?? false);
  const [epfNumber, setEpfNumber] = useState(staff?.epfNumber ?? "");
  const [active, setActive] = useState(staff?.active ?? true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const hasPayslips = !!staff && payslips.some((p) => p.staffId === staff.id);
  const valid = name.trim().length >= 2 && rate > 0;

  const save = () => {
    const input = { name: name.trim(), role: role.trim(), phone: phone.trim(), payType, rate, epf, epfNumber: epf ? epfNumber.trim() || undefined : undefined, active };
    if (staff) {
      updateStaff(staff.id, input);
      notify("Saved");
    } else if (addStaff(input)) notify(`${input.name} added`);
    onClose();
  };

  return (
    <div className="space-y-6">
      <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="e.g. Sunil Perera" />}</Field>

      <div>
        <Field label="Job" optional>{(id) => <Input id={id} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Caretaker" />}</Field>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Chip key={r} selected={role === r} onClick={() => setRole(r)} className="min-h-10 px-3.5 text-sm">
              {r}
            </Chip>
          ))}
        </div>
      </div>

      <Field label="Phone" optional hint="Used to send the payslip on WhatsApp.">
        {(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07X XXX XXXX" />}
      </Field>

      <div>
        <div className="mb-2 font-medium">How are they paid?</div>
        <div className="grid grid-cols-2 gap-2">
          <Chip selected={payType === "monthly"} onClick={() => setPayType("monthly")}>
            Monthly salary
          </Chip>
          <Chip selected={payType === "daily"} onClick={() => setPayType("daily")}>
            Daily wage
          </Chip>
        </div>
      </div>

      <Field label={payType === "monthly" ? "Salary for a month" : "Wage for one day"}>{(id) => <MoneyInput id={id} value={rate} onChange={setRate} />}</Field>

      <div className="rounded-xl border border-line bg-card p-4">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-medium">EPF and ETF</div>
            <div className="text-sm text-muted">Turn on if they are registered. On basic pay less deductions, 8% is taken from their pay; you add 12% EPF and 3% ETF.</div>
          </div>
          <Toggle checked={epf} onChange={setEpf} label="EPF and ETF" />
        </div>
        {epf ? (
          <Field label="EPF number" optional className="mt-4">
            {(id) => <Input id={id} value={epfNumber} onChange={(e) => setEpfNumber(e.target.value)} />}
          </Field>
        ) : null}
      </div>

      {staff ? (
        <div className="flex items-start gap-4 rounded-xl border border-line bg-card p-4">
          <div className="min-w-0 flex-1">
            <div className="font-medium">Still works here</div>
            <div className="text-sm text-muted">Turn off when someone leaves. Their payslips are kept.</div>
          </div>
          <Toggle checked={active} onChange={setActive} label="Still works here" />
        </div>
      ) : null}

      <Button size="lg" block disabled={!valid} onClick={save}>
        {staff ? "Save changes" : "Add staff member"}
      </Button>

      {staff && !hasPayslips ? (
        confirmRemove ? (
          <div className="flex items-center gap-2">
            <span className="mr-auto">Remove {staff.name}?</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(false)}>
              Keep
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                removeStaff(staff.id);
                notify(`${staff.name} removed`);
                onClose();
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <Button variant="ghost" block onClick={() => setConfirmRemove(true)} className="text-clay">
            Remove this person
          </Button>
        )
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- payslip */

const ADD_SUGGESTIONS = ["Overtime", "Bonus", "Allowance", "Service charge"];
const DEDUCT_SUGGESTIONS = ["Salary advance", "Loan repayment", "Unpaid leave"];

/** Make a payslip for one person and one month. */
export function PayslipSheet({ open, onClose, staffId, month }: { open: boolean; onClose: () => void; staffId: string | null; month: string }) {
  const { staff } = useStore();
  const person = staff.find((s) => s.id === staffId) ?? null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Make a payslip" description={person ? `${person.name}${person.role ? `, ${person.role}` : ""}` : undefined}>
      {open && person ? <PayslipForm person={person} initialMonth={month} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Lines({ title, hint, lines, setLines, suggestions }: { title: string; hint: string; lines: PayLine[]; setLines: (l: PayLine[]) => void; suggestions: string[] }) {
  const update = (i: number, patch: Partial<PayLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const unused = suggestions.filter((s) => !lines.some((l) => l.name === s));
  return (
    <div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted">{hint}</div>
      {lines.length ? (
        <div className="mt-3 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={`${title}: name`} value={l.name} onChange={(e) => update(i, { name: e.target.value })} className="min-w-0 flex-[1_1_8rem]" />
              <MoneyInput aria-label={`${title}: amount`} value={l.amount} onChange={(v) => update(i, { amount: v })} className="min-w-0 flex-[1_1_7rem]" />
              <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-well hover:text-clay" aria-label={`Remove ${l.name || "line"}`}>
                <X className="size-5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {unused.map((s) => (
          <Chip key={s} onClick={() => setLines([...lines, { name: s, amount: 0 }])} className="min-h-10 px-3.5 text-sm">
            <Plus className="-ml-0.5 mr-1 inline size-4" aria-hidden />
            {s}
          </Chip>
        ))}
        <Chip onClick={() => setLines([...lines, { name: "", amount: 0 }])} className="min-h-10 px-3.5 text-sm">
          <Plus className="-ml-0.5 mr-1 inline size-4" aria-hidden />
          Other
        </Chip>
      </div>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "text-lg font-semibold", muted && "text-[0.9375rem] text-muted")}>
      <span>{label}</span>
      <span className="tnum whitespace-nowrap">{value}</span>
    </div>
  );
}

function PayslipForm({ person, initialMonth, onClose }: { person: Staff; initialMonth: string; onClose: () => void }) {
  const router = useRouter();
  const { today, payslips, addPayslip, notify } = useStore();
  const [month, setMonth] = useState(initialMonth);
  const [days, setDays] = useState(Math.min(26, daysInMonth(initialMonth)));
  const [rate, setRate] = useState(person.rate);
  const [additions, setAdditions] = useState<PayLine[]>([]);
  const [deductions, setDeductions] = useState<PayLine[]>([]);
  const [note, setNote] = useState("");
  const [paidNow, setPaidNow] = useState(true);
  const [paidOn, setPaidOn] = useState(today);

  const thisMonth = monthKey(today);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, -i));
  const clean = (l: PayLine[]) => l.filter((x) => x.name.trim() && x.amount > 0).map((x) => ({ name: x.name.trim(), amount: x.amount }));
  const input = { staffId: person.id, payType: person.payType, rate, month, days: person.payType === "daily" ? days : undefined, additions: clean(additions), deductions: clean(deductions), epf: person.epf, note: note.trim() || undefined };
  const t = payslipTotals(input);
  const already = payslips.find((p) => p.staffId === person.id && p.month === month);
  const valid = rate > 0 && (person.payType === "monthly" || days > 0) && t.gross > 0;

  const save = () => {
    const slip = addPayslip(input, paidNow ? paidOn : undefined);
    if (!slip) return;
    notify(paidNow ? "Payslip made and added to expenses" : "Payslip made");
    onClose();
    router.push(`/payslip?p=${slip.id}`);
  };

  return (
    <div className="space-y-6">
      <Field label="Month">
        {(id) => (
          <select id={id} value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-12 w-full rounded-xl border border-line-strong bg-card px-4 text-base focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none">
            {months.map((m) => (
              <option key={m} value={m}>
                {fmtMonthLong(m)}
              </option>
            ))}
          </select>
        )}
      </Field>
      {already ? <p className="-mt-3 rounded-xl bg-amber-soft px-4 py-3 text-[0.9375rem] text-amber-deep">{person.name} already has a payslip for {fmtMonthLong(month)}. You can still make another, for example for extra days.</p> : null}

      {person.payType === "daily" ? (
        <div className="rounded-xl border border-line bg-card px-4">
          <Stepper label="Days worked" hint={`In ${fmtMonthLong(month)}`} value={days} min={1} max={daysInMonth(month)} onChange={setDays} />
          <div className="border-t border-line py-3">
            <Field label="Wage for one day">{(id) => <MoneyInput id={id} value={rate} onChange={setRate} />}</Field>
          </div>
        </div>
      ) : (
        <Field label="Salary for the month">{(id) => <MoneyInput id={id} value={rate} onChange={setRate} />}</Field>
      )}

      <Lines title="Additions" hint="Paid on top: overtime, a bonus, an allowance." lines={additions} setLines={setAdditions} suggestions={ADD_SUGGESTIONS} />
      <Lines title="Deductions" hint="Taken off: an advance already given, a loan repayment." lines={deductions} setLines={setDeductions} suggestions={DEDUCT_SUGGESTIONS} />

      <div className="space-y-2 rounded-xl border border-line bg-card p-4">
        <Row label={person.payType === "daily" ? `Basic pay (${days} × ${money(rate)})` : "Basic pay"} value={money(t.basic)} />
        {t.additions ? <Row label="Additions" value={`+ ${money(t.additions)}`} /> : null}
        {person.epf ? <Row label={`EPF 8% of ${money(t.epfBase)}`} value={`− ${money(t.epfEmployee)}`} /> : null}
        {t.otherDeductions ? <Row label="Deductions" value={`− ${money(t.otherDeductions)}`} /> : null}
        <div className="border-t border-line pt-2">
          <Row label="Net pay" value={money(t.net)} strong />
        </div>
        {person.epf ? <Row label="You also pay EPF 12% and ETF 3%" value={money(t.epfEmployer + t.etf)} muted /> : null}
      </div>

      <Field label="Note" optional>{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" placeholder="e.g. Paid in cash" />}</Field>

      <div className="rounded-xl border border-line bg-card p-4">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-medium">Paid now</div>
            <div className="text-sm text-muted">Adds {money(t.cost)} to Expenses under Staff.</div>
          </div>
          <Toggle checked={paidNow} onChange={setPaidNow} label="Paid now" />
        </div>
        {paidNow ? (
          <Field label="Paid on" className="mt-4">
            {(id) => <Input id={id} type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />}
          </Field>
        ) : null}
      </div>

      <Button size="lg" block disabled={!valid} onClick={save}>
        Make payslip
      </Button>
    </div>
  );
}
