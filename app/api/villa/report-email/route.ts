import { addMonths, monthKey } from "@/lib/dates";
import { requireVillaAdmin } from "@/lib/server/auth";
import { serverToday } from "@/lib/server/config";
import { db } from "@/lib/server/db";
import { ApiError, readJson, route } from "@/lib/server/http";
import { sendMonthlyReport } from "@/lib/server/monthly-report";

/**
 * "Send me this report now" from Villa settings. Goes only to the villa's own
 * owners (and the extra address they saved), for a month that has started.
 */
export const POST = route(async (request) => {
  const { villaId } = await requireVillaAdmin();
  const body = await readJson(request);
  const thisMonth = monthKey(serverToday());
  const month = typeof body.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) ? body.month : addMonths(thisMonth, -1);
  if (month > thisMonth) throw new ApiError(400, "bad_request", "That month hasn't started yet.");
  const recent = await db.one("SELECT 1 FROM email_log WHERE villa_id = ? AND kind = 'monthly_report' AND created_at > UTC_TIMESTAMP() - INTERVAL 1 MINUTE LIMIT 1", [villaId]);
  if (recent) throw new ApiError(429, "too_soon", "A report was just sent. Please wait a minute before sending another.");
  const result = await sendMonthlyReport(villaId, month);
  if (!result.ok) throw new ApiError(502, "not_sent", result.error ?? "The report couldn't be sent.");
  return { ok: true, month, to: result.to };
});
