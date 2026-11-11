import { requireVillaAdmin } from "@/lib/server/auth";
import { dodoEnabled } from "@/lib/server/config";
import { route } from "@/lib/server/http";
import { loadVillaData, loadVillaSubscription } from "@/lib/server/tenant";

/**
 * The signed-in admin's own villa: rooms, guests, bookings, expenses, amenities. Nothing here accepts a villa id.
 * A new sign-up that has not paid yet may look (firstPayment says what subscribing costs); changing anything waits for the payment.
 */
export const GET = route(async () => {
  const { user, villaId, unpaid } = await requireVillaAdmin({ allowUnpaid: true });
  const [data, subscription] = await Promise.all([loadVillaData(villaId, user.name, user.email), loadVillaSubscription(villaId)]);
  const firstPayment = unpaid ? { monthlyAmount: subscription.monthlyAmount, canPay: dodoEnabled(), firstPayment: true, trialDays: subscription.trialOffer } : null;
  return { ok: true, user: { name: user.name, email: user.email }, data, subscription, tour: user.tourPending, firstPayment };
});
