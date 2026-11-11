import { queueOwnerEmails, sendOwnerEmail, type OwnerEmail } from "./emails";
import type { SubscriptionStatus } from "../admin-types";
import { addDays, fromISO, nightsBetween, toISO } from "../dates";
import type { VillaBilling } from "../types";
import { config, DEFAULT_TRIAL_DAYS, dodoEnabled, isoToLocalDate, nowSql, serverToday } from "./config";
import { db, transaction, type Db } from "./db";
import { dodo, productFor, type DodoPayment, type DodoSubscription } from "./dodo";
import { ApiError, badRequest } from "./http";

/*
 * Villa subscriptions paid by card through Dodo Payments.
 *
 *  - The villa admin starts paying from their Subscription page (startCheckout).
 *  - Dodo then tells us what happens through signed webhooks (handleDodoEvent):
 *    payments, renewals, failed charges, cancellation.
 *
 * Rules:
 *  - active            payment status Active
 *  - past_due, paused  Payment due (Dodo is retrying, access stays on)
 *  - on_hold           Overdue (a renewal failed, access stays on)
 *  - cancelled, expired  access goes off automatically. The admin can still sign
 *                      in, but only to pay again. When the new subscription is
 *                      active, access comes back by itself.
 *  - A villa the Super Admin switched off by hand stays off whatever Dodo says.
 *
 * Free trial: a villa that signed up itself gets the trial it was offered at
 * sign-up (Settings → Subscription), once. Its checkout saves the card with no
 * charge (Dodo's $0 mandate), the subscription goes active straight away and
 * opens the villa, and Dodo makes the first real charge when the trial ends.
 */

/** Dodo states in which the villa still has a live subscription (so no second checkout). */
const LIVE = new Set(["active", "on_hold", "past_due", "paused"]);

const STATUS_FOR: Partial<Record<DodoSubscription["status"], SubscriptionStatus>> = {
  active: "active",
  past_due: "payment_due",
  paused: "payment_due",
  on_hold: "overdue",
  cancelled: "payment_due",
  expired: "payment_due",
};

interface VillaBillingRow {
  id: string;
  name: string;
  monthly_subscription_amount: number;
  account_status: "active" | "disabled";
  disabled_reason: string | null;
  dodo_customer_id: string | null;
  dodo_subscription_id: string | null;
  dodo_status: string | null;
  trial_days: number | null;
  trial_ends_on: string | null;
  free_until: string | null;
  cancel_at_period_end: number;
}

const BILLING_COLUMNS =
  "id, name, monthly_subscription_amount, account_status, disabled_reason, dodo_customer_id, dodo_subscription_id, dodo_status, trial_days, trial_ends_on, free_until, cancel_at_period_end";

/**
 * The free days this villa's first checkout gets: only a self sign-up that has
 * never had a card subscription or a trial. It keeps the trial it was offered
 * when it signed up; villas from before trials existed get today's setting.
 */
export async function trialOffer(villa: Pick<VillaBillingRow, "disabled_reason" | "dodo_subscription_id" | "trial_days" | "trial_ends_on">): Promise<number> {
  if (villa.disabled_reason !== "unpaid" || villa.dodo_subscription_id || villa.trial_ends_on) return 0;
  let days = villa.trial_days;
  if (days === null) {
    const row = await db.one<{ value: string }>("SELECT value FROM platform_settings WHERE name = 'trialDays'");
    days = Number(row?.value ?? DEFAULT_TRIAL_DAYS) || 0;
  }
  return Math.max(0, Math.min(365, Math.round(days)));
}

export function billingState(row: Pick<VillaBillingRow, "dodo_status" | "dodo_customer_id">): VillaBilling {
  const s = row.dodo_status;
  const state: VillaBilling["state"] = s === "active" ? "active" : s === "on_hold" || s === "past_due" || s === "paused" ? "attention" : s === "pending" ? "pending" : "none";
  return { enabled: dodoEnabled(), state, dodoStatus: s, canManage: !!row.dodo_customer_id && dodoEnabled() };
}

export async function loadBilling(villaId: string): Promise<VillaBilling> {
  const row = await db.one<VillaBillingRow>(`SELECT ${BILLING_COLUMNS} FROM villas WHERE id = ?`, [villaId]);
  return billingState(row ?? { dodo_status: null, dodo_customer_id: null });
}

async function platformName() {
  const row = await db.one<{ value: string }>("SELECT value FROM platform_settings WHERE name = 'platformName'");
  return row?.value ?? "";
}

/** Where Dodo sends the admin back to: this site's Subscription page. */
function returnUrl(request: Request, path: string) {
  const origin = config.appUrl || new URL(request.url).origin;
  return `${origin}${path}`;
}

/* ------------------------------------------------------------ villa admin */

/**
 * A Dodo checkout for the signed-in admin's own villa, at the villa's monthly
 * amount. Nothing in the request chooses the villa, the amount or the product.
 * If the villa already has a live subscription, the billing portal opens instead.
 */
export async function startCheckout(request: Request, villaId: string, admin: { email: string; name: string }): Promise<{ url: string; kind: "checkout" | "portal" }> {
  const villa = await db.one<VillaBillingRow>(`SELECT ${BILLING_COLUMNS} FROM villas WHERE id = ?`, [villaId]);
  if (!villa) throw new ApiError(404, "not_found", "Villa not found.");
  // Off because of payment (ended, or never started): paying is exactly what is allowed. Off by hand: not.
  if (villa.account_status === "disabled" && villa.disabled_reason !== "subscription" && villa.disabled_reason !== "unpaid") {
    throw new ApiError(403, "access_disabled", "Your villa account is currently inactive.");
  }

  if (villa.dodo_subscription_id && villa.dodo_status && LIVE.has(villa.dodo_status) && villa.dodo_customer_id) {
    return { url: (await dodo.portalLink(villa.dodo_customer_id, returnUrl(request, "/subscription"))).link, kind: "portal" };
  }

  const amount = villa.monthly_subscription_amount;
  if (amount < 1) throw badRequest("This villa has no monthly amount set yet. Please contact the platform administrator.");

  const productId = await productFor(amount, await platformName());
  // Free access from the Super Admin: the card is saved now and first charged the day after it ends.
  const today = serverToday();
  const freeDays = villa.free_until && villa.free_until >= today ? nightsBetween(today, villa.free_until) + 1 : 0;
  const trialDays = freeDays > 0 ? freeDays : await trialOffer(villa);
  const session = await dodo.createCheckout({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: villa.dodo_customer_id ? { customer_id: villa.dodo_customer_id } : { email: admin.email, name: villa.name },
    billing_address: { country: config.dodo.country },
    billing_currency: config.dodo.currency,
    return_url: returnUrl(request, "/subscription?payment=done"),
    // Free trial: the card is saved now and first charged when the trial ends.
    ...(trialDays > 0 ? { subscription_data: { trial_period_days: trialDays } } : {}),
    // Comes back on the subscription and its payments, so the webhook knows which villa paid (and that it was a trial).
    metadata: trialDays > 0 ? { villa_id: villa.id, trial_days: String(trialDays) } : { villa_id: villa.id },
  });
  if (!session.checkout_url) throw new ApiError(502, "payments_error", "The payment page could not be opened. Please try again.");

  await db.run("UPDATE villas SET dodo_status = CASE WHEN dodo_status IS NULL OR dodo_status IN ('cancelled','expired','failed') THEN 'pending' ELSE dodo_status END, updated_at = ? WHERE id = ?", [nowSql(), villa.id]);
  return { url: session.checkout_url, kind: "checkout" };
}

/** Dodo's billing portal for the villa: change card, see invoices, cancel. */
export async function openPortal(request: Request, villaId: string): Promise<{ url: string }> {
  const villa = await db.one<VillaBillingRow>(`SELECT ${BILLING_COLUMNS} FROM villas WHERE id = ?`, [villaId]);
  if (!villa?.dodo_customer_id) throw badRequest("There is no card subscription to manage yet.");
  return { url: (await dodo.portalLink(villa.dodo_customer_id, returnUrl(request, "/subscription"))).link };
}

/* ------------------------------------------------------------ super admin */

/** When the Super Admin changes a villa's monthly amount, a live card subscription moves to the new price from its next billing date. */
export async function repriceSubscription(villaId: string, newAmount: number) {
  const villa = await db.one<VillaBillingRow>(`SELECT ${BILLING_COLUMNS} FROM villas WHERE id = ?`, [villaId]);
  if (!villa?.dodo_subscription_id || !villa.dodo_status || !LIVE.has(villa.dodo_status)) return false;
  const productId = await productFor(newAmount, await platformName());
  await dodo.changePlan(villa.dodo_subscription_id, productId);
  return true;
}

/**
 * When the Super Admin switches a villa off, its card subscription is cancelled
 * straight away so the owner is not charged for a villa they can't use.
 */
export async function cancelForDisable(villaId: string) {
  const villa = await db.one<VillaBillingRow>(`SELECT ${BILLING_COLUMNS} FROM villas WHERE id = ?`, [villaId]);
  if (!villa?.dodo_subscription_id || !villa.dodo_status || !LIVE.has(villa.dodo_status)) return false;
  await dodo.cancel(villa.dodo_subscription_id);
  await db.run("UPDATE villas SET dodo_status = 'cancelled', updated_at = ? WHERE id = ?", [nowSql(), villaId]);
  return true;
}

/** A live card subscription sets the next payment date itself. */
export async function isPaidByCard(villaId: string) {
  const villa = await db.one<{ dodo_status: string | null }>("SELECT dodo_status FROM villas WHERE id = ?", [villaId]);
  return !!villa?.dodo_status && LIVE.has(villa.dodo_status);
}

/* ---------------------------------------------------------------- webhooks */

interface DodoEvent {
  business_id?: string;
  type: string;
  timestamp?: string;
  data: Record<string, unknown> & { payload_type?: string };
}

async function logDodo(q: Db, villaId: string, action: string, detail: string) {
  await q.run("INSERT INTO activity_log (villa_id, action, detail, created_by, created_at) VALUES (?,?,?,?,?)", [villaId, action, detail.slice(0, 255), null, nowSql()]);
}

/** Which villa an event is about: the one holding this subscription, or the villa named in the checkout's metadata. */
async function villaFor(q: Db, subscriptionId: string | null, metadata: unknown): Promise<VillaBillingRow | undefined> {
  if (subscriptionId) {
    const bySub = await q.one<VillaBillingRow>(`SELECT ${BILLING_COLUMNS} FROM villas WHERE dodo_subscription_id = ? FOR UPDATE`, [subscriptionId]);
    if (bySub) return bySub;
  }
  const villaId = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).villa_id : undefined;
  if (typeof villaId !== "string" || !villaId) return undefined;
  return q.one<VillaBillingRow>(`SELECT ${BILLING_COLUMNS} FROM villas WHERE id = ? FOR UPDATE`, [villaId]);
}

const money = (amount: number) => `LKR ${amount.toLocaleString("en-US")}`;

/** Bring the villa in line with the subscription as Dodo has it now. */
async function applySubscription(q: Db, sub: DodoSubscription, eventType: string, outbox: OwnerEmail[]) {
  const villa = await villaFor(q, sub.subscription_id, sub.metadata);
  if (!villa) {
    console.warn("[dodo] subscription for an unknown villa", sub.subscription_id);
    return;
  }

  // Events about an older subscription (say, one that ended before the villa
  // subscribed again) must not touch the current one. A newly active one takes over.
  const isCurrent = !villa.dodo_subscription_id || villa.dodo_subscription_id === sub.subscription_id;
  if (!isCurrent && sub.status !== "active") return;

  const now = nowSql();
  const status = STATUS_FOR[sub.status];
  const nextDue = sub.next_billing_date ? isoToLocalDate(sub.next_billing_date) : null;

  await q.run(
    `UPDATE villas SET dodo_subscription_id = ?, dodo_customer_id = ?, dodo_status = ?,
       subscription_status = COALESCE(?, subscription_status), next_payment_date = COALESCE(?, next_payment_date),
       cancel_at_period_end = ?, updated_at = ?
     WHERE id = ?`,
    [sub.subscription_id, sub.customer?.customer_id ?? villa.dodo_customer_id, sub.status, status ?? null, sub.status === "active" ? nextDue : null, sub.cancel_at_next_billing_date ? 1 : 0, now, villa.id],
  );
  // On free access from the Super Admin and now added a card: the card takes over, first charged when the free days end.
  if (sub.status === "active" && villa.free_until && villa.account_status === "active") {
    const freeEnds = Number(sub.metadata?.trial_days) > 0 && nextDue && nextDue > serverToday() ? nextDue : null;
    await q.run("UPDATE villas SET free_until = NULL, trial_ends_on = COALESCE(?, trial_ends_on) WHERE id = ?", [freeEnds, villa.id]);
    await logDodo(q, villa.id, "dodo_active", `${villa.name} added a card during free access${freeEnds ? `, first charge on ${freeEnds}` : ""}`);
  }

  // Access follows the subscription, unless the Super Admin switched the villa off by hand.
  if ((sub.status === "cancelled" || sub.status === "expired") && villa.account_status === "active") {
    await q.run("UPDATE villas SET account_status = 'disabled', disabled_reason = 'subscription', updated_at = ? WHERE id = ?", [now, villa.id]);
    await logDodo(q, villa.id, "dodo_access_off", `${villa.name} card subscription ${sub.status}, access switched off`);
    outbox.push({ kind: "subscription_ended", villaId: villa.id });
    return;
  }
  if (sub.status === "active" && villa.account_status === "disabled" && villa.disabled_reason === "unpaid") {
    // A villa that signed up itself: the first payment, or the card saved for a free trial, opens the app. The subscription starts today.
    const trialDays = Number(sub.metadata?.trial_days) || 0;
    const trialEnds = trialDays > 0 && nextDue && nextDue > isoToLocalDate(new Date().toISOString()) ? nextDue : null;
    await q.run("UPDATE villas SET account_status = 'active', disabled_reason = NULL, subscription_start_date = ?, trial_ends_on = ?, updated_at = ? WHERE id = ?", [
      isoToLocalDate(new Date().toISOString()),
      trialEnds,
      now,
      villa.id,
    ]);
    if (trialEnds) {
      await logDodo(q, villa.id, "dodo_trial_started", `${villa.name} added a card and started a ${trialDays}-day free trial, first charge on ${trialEnds}`);
      outbox.push({ kind: "trial_started", villaId: villa.id, days: trialDays, firstCharge: trialEnds, amount: villa.monthly_subscription_amount });
    } else {
      await logDodo(q, villa.id, "dodo_access_on", `${villa.name} made its first payment, access switched on`);
    }
    return;
  }
  if (sub.status === "active" && villa.account_status === "disabled" && villa.disabled_reason === "subscription") {
    await q.run("UPDATE villas SET account_status = 'active', disabled_reason = NULL, updated_at = ? WHERE id = ?", [now, villa.id]);
    await logDodo(q, villa.id, "dodo_access_on", `${villa.name} paid by card again, access switched back on`);
    return;
  }

  const changed = villa.dodo_status !== sub.status || villa.dodo_subscription_id !== sub.subscription_id;
  if (!changed) return;
  const detail: Record<string, string> = {
    active: `${villa.name} started paying by card`,
    on_hold: `${villa.name} card renewal failed, subscription on hold`,
    past_due: `${villa.name} card renewal failed, Dodo is retrying`,
    paused: `${villa.name} card subscription paused`,
    failed: `${villa.name} card subscription could not be set up`,
  };
  if (detail[sub.status]) await logDodo(q, villa.id, `dodo_${sub.status}`, detail[sub.status]);
  if ((sub.status === "on_hold" || sub.status === "past_due") && villa.dodo_status !== "on_hold" && villa.dodo_status !== "past_due") {
    outbox.push({ kind: "payment_failed", villaId: villa.id });
  }
  else console.info("[dodo]", eventType, sub.subscription_id, sub.status);
}

/** A successful card payment becomes a payment record, once. */
async function applyPayment(q: Db, payment: DodoPayment, outbox: OwnerEmail[]) {
  if (!payment.subscription_id || payment.status !== "succeeded") return;
  // The $0 authorisation Dodo makes to save the card at the start of a free trial is not a payment.
  if (!(payment.total_amount > 0)) return;
  const villa = await villaFor(q, payment.subscription_id, payment.metadata);
  if (!villa) {
    console.warn("[dodo] payment for an unknown villa", payment.payment_id);
    return;
  }
  const exists = await q.one("SELECT 1 FROM subscription_payments WHERE dodo_payment_id = ?", [payment.payment_id]);
  if (exists) return;

  const paidOn = isoToLocalDate(payment.created_at);
  const period = payment.service_periods?.find((p) => p.subscription_id === payment.subscription_id);
  const periodStart = period ? isoToLocalDate(period.starts_at) : paidOn;
  const periodEnd = period ? addDays(isoToLocalDate(period.ends_at), -1) : addDays(nextMonth(paidOn), -1);
  const amount = Math.round(payment.total_amount / 100);
  const now = nowSql();

  await q.run(
    "INSERT INTO subscription_payments (id, villa_id, amount, payment_date, period_start, period_end, status, note, created_by, created_at, updated_at, dodo_payment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    [`p_${payment.payment_id.slice(-24)}`.slice(0, 40), villa.id, amount, paidOn, periodStart, periodEnd, "paid", "Card payment", null, now, now, payment.payment_id],
  );
  await logDodo(q, villa.id, "dodo_payment", `${villa.name} paid ${money(amount)} by card`);
  outbox.push({ kind: "payment_received", villaId: villa.id, amount, periodEnd });
}

function nextMonth(iso: string) {
  const d = fromISO(iso);
  const lastOfNext = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), lastOfNext)));
}

/**
 * Handle one verified Dodo webhook, at most once per webhook id. Everything
 * happens in one transaction: if anything fails, nothing is kept and Dodo
 * delivers the event again later.
 */
export async function handleDodoEvent(webhookId: string, event: DodoEvent) {
  // Ask Dodo for the subscription as it is now, so events that arrive late or
  // out of order cannot put an old state back. A payment can also arrive before
  // its subscription's own event; fetching the subscription links the villa first.
  const subscriptionId = event.type.startsWith("subscription.") || event.type.startsWith("payment.") ? event.data.subscription_id : null;
  const subscription = typeof subscriptionId === "string" && subscriptionId ? await dodo.getSubscription(subscriptionId) : null;
  if (event.type.startsWith("subscription.") && !subscription) return "ignored";

  const outbox: OwnerEmail[] = [];
  const result = await transaction(async (tx) => {
    const fresh = await tx.run("INSERT IGNORE INTO dodo_webhook_events (webhook_id, type, received_at) VALUES (?,?,?)", [webhookId.slice(0, 100), event.type.slice(0, 60), nowSql()]);
    if (fresh.affectedRows === 0) return "duplicate";

    if (subscription) await applySubscription(tx, subscription, event.type, outbox);

    if (event.type === "payment.succeeded") await applyPayment(tx, event.data as unknown as DodoPayment, outbox);
    else if (event.type === "payment.failed") {
      const payment = event.data as unknown as DodoPayment;
      const villa = await villaFor(tx, payment.subscription_id, payment.metadata);
      if (villa) await logDodo(tx, villa.id, "dodo_payment_failed", `${villa.name} card payment failed`);
    }
    return "handled";
  });
  // Only once the changes are saved, so a retried webhook never emails twice.
  if (result === "handled") queueOwnerEmails(outbox);
  return result;
}

/* ------------------------------------------------------------ daily job */

/**
 * Three days before a free trial ends, remind the owner that the first charge
 * is coming, once. Skipped when the owner has already cancelled in Dodo.
 */
export async function runTrialReminders(today: string) {
  const villas = await db.query<{ id: string; name: string; monthly_subscription_amount: number; dodo_subscription_id: string; trial_ends_on: string }>(
    `SELECT id, name, monthly_subscription_amount, dodo_subscription_id, trial_ends_on FROM villas
      WHERE account_status = 'active' AND dodo_status = 'active' AND dodo_subscription_id IS NOT NULL
        AND trial_ends_on > ? AND trial_ends_on <= ? AND trial_reminder_sent IS NULL`,
    [today, addDays(today, 3)],
  );
  const emails: OwnerEmail[] = [];
  let skipped = 0;
  for (const v of villas) {
    try {
      const sub = dodoEnabled() ? await dodo.getSubscription(v.dodo_subscription_id) : null;
      if (sub && (sub.status !== "active" || sub.cancel_at_next_billing_date)) skipped += 1;
      else emails.push({ kind: "trial_ending", villaId: v.id, firstCharge: v.trial_ends_on, amount: v.monthly_subscription_amount });
    } catch (error) {
      console.error("[trial] could not check the subscription, will try tomorrow", v.id, error);
      continue;
    }
    await db.run("UPDATE villas SET trial_reminder_sent = ? WHERE id = ?", [today, v.id]);
  }
  for (const e of emails) await sendOwnerEmail(e);
  return { trialReminders: emails.length, trialRemindersSkipped: skipped };
}

/* ------------------------------------------------- super admin: subscriptions */

async function villaRow(villaId: string) {
  const villa = await db.one<VillaBillingRow>(`SELECT ${BILLING_COLUMNS} FROM villas WHERE id = ?`, [villaId]);
  if (!villa) throw new ApiError(404, "not_found", "Villa not found.");
  return villa;
}

const liveCard = (v: VillaBillingRow) => !!v.dodo_subscription_id && !!v.dodo_status && LIVE.has(v.dodo_status);

/**
 * The Super Admin cancels a villa's card subscription.
 *  - "period_end": no more charges; the villa keeps access until the paid month (or trial) runs out.
 *  - "now": the subscription ends straight away and the villa goes off (the owner can subscribe again).
 */
export async function adminCancelSubscription(villaId: string, when: "period_end" | "now"): Promise<string> {
  const villa = await villaRow(villaId);
  if (!liveCard(villa)) throw badRequest(`${villa.name} has no card subscription to cancel.`);
  const now = nowSql();
  if (when === "period_end") {
    const sub = await dodo.cancelAtPeriodEnd(villa.dodo_subscription_id!, true);
    await db.run("UPDATE villas SET cancel_at_period_end = 1, updated_at = ? WHERE id = ?", [now, villaId]);
    const ends = sub?.next_billing_date ? isoToLocalDate(sub.next_billing_date) : null;
    return `${villa.name} card subscription set to end${ends ? ` on ${ends}` : " at the end of the paid month"}`;
  }
  await dodo.cancel(villa.dodo_subscription_id!);
  await db.run(
    `UPDATE villas SET dodo_status = 'cancelled', subscription_status = 'payment_due', cancel_at_period_end = 0, trial_ends_on = NULL,
       disabled_reason = CASE WHEN account_status = 'active' THEN 'subscription' ELSE disabled_reason END, account_status = 'disabled', updated_at = ? WHERE id = ?`,
    [now, villaId],
  );
  if (villa.account_status === "active") queueOwnerEmails([{ kind: "subscription_ended", villaId }]);
  return `${villa.name} card subscription cancelled now, access switched off`;
}

/** Undo a cancellation set for the end of the paid month: the subscription carries on and charges as usual. */
export async function adminKeepSubscription(villaId: string): Promise<string> {
  const villa = await villaRow(villaId);
  if (!liveCard(villa) || !villa.cancel_at_period_end) throw badRequest(`${villa.name} has no cancellation to undo.`);
  await dodo.cancelAtPeriodEnd(villa.dodo_subscription_id!, false);
  await db.run("UPDATE villas SET cancel_at_period_end = 0, updated_at = ? WHERE id = ?", [nowSql(), villaId]);
  return `${villa.name} card subscription will carry on, cancellation undone`;
}

/**
 * Free access without a card, up to and including `lastDay`. Not for a villa
 * that is paying by card (cancel that first, so it is never charged as well).
 * A villa switched off by hand stays off until it is enabled.
 */
export async function grantFreeAccess(villaId: string, lastDay: string): Promise<string> {
  const villa = await villaRow(villaId);
  const today = serverToday();
  if (lastDay < today) throw badRequest("Choose today or a later date.");
  if (nightsBetween(today, lastDay) > 366) throw badRequest("Free access can be given for up to a year at a time.");
  if (liveCard(villa)) throw badRequest(`${villa.name} is paying by card. Cancel the card subscription first, then give free access.`);
  if (villa.account_status === "disabled" && villa.disabled_reason === "manual") throw badRequest(`${villa.name} is switched off. Enable its access first.`);
  await db.run(
    `UPDATE villas SET subscription_start_date = CASE WHEN disabled_reason = 'unpaid' THEN ? ELSE subscription_start_date END,
       free_until = ?, account_status = 'active', disabled_reason = NULL, subscription_status = 'active', next_payment_date = ?, updated_at = ? WHERE id = ?`,
    [today, lastDay, addDays(lastDay, 1), nowSql(), villaId],
  );
  return `${villa.name} given free access until ${lastDay}`;
}

/** Free access is over (its last day passed, or the Super Admin ended it): the villa goes off until it subscribes. */
export async function endFreeAccess(villaId: string, reason: "expired" | "ended"): Promise<string | null> {
  const villa = await villaRow(villaId);
  if (!villa.free_until) return null;
  const today = serverToday();
  await db.run(
    `UPDATE villas SET free_until = NULL, subscription_status = 'payment_due', next_payment_date = ?,
       disabled_reason = CASE WHEN account_status = 'active' THEN 'subscription' ELSE disabled_reason END,
       account_status = 'disabled', updated_at = ? WHERE id = ?`,
    [today, nowSql(), villaId],
  );
  if (villa.account_status === "active") queueOwnerEmails([{ kind: "subscription_ended", villaId }]);
  const detail = reason === "expired" ? `${villa.name} free access ended, access switched off` : `${villa.name} free access ended early, access switched off`;
  if (reason === "expired") await logDodo(db, villaId, "free_access_ended", detail);
  return detail;
}

/** Daily: switch off villas whose free access has run out. */
export async function runFreeAccessExpiry(today: string) {
  const rows = await db.query<{ id: string }>("SELECT id FROM villas WHERE free_until IS NOT NULL AND free_until < ?", [today]);
  for (const r of rows) await endFreeAccess(r.id, "expired");
  return { freeAccessEnded: rows.length };
}
