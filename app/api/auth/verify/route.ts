import { requireVillaAdmin } from "@/lib/server/auth";
import { ApiError, email, readJson, route, text } from "@/lib/server/http";
import { changeUnverifiedEmail, sendVerification, verifyEmail } from "@/lib/server/verify";

/**
 * Email verification.
 *   { token }                    public: the link from the email
 *   { action: "resend" }         signed in, not verified yet: send a new link
 *   { action: "change", email }  signed in, not verified yet: correct the address and send a link there
 */
export const POST = route(async (request) => {
  const body = await readJson(request);
  if (body.token !== undefined) {
    const result = await verifyEmail(text(body.token, "Link", { min: 20, max: 200 }));
    return { ok: true, email: result.email };
  }
  const { user } = await requireVillaAdmin({ allowLapsed: true, allowUnverified: true });
  if (user.emailVerified) return { ok: true, verified: true };
  const origin = new URL(request.url).origin;
  const problem = body.action === "change" ? await changeUnverifiedEmail(user, email(body.email), origin) : await sendVerification(user, origin);
  if (problem) throw new ApiError(502, "email_failed", problem);
  return { ok: true };
});
