import { requireVillaAdmin, requireVillaCanEdit } from "@/lib/server/auth";
import { readJson, route } from "@/lib/server/http";
import { runVillaAction } from "@/lib/server/tenant";

/**
 * Every change a villa admin makes. The villa comes from the session; anything in the request that names a villa is ignored.
 * Nothing can be changed while the villa's subscription payment is due or overdue.
 */
export const POST = route(async (request) => {
  const { user, villaId } = await requireVillaAdmin();
  await requireVillaCanEdit(villaId);
  await runVillaAction({ villaId, userId: user.id }, await readJson(request));
  return { ok: true };
});
