import { supportContact } from "@/lib/server/auth";
import { layout, mailConfigured, sendEmail } from "@/lib/server/mail";
import { ApiError, email, oneOf, readJson, route, text } from "@/lib/server/http";

/*
 * Public: the Contact us form. The message is emailed to the support address
 * in Super Admin → Settings, with the sender as the reply-to address.
 */

const TOPICS = ["signup", "account", "billing", "other"] as const;
const TOPIC_LABEL: Record<(typeof TOPICS)[number], string> = { signup: "Signing up", account: "My account", billing: "Billing", other: "Something else" };

const HOUR = 3_600_000;
const recent = new Map<string, number[]>();
function allowed(ip: string) {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < HOUR);
  if (times.length >= 5) return false;
  times.push(now);
  recent.set(ip, times);
  return true;
}

export const POST = route(async (request) => {
  const body = await readJson(request);
  // A field people never see: filled in means a bot. Answer as if it worked.
  if (typeof body.website === "string" && body.website.trim() !== "") return { ok: true };

  const topic = oneOf(body.topic ?? "other", TOPICS, "Topic");
  const name = text(body.name, "Your name", { min: 2, max: 120 });
  const from = email(body.email);
  const phone = text(body.phone, "Phone", { max: 40, optional: true });
  const villa = text(body.villa, "Villa name", { max: 160, optional: true });
  const message = text(body.message, "Message", { min: 5, max: 5000 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (!allowed(ip)) throw new ApiError(429, "too_many_attempts", "You've sent several messages already. Please try again later, or email us directly.");

  const support = await supportContact();
  if (!support.email || !(await mailConfigured())) {
    throw new ApiError(503, "email_unavailable", "Messages can't be sent from this form right now. Please email, call or WhatsApp us instead.");
  }

  const result = await sendEmail({
    kind: "contact",
    to: support.email,
    replyTo: from,
    build: (platform) => ({
      subject: `${TOPIC_LABEL[topic]}: message from ${name}${villa ? ` (${villa})` : ""}`,
      ...layout(platform, {
        heading: `New message from the website`,
        paragraphs: [
          `From: ${name} <${from}>${phone ? `, ${phone}` : ""}`,
          ...(villa ? [`Villa: ${villa}`] : []),
          `About: ${TOPIC_LABEL[topic]}`,
          message,
        ],
        footnote: "Reply to this email to answer them directly.",
      }),
    }),
  });
  if (!result.ok) throw new ApiError(502, "email_failed", "Your message couldn't be sent just now. Please try again, or email us directly.");
  return { ok: true };
});
