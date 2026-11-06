import type { Portal } from "@/lib/server/auth";
import { email, readJson, route } from "@/lib/server/http";
import { requestPasswordReset } from "@/lib/server/passwords";

/** Public: email a password reset link. Always answers ok, so it never shows whether an account exists. */
export const POST = route(async (request) => {
  const body = await readJson(request);
  const portal: Portal = body.portal === "admin" ? "admin" : "villa";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  await requestPasswordReset(portal, email(body.email), new URL(request.url).origin, ip);
  return { ok: true };
});
