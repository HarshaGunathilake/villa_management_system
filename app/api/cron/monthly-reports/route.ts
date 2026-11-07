import { config } from "@/lib/server/config";
import { ApiError, route } from "@/lib/server/http";
import { runMonthlyReports } from "@/lib/server/monthly-report";

/**
 * Runs once a day (vercel.json). In the first week of each month it emails last
 * month's report to every villa that has Monthly report switched on and hasn't
 * had it yet. Only the scheduler, holding CRON_SECRET, may call it.
 */
export const maxDuration = 300;

export const GET = route(async (request) => {
  if (!config.cronSecret) throw new ApiError(503, "not_configured", "Set CRON_SECRET in the server settings to run scheduled jobs.");
  if (request.headers.get("authorization") !== `Bearer ${config.cronSecret}`) throw new ApiError(401, "unauthorized", "Not allowed.");
  return { ok: true, ...(await runMonthlyReports()) };
});
