import { loadAdminData } from "@/lib/server/admin";
import { requireSuperAdmin } from "@/lib/server/auth";
import { route } from "@/lib/server/http";

export const GET = route(async () => {
  const me = await requireSuperAdmin();
  return { ok: true, data: await loadAdminData(me) };
});
