import { requireVillaAdmin } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { loadVillaData, loadVillaSubscription } from "@/lib/server/tenant";

/** The signed-in admin's own villa: rooms, guests, bookings, expenses, amenities. Nothing here accepts a villa id. */
export const GET = route(async () => {
  const { user, villaId } = await requireVillaAdmin();
  const [data, subscription] = await Promise.all([loadVillaData(villaId, user.name), loadVillaSubscription(villaId)]);
  return { ok: true, user: { name: user.name, email: user.email }, data, subscription, tour: user.tourPending };
});
