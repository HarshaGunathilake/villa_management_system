import { nowSql } from "@/lib/server/config";
import { db } from "@/lib/server/db";
import { ApiError, email, readJson, route } from "@/lib/server/http";
import { websiteFlags } from "@/lib/server/site";

/** Public: "Tell me when it opens" on the Coming soon page. Asking twice is fine. */
const HOUR = 3_600_000;
const recent = new Map<string, number[]>();

export const POST = route(async (request) => {
  const body = await readJson(request);
  if (typeof body.website === "string" && body.website.trim() !== "") return { ok: true }; // a bot
  const flags = await websiteFlags();
  if (!flags.comingSoon || !flags.waitlistForm) throw new ApiError(403, "waitlist_closed", "This form is closed.");
  const address = email(body.email);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < HOUR);
  if (times.length >= 10) throw new ApiError(429, "too_many_attempts", "Too many tries from here. Please try again later.");
  times.push(now);
  recent.set(ip, times);
  await db.run("INSERT IGNORE INTO waitlist (email, created_at) VALUES (?, ?)", [address, nowSql()]);
  return { ok: true };
});
