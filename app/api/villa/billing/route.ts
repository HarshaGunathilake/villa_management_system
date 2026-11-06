import { requireVillaAdmin } from "@/lib/server/auth";
import { openPortal, startCheckout } from "@/lib/server/billing";
import { readJson, route, oneOf } from "@/lib/server/http";

/**
 * Card payments for the signed-in admin's own villa.
 *   { action: "checkout" }  Dodo's payment page for the villa's monthly amount
 *   { action: "portal" }    Dodo's billing portal: change card, invoices, cancel
 * A villa whose subscription ended may still use this, to pay again.
 */
export const POST = route(async (request) => {
  const { user, villaId } = await requireVillaAdmin({ allowLapsed: true });
  const action = oneOf((await readJson(request)).action, ["checkout", "portal"] as const, "Action");
  const result = action === "checkout" ? await startCheckout(request, villaId, user) : await openPortal(request, villaId);
  return { ok: true, ...result };
});
