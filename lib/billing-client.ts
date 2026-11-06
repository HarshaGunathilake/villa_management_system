import { api } from "./api";

/**
 * Sends the browser to Dodo Payments: the payment page, or the billing portal
 * (change card, invoices, cancel). Returns an error message if that could not start.
 */
export async function goToPayments(action: "checkout" | "portal"): Promise<string | null> {
  const result = await api<{ url: string }>("/api/villa/billing", { action });
  if (!result.ok) return result.error;
  window.location.assign(result.url);
  return null;
}

/** Dodo sends the admin back with ?payment=done. The payment is confirmed a moment later, by webhook. */
export const cameBackFromPayment = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("payment") === "done";
