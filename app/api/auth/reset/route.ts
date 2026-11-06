import { readJson, route, text } from "@/lib/server/http";
import { checkResetToken, resetPassword } from "@/lib/server/passwords";

/** Public: is this reset link still good? */
export const GET = route(async (request) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return { ok: true, valid: token.length > 20 && token.length < 200 ? await checkResetToken(token) : false };
});

/** Public: set a new password with a reset link. */
export const POST = route(async (request) => {
  const body = await readJson(request);
  const result = await resetPassword(text(body.token, "Link", { min: 20, max: 200 }), body.password);
  return { ok: true, portal: result.portal };
});
