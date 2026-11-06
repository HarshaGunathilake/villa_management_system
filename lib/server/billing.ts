import { queueOwnerEmails, type OwnerEmail } from "./emails";
import type { SubscriptionStatus } from "../admin-types";
import { addDays, fromISO, toISO } from "../dates";
import type { VillaBilling } from "../types";
import { config, dodoEnabled, isoToLocalDate, nowSql } from "./config";
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
}

const BILLING_COLUMNS = "id, name, monthly_subscription_amount, account_status, disabled_reason, dodo_customer_id, dodo_subscription_id, dodo_status";

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
  const session = await dodo.createCheckout({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: villa.dodo_customer_id ? { customer_id: villa.dodo_customer_id } : { email: admin.email, name: villa.name },
    billing_address: { country: config.dodo.country },
    billing_currency: config.dodo.currency,
    return_url: returnUrl(request, "/subscription?payment=done"),
    // Comes back on the subscription and its payments, so the webhook knows which villa paid.
    metadata: { villa_id: villa.id },
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
       subscription_status = COALESCE(?, subscription_status), next_payment_date = COALESCE(?, next_payment_date), updated_at = ?
     WHERE id = ?`,
    [sub.subscription_id, sub.customer?.customer_id ?? villa.dodo_customer_id, sub.status, status ?? null, sub.status === "active" ? nextDue : null, now, villa.id],
  );

  // Access follows the subscription, unless the Super Admin switched the villa off by hand.
  if ((sub.status === "cancelled" || sub.status === "expired") && villa.account_status === "active") {
    await q.run("UPDATE villas SET account_status = 'disabled', disabled_reason = 'subscription', updated_at = ? WHERE id = ?", [now, villa.id]);
    await logDodo(q, villa.id, "dodo_access_off", `${villa.name} card subscription ${sub.status}, access switched off`);
    outbox.push({ kind: "subscription_ended", villaId: villa.id });
    return;
  }
  if (sub.status === "active" && villa.account_status === "disabled" && villa.disabled_reason === "unpaid") {
    // A villa that signed up itself: the first payment opens the app. The subscription starts today.
    await q.run("UPDATE villas SET account_status = 'active', disabled_reason = NULL, subscription_start_date = ?, updated_at = ? WHERE id = ?", [
      isoToLocalDate(new Date().toISOString()),
      now,
      villa.id,
    ]);
    await logDodo(q, villa.id, "dodo_access_on", `${villa.name} made its first payment, access switched on`);
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
