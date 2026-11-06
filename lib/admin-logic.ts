import type { AdminUser, AdminVilla } from "./admin-types";
import { addDays, fromISO, nightsBetween, toISO } from "./dates";

/** The same day a number of months away (31 Jan + 1 month is 28/29 Feb). */
export function shiftMonths(iso: string, months: number) {
  const d = fromISO(iso);
  const last = new Date(d.getFullYear(), d.getMonth() + months + 1, 0).getDate();
  return toISO(new Date(d.getFullYear(), d.getMonth() + months, Math.min(d.getDate(), last)));
}

/**
 * The monthly period that contains today. Periods run from one due date to the
 * day before the next, so a villa due on the 4th has periods 4th to 3rd.
 */
export function currentPeriod(nextPaymentDate: string, today: string) {
  let start = nextPaymentDate;
  let guard = 0;
  while (start > today && guard++ < 240) start = shiftMonths(start, -1);
  while (shiftMonths(start, 1) <= today && guard++ < 480) start = shiftMonths(start, 1);
  return { start, end: addDays(shiftMonths(start, 1), -1) };
}

export interface VillaAlert {
  villaId: string;
  villaName: string;
  kind: "disabled" | "overdue" | "payment_due" | "date_passed" | "due_soon" | "never_signed_in";
  text: string;
}

const DUE_SOON_DAYS = 7;

/** A subscription that needs the Super Admin's attention: marked late, or due within a week. */
export function paymentNeedsAttention(v: AdminVilla, today: string) {
  return v.subscriptionStatus !== "active" || nightsBetween(today, v.nextPaymentDate) <= DUE_SOON_DAYS;
}

/** Nothing here changes any status. Alerts only point at villas to look at. */
export function villaAlerts(villas: AdminVilla[], admins: AdminUser[], today: string): VillaAlert[] {
  const alerts: VillaAlert[] = [];
  for (const v of villas) {
    const days = nightsBetween(today, v.nextPaymentDate);
    const add = (kind: VillaAlert["kind"], text: string) => alerts.push({ villaId: v.id, villaName: v.name, kind, text });

    if (v.accountStatus === "disabled") add("disabled", "Access is disabled");
    if (v.subscriptionStatus === "overdue") add("overdue", `Subscription overdue, payment was due ${days < 0 ? `${-days} days ago` : "now"}`);
    else if (v.subscriptionStatus === "payment_due") add("payment_due", days < 0 ? `Payment due, ${-days} days late` : "Payment due");
    else if (days < 0) add("date_passed", `Payment date passed ${-days} ${-days === 1 ? "day" : "days"} ago and is not marked yet`);
    else if (days <= DUE_SOON_DAYS) add("due_soon", days === 0 ? "Payment is due today" : `Payment due in ${days} ${days === 1 ? "day" : "days"}`);

    const own = admins.filter((a) => a.villaId === v.id);
    if (own.length > 0 && own.every((a) => !a.lastLoginAt)) add("never_signed_in", "Admin has never signed in");
  }
  const order: VillaAlert["kind"][] = ["overdue", "payment_due", "date_passed", "due_soon", "disabled", "never_signed_in"];
  return alerts.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
