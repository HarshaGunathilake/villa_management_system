import { requireSuperAdmin } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { loadReports } from "@/lib/server/reports";

export const GET = route(async (request) => {
  await requireSuperAdmin();
  const months = Number(new URL(request.url).searchParams.get("months"));
  return { ok: true, reports: await loadReports([6, 12, 24].includes(months) ? months : 12) };
});
