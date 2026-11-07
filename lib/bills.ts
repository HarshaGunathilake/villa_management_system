import { addDays, daysInMonth, fmtFull, fmtMonthLong, nightsBetween } from "./dates";
import type { Bill, BillPayment, BillRepeat } from "./types";

/*
 * Bills that come round again. A bill is due on its day every 1, 3 or 12
 * months from its first month. Each due date is a "period" (its YYYY-MM);
 * once it is paid or skipped there is a BillPayment for it. Anything due and
 * not dealt with stays on the list, however old, so nothing slips by.
 */

export const BILL_STEP: Record<BillRepeat, number> = { monthly: 1, quarterly: 3, yearly: 12 };
export const REPEAT_LABEL: Record<BillRepeat, string> = { monthly: "Every month", quarterly: "Every 3 months", yearly: "Every year" };

/** How many days ahead a bill shows up as "to pay". */
export const BILL_AHEAD_DAYS = 7;
/** How many days ahead a bill is flagged in the menu and the Home header. */
export const BILL_SOON_DAYS = 3;

const pad = (n: number) => String(n).padStart(2, "0");

const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
};

/** The due date for one period. Months without the bill's day use their last day. */
export function dueDate(bill: Pick<Bill, "dueDay">, period: string) {
  return `${period}-${pad(Math.min(bill.dueDay, daysInMonth(period)))}`;
}

/** Whether the bill is due in this month at all. */
export function isBillPeriod(bill: Pick<Bill, "startMonth" | "repeat">, period: string) {
  const n = monthsBetween(bill.startMonth, period);
  return n >= 0 && n % BILL_STEP[bill.repeat] === 0;
}

/** "Due on the 10th of every month", "Due every 3 months, on the 10th", "Due every year, on 10 March" */
export function repeatText(bill: Pick<Bill, "repeat" | "dueDay" | "startMonth">) {
  if (bill.repeat === "monthly") return `Due on the ${ordinal(bill.dueDay)} of every month`;
  if (bill.repeat === "quarterly") return `Due every 3 months, on the ${ordinal(bill.dueDay)}`;
  return `Due every year, on ${bill.dueDay} ${fmtMonthLong(bill.startMonth).split(" ")[0]}`;
}

export type DueStatus = "overdue" | "today" | "soon" | "later";

export interface BillDue {
  bill: Bill;
  period: string;
  due: string;
  /** Days from today to the due date; negative when overdue */
  days: number;
  status: DueStatus;
}

const statusOf = (days: number): DueStatus => (days < 0 ? "overdue" : days === 0 ? "today" : days <= BILL_AHEAD_DAYS ? "soon" : "later");

const dealtWith = (payments: BillPayment[], billId: string) => new Set(payments.filter((p) => p.billId === billId).map((p) => p.period));

/** Every period of a bill from its first, oldest first (at most 600 of them). */
function* periods(bill: Bill) {
  for (let i = 0; i < 600; i++) {
    const n = i * BILL_STEP[bill.repeat];
    const [y, m] = bill.startMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    yield `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
}

/** The bill's due dates not yet paid or skipped, up to and including `until`, oldest first. */
export function unpaidDues(bill: Bill, payments: BillPayment[], today: string, until: string): BillDue[] {
  const done = dealtWith(payments, bill.id);
  const out: BillDue[] = [];
  for (const period of periods(bill)) {
    const due = dueDate(bill, period);
    if (due > until) break;
    if (done.has(period)) continue;
    const days = nightsBetween(today, due);
    out.push({ bill, period, due, days, status: statusOf(days) });
  }
  return out;
}

/** The first due date not yet dealt with, however far ahead. */
export function nextDue(bill: Bill, payments: BillPayment[], today: string): BillDue | null {
  const done = dealtWith(payments, bill.id);
  for (const period of periods(bill)) {
    if (done.has(period)) continue;
    const due = dueDate(bill, period);
    const days = nightsBetween(today, due);
    return { bill, period, due, days, status: statusOf(days) };
  }
  return null;
}

/** What needs paying: overdue, due today and due in the next week, across all bills still in use. */
export function billsToPay(bills: Bill[], payments: BillPayment[], today: string, aheadDays = BILL_AHEAD_DAYS): BillDue[] {
  const until = addDays(today, aheadDays);
  return bills
    .filter((b) => b.active)
    .flatMap((b) => unpaidDues(b, payments, today, until))
    .sort((a, b) => a.due.localeCompare(b.due) || a.bill.name.localeCompare(b.bill.name));
}

/** Overdue bills and those due in the next 3 days: what the menu and Home header point out. */
export function billsDueSoon(bills: Bill[], payments: BillPayment[], today: string) {
  return billsToPay(bills, payments, today, BILL_SOON_DAYS);
}

/** One line about the bills due soon, for the Home header. Empty when there are none. */
export function dueSoonText(dues: BillDue[]) {
  if (dues.length === 0) return "";
  if (dues.length === 1) {
    const d = dues[0];
    const when = dueText(d);
    return `${d.bill.name}: ${when.charAt(0).toLowerCase()}${when.slice(1)}`;
  }
  const overdue = dues.filter((d) => d.status === "overdue").length;
  if (overdue === dues.length) return `${dues.length} bills overdue`;
  return `${dues.length} bills due${overdue ? `, ${overdue} overdue` : " in the next 3 days"}`;
}

/** "Overdue by 3 days", "Due today", "Due tomorrow", "Due in 5 days", "Due 12 Dec 2026" */
export function dueText(d: Pick<BillDue, "days" | "due">) {
  if (d.days < 0) return `Overdue by ${-d.days} ${d.days === -1 ? "day" : "days"}`;
  if (d.days === 0) return "Due today";
  if (d.days === 1) return "Due tomorrow";
  if (d.days <= BILL_AHEAD_DAYS) return `Due in ${d.days} days`;
  return `Due ${fmtFull(d.due)}`;
}

/** The first month a new bill is due: this month if its day hasn't passed yet, otherwise next month. */
export function firstDueMonth(dueDay: number, today: string) {
  const month = today.slice(0, 7);
  if (dueDate({ dueDay }, month) >= today) return month;
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** The expense a paid bill becomes. */
export function billExpense(bill: Pick<Bill, "name" | "category" | "dueDay">, period: string) {
  return { name: `${bill.name}, ${fmtMonthLong(period)}`, category: bill.category, note: `Bill due ${fmtFull(dueDate(bill, period))}` };
}
