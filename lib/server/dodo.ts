import { createHmac, timingSafeEqual } from "node:crypto";
import { config, dodoEnabled, nowSql } from "./config";
import { db } from "./db";
import { ApiError } from "./http";

/*
 * Dodo Payments: card payments for villa subscriptions.
 *
 * Only this file talks to Dodo. Amounts in this app are whole rupees; Dodo
 * counts in the currency's smallest unit (cents), hence the * 100 and / 100.
 *
 * Docs: https://docs.dodopayments.com/developer-resources/subscription-integration-guide
 */

const BASE_URL = () => config.dodo.baseUrl || (config.dodo.mode === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com");

/** A subscription as Dodo returns it (only the fields this app uses). */
export interface DodoSubscription {
  subscription_id: string;
  status: "pending" | "active" | "on_hold" | "paused" | "cancelled" | "failed" | "expired" | "past_due";
  product_id: string;
  customer: { customer_id: string; email: string; name: string };
  recurring_pre_tax_amount: number;
  currency: string;
  next_billing_date: string | null;
  previous_billing_date: string | null;
  cancel_at_next_billing_date: boolean;
  metadata: Record<string, string | number | boolean>;
}

/** A payment as Dodo returns it (only the fields this app uses). */
export interface DodoPayment {
  payment_id: string;
  subscription_id: string | null;
  total_amount: number;
  currency: string;
  status: string | null;
  created_at: string;
  customer: { customer_id: string; email: string; name: string };
  metadata: Record<string, string | number | boolean>;
  service_periods?: { subscription_id: string; starts_at: string; ends_at: string }[];
}

export function assertDodoReady() {
  if (!dodoEnabled()) throw new ApiError(503, "payments_unavailable", "Card payments are not set up yet. Please contact the platform administrator.");
}

async function call<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  assertDodoReady();
  let response: Response;
  try {
    response = await fetch(`${BASE_URL()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.dodo.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("[dodo]", method, path, error);
    throw new ApiError(502, "payments_unreachable", "The payment service could not be reached. Please try again in a moment.");
  }
  const text = await response.text();
  if (!response.ok) {
    console.error("[dodo]", method, path, response.status, text.slice(0, 500));
    throw new ApiError(502, "payments_error", "The payment service did not accept the request. Please try again, or contact the platform administrator.");
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export const dodo = {
  getSubscription: (id: string) => call<DodoSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`),

  createCheckout: (body: Record<string, unknown>) => call<{ session_id: string; checkout_url: string | null }>("POST", "/checkouts", body),

  portalLink: (customerId: string, returnUrl: string) =>
    call<{ link: string }>("POST", `/customers/${encodeURIComponent(customerId)}/customer-portal/session?return_url=${encodeURIComponent(returnUrl)}`),

  /** Ends the subscription now: no further charges. */
  cancel: (subscriptionId: string) => call<DodoSubscription>("PATCH", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { status: "cancelled" }),

  /** The new price applies from the next billing date; nothing is charged now. */
  changePlan: (subscriptionId: string, productId: string) =>
    call("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`, {
      product_id: productId,
      quantity: 1,
      proration_billing_mode: "do_not_bill",
      effective_at: "next_billing_date",
    }),
};

/**
 * The Dodo product for a monthly amount, created the first time it is needed
 * and reused after that. Products are kept per mode, as test and live are separate in Dodo.
 */
/** What the customer sees on the Dodo checkout, e.g. "LankaStay subscription, LKR 5,000 a month". */
function productName(amount: number, platformName: string) {
  return `${platformName || "LankaStay"} subscription, ${config.dodo.currency} ${amount.toLocaleString("en-US")} a month`.slice(0, 100);
}

/** Give a product the current name in Dodo. A failure is logged and tried again next time. */
async function renameProduct(productId: string, name: string) {
  try {
    await call("PATCH", `/products/${encodeURIComponent(productId)}`, { name });
    await db.run("UPDATE dodo_products SET name = ? WHERE product_id = ?", [name, productId]);
  } catch (error) {
    console.error("[dodo] rename product", productId, error);
  }
}

/** After the platform name changes: rename every product already made in Dodo, so checkouts show the new name. */
export async function renameProducts(platformName: string) {
  if (!dodoEnabled()) return;
  const rows = await db.query<{ product_id: string; amount: number; name: string | null }>("SELECT product_id, amount, name FROM dodo_products WHERE mode = ? AND currency = ?", [
    config.dodo.mode,
    config.dodo.currency,
  ]);
  for (const r of rows) {
    const name = productName(r.amount, platformName);
    if (r.name !== name) await renameProduct(r.product_id, name);
  }
}

export async function productFor(amount: number, platformName: string): Promise<string> {
  const { mode, currency } = config.dodo;
  const name = productName(amount, platformName);
  const known = await db.one<{ product_id: string; name: string | null }>("SELECT product_id, name FROM dodo_products WHERE mode = ? AND currency = ? AND amount = ?", [mode, currency, amount]);
  if (known) {
    // Made under an older platform name: bring it up to date before the owner sees it.
    if (known.name !== name) await renameProduct(known.product_id, name);
    return known.product_id;
  }

  const created = await call<{ product_id: string }>("POST", "/products", {
    name,
    description: "Monthly subscription for one villa.",
    tax_category: "saas",
    price: {
      type: "recurring_price",
      price: amount * 100,
      currency,
      payment_frequency_interval: "Month",
      payment_frequency_count: 1,
      subscription_period_interval: "Year",
      subscription_period_count: 20,
      purchasing_power_parity: false,
      tax_inclusive: true,
      trial_period_days: 0,
    },
    metadata: { app: "lankastay", amount },
  });
  // If two requests created one at the same moment, the first one saved wins.
  await db.run("INSERT IGNORE INTO dodo_products (mode, currency, amount, product_id, name, created_at) VALUES (?,?,?,?,?,?)", [mode, currency, amount, created.product_id, name, nowSql()]);
  const saved = await db.one<{ product_id: string }>("SELECT product_id FROM dodo_products WHERE mode = ? AND currency = ? AND amount = ?", [mode, currency, amount]);
  return saved!.product_id;
}

/* ------------------------------------------------------------------ webhooks */

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Checks that a webhook really comes from Dodo (Standard Webhooks signature).
 * The body must be the raw text, exactly as received.
 */
export function verifyWebhook(headers: Headers, rawBody: string, now = Date.now()): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures || !config.dodo.webhookKey) return false;

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) return false;

  const secret = config.dodo.webhookKey.startsWith("whsec_") ? Buffer.from(config.dodo.webhookKey.slice(6), "base64") : Buffer.from(config.dodo.webhookKey, "utf8");
  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${rawBody}`).digest();

  return signatures.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
