import { runAdminAction } from "@/lib/server/admin";
import { requireSuperAdmin } from "@/lib/server/auth";
import { readJson, route } from "@/lib/server/http";

export const POST = route(async (request) => {
  const me = await requireSuperAdmin();
  const result = await runAdminAction(me, await readJson(request));
  return { ok: true, ...(result ?? {}) };
});
