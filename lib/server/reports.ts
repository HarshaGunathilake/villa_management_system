import type { ReportMonth, Reports } from "../admin-types";
import { addMonths, monthKey } from "../dates";
import { isoToLocalDate, serverToday, sqlToIso } from "./config";
import { db } from "./db";

/*
 * Month-by-month figures for Super Admin → Reports: card income, sign-ups and
 * how many of them went on to pay, first payments, and cancellations.
 * Dates are counted in the app's time zone.
 */

export async function loadReports(monthsBack = 12): Promise<Reports> {
  const today = serverToday();
  const thisMonth = monthKey(today);
  const keys = Array.from({ length: monthsBack }, (_, i) => addMonths(thisMonth, i - (monthsBack - 1)));
  const months = new Map<string, ReportMonth>(
    keys.map((k) => [k, { month: k, income: 0, payments: 0, signups: 0, signupsPaid: 0, added: 0, firstPayments: 0, cancellations: 0 }]),
  );

  const [payments, events, villas] = await Promise.all([
    db.query<{ villa_id: string; amount: number; payment_date: string }>("SELECT villa_id, amount, payment_date FROM subscription_payments ORDER BY payment_date, created_at"),
    db.query<{ villa_id: string | null; action: string; created_at: string }>(
      "SELECT villa_id, action, created_at FROM activity_log WHERE action IN ('villa_signed_up','villa_created','dodo_access_off') ORDER BY created_at",
    ),
    db.query<{ id: string; account_status: string; disabled_reason: string | null; dodo_status: string | null; monthly_subscription_amount: number }>(
      "SELECT id, account_status, disabled_reason, dodo_status, monthly_subscription_amount FROM villas",
    ),
  ]);

  const firstPaid = new Map<string, string>();
  for (const p of payments) {
    if (!firstPaid.has(p.villa_id)) firstPaid.set(p.villa_id, p.payment_date);
    const m = months.get(monthKey(p.payment_date));
    if (m) {
      m.income += p.amount;
      m.payments += 1;
    }
  }
  for (const date of firstPaid.values()) {
    const m = months.get(monthKey(date));
    if (m) m.firstPayments += 1;
  }

  const signedUp = new Set<string>();
  for (const e of events) {
    const m = months.get(monthKey(isoToLocalDate(sqlToIso(e.created_at)!)));
    if (e.action === "villa_signed_up" && e.villa_id) signedUp.add(e.villa_id);
    if (!m) continue;
    if (e.action === "villa_signed_up") {
      m.signups += 1;
      if (e.villa_id && firstPaid.has(e.villa_id)) m.signupsPaid += 1;
    } else if (e.action === "villa_created") {
      m.added += 1;
    } else if (e.action === "dodo_access_off") {
      m.cancellations += 1;
    }
  }

  const paying = villas.filter((v) => v.dodo_status === "active" && v.account_status === "active");
  const allSignups = [...signedUp];
  return {
    today,
    months: keys.map((k) => months.get(k)!),
    now: {
      payingVillas: paying.length,
      monthlyIncome: paying.reduce((s, v) => s + v.monthly_subscription_amount, 0),
      totalVillas: villas.length,
      awaiting: villas.filter((v) => v.account_status === "disabled" && v.disabled_reason === "unpaid").length,
      ended: villas.filter((v) => v.account_status === "disabled" && v.disabled_reason === "subscription").length,
      lifetimeIncome: payments.reduce((s, p) => s + p.amount, 0),
      signups: allSignups.length,
      signupsPaid: allSignups.filter((id) => firstPaid.has(id)).length,
    },
  };
}
