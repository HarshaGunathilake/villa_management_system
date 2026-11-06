import { searchActivity } from "@/lib/server/activity";
import { requireSuperAdmin } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { route } from "@/lib/server/http";

export const GET = route(async (request) => {
  await requireSuperAdmin();
  return { ok: true, ...(await searchActivity(new URL(request.url).searchParams, config.timeZone)) };
});
