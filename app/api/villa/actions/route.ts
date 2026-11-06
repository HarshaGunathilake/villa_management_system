import { requireVillaAdmin } from "@/lib/server/auth";
import { readJson, route } from "@/lib/server/http";
import { runVillaAction } from "@/lib/server/tenant";

/** Every change a villa admin makes. The villa comes from the session; anything in the request that names a villa is ignored. */
export const POST = route(async (request) => {
  const { user, villaId } = await requireVillaAdmin();
  await runVillaAction({ villaId, userId: user.id }, await readJson(request));
  return { ok: true };
});
