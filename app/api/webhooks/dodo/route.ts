import { NextResponse } from "next/server";
import { handleDodoEvent } from "@/lib/server/billing";
import { dodoEnabled } from "@/lib/server/config";
import { ensureReady } from "@/lib/server/db";
import { verifyWebhook } from "@/lib/server/dodo";

/**
 * Dodo Payments calls this address whenever a subscription or payment changes.
 * In the Dodo dashboard, add the webhook URL https://<your site>/api/webhooks/dodo
 * and put its signing secret in DODO_PAYMENTS_WEBHOOK_KEY.
 *
 * Anything not signed by Dodo is refused. A failure answers 500, so Dodo tries again later.
 */
export async function POST(request: Request) {
  if (!dodoEnabled()) return NextResponse.json({ ok: false, error: "Card payments are not set up." }, { status: 503 });

  const raw = await request.text();
  if (!verifyWebhook(request.headers, raw)) return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });

  let event: { type?: unknown; data?: unknown };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (typeof event.type !== "string" || !event.data || typeof event.data !== "object") return NextResponse.json({ ok: true, result: "ignored" });

  try {
    await ensureReady();
    const result = await handleDodoEvent(request.headers.get("webhook-id")!, event as Parameters<typeof handleDodoEvent>[1]);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[dodo webhook]", event.type, error);
    return NextResponse.json({ ok: false, error: "Could not process the event." }, { status: 500 });
  }
}
