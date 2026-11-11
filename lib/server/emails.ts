import { after } from "next/server";
import { config } from "./config";
import { db } from "./db";
import { layout, loadMailSettings, sendEmail } from "./mail";

/*
 * The emails LankaStay sends to villa owners. Each one can be switched off in
 * Super Admin → Settings → Email. They go out after the response is sent, so a
 * slow mail server never holds up a sign-up or a Dodo webhook.
 */

export type OwnerEmail =
  | { kind: "welcome"; villaId: string; signedUp: boolean }
  | { kind: "payment_received"; villaId: string; amount: number; periodEnd: string }
  | { kind: "payment_failed"; villaId: string }
  | { kind: "subscription_ended"; villaId: string }
  | { kind: "trial_started"; villaId: string; days: number; firstCharge: string; amount: number }
  | { kind: "trial_ending"; villaId: string; firstCharge: string; amount: number };

const TOGGLE = { welcome: "welcome", trial_started: "trial", trial_ending: "trial", payment_received: "paymentReceived", payment_failed: "paymentFailed", subscription_ended: "subscriptionEnded" } as const;

/** Run work after the response; outside a request (scripts, tests) run it straight away. */
export function later(work: () => Promise<unknown>) {
  const safe = () => work().catch((e) => console.error("[mail] background work failed", e));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

const money = (amount: number) => `LKR ${amount.toLocaleString("en-US")}`;
const longDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const link = (path: string) => (config.appUrl ? `${config.appUrl}${path}` : null);

/** Sends one of the owner emails to every active admin of the villa, if that email is switched on. */
export async function sendOwnerEmail(e: OwnerEmail) {
  const settings = await loadMailSettings();
  if (!settings.emails[TOGGLE[e.kind]]) return;
  const villa = await db.one<{ name: string; trial_days: number | null; disabled_reason: string | null; free_until: string | null }>(
    "SELECT name, trial_days, disabled_reason, free_until FROM villas WHERE id = ?",
    [e.villaId],
  );
  if (!villa) return;
  const owners = await db.query<{ name: string; email: string }>("SELECT name, email FROM users WHERE villa_id = ? AND role = 'villa_admin' AND status = 'active'", [e.villaId]);

  for (const owner of owners) {
    const first = owner.name.split(/\s+/)[0] || owner.name;
    await sendEmail({
      kind: e.kind,
      to: owner.email,
      villaId: e.villaId,
      build: (platform) => {
        const signIn = link("/login");
        const billing = link("/subscription");
        let subject: string;
        let body: Parameters<typeof layout>[1];
        switch (e.kind) {
          case "welcome":
            subject = `Welcome to ${platform}`;
            {
              const trial = e.signedUp && villa.disabled_reason === "unpaid" ? (villa.trial_days ?? 0) : 0;
              body = {
                heading: `Welcome, ${first}`,
                paragraphs: !e.signedUp
                  ? [
                      `An account for ${villa.name} has been set up for you on ${platform}.`,
                      `Sign in with this email address and the password you were given. You can change the password in Settings after you sign in.`,
                      ...(villa.free_until
                        ? [`It's free to use until ${longDate(villa.free_until)}. To carry on after that, add your card on the Subscription page any time before then. Nothing is charged until the free period ends.`]
                        : []),
                    ]
                  : trial > 0
                    ? [
                        `Your account for ${villa.name} is ready.`,
                        `Add your card on the Subscription page to start your ${trial}-day free trial. Nothing is charged until the trial ends, and you can cancel any time before then. Once your card is added, you can add rooms, bookings and expenses.`,
                      ]
                    : [`Your account for ${villa.name} is ready.`, `To open your villa, make the first monthly payment on the Subscription page. As soon as it goes through, you can add rooms, bookings and expenses.`],
                button: e.signedUp
                  ? billing
                    ? { label: trial > 0 ? "Start my free trial" : "Make the first payment", url: billing }
                    : undefined
                  : signIn
                    ? { label: "Sign in", url: signIn }
                    : undefined,
              };
            }
            break;
          case "payment_received":
            subject = `Payment received: ${money(e.amount)}`;
            body = {
              heading: "Thank you, your payment went through",
              paragraphs: [`We received ${money(e.amount)} for ${villa.name}.`, `Your subscription is paid until ${longDate(e.periodEnd)}. Your card is charged again automatically after that.`],
              button: billing ? { label: "See your subscription", url: billing } : undefined,
            };
            break;
          case "payment_failed":
            subject = `Your card payment for ${villa.name} did not go through`;
            body = {
              heading: "Your card payment did not go through",
              paragraphs: [
                `We tried to charge your card for the ${platform} subscription of ${villa.name}, but the payment was declined.`,
                `We will try again over the next few days. To avoid any interruption, check your card or add a new one.`,
              ],
              button: billing ? { label: "Update your card", url: billing } : undefined,
            };
            break;
          case "trial_started":
            subject = `Your ${e.days}-day free trial has started`;
            body = {
              heading: "Your free trial has started",
              paragraphs: [
                `Your card is saved and ${villa.name} is open. Use everything free until ${longDate(e.firstCharge)}.`,
                `Nothing has been charged. On ${longDate(e.firstCharge)} your card is charged ${money(e.amount)}, then every month after that. If you don't want to continue, cancel on the Subscription page before then and you won't be charged.`,
              ],
              button: billing ? { label: "See your subscription", url: billing } : undefined,
            };
            break;
          case "trial_ending":
            subject = `Your free trial ends on ${longDate(e.firstCharge)}`;
            body = {
              heading: "Your free trial ends soon",
              paragraphs: [
                `The free trial for ${villa.name} ends on ${longDate(e.firstCharge)}. That day your card is charged ${money(e.amount)}, and then every month.`,
                `Nothing to do if you want to carry on. If you don't, cancel on the Subscription page before ${longDate(e.firstCharge)} and you won't be charged.`,
              ],
              button: billing ? { label: "See your subscription", url: billing } : undefined,
            };
            break;
          case "subscription_ended":
            subject = `Your ${platform} subscription has ended`;
            body = {
              heading: "Your subscription has ended",
              paragraphs: [
                `The subscription for ${villa.name} has ended, so the villa is now read-only. Nothing has been deleted.`,
                `Subscribe again at any time to carry on where you left off.`,
              ],
              button: billing ? { label: "Subscribe again", url: billing } : undefined,
            };
            break;
        }
        return { subject, ...layout(platform, body) };
      },
    });
  }
}

/** Queue owner emails to go out after the response. */
export function queueOwnerEmails(emails: OwnerEmail[]) {
  if (emails.length === 0) return;
  later(async () => {
    for (const e of emails) await sendOwnerEmail(e);
  });
}

export function passwordResetEmail(name: string, url: string) {
  return (platform: string) => ({
    subject: `Reset your ${platform} password`,
    ...layout(platform, {
      heading: "Reset your password",
      paragraphs: [`Hello ${name.split(/\s+/)[0] || name},`, `Someone asked to reset the password for this email address. Choose a new password with the button below. The link works once and expires in 1 hour.`],
      button: { label: "Choose a new password", url },
      footnote: "If you did not ask for this, you can ignore this email. Your password stays the same.",
    }),
  });
}

export function testEmail() {
  return (platform: string) => ({
    subject: `${platform} test email`,
    ...layout(platform, {
      heading: "Your email settings work",
      paragraphs: [`This is a test email from ${platform}. Villa owners will now get password reset links and the emails you switched on in Settings.`],
    }),
  });
}

export function verificationEmail(name: string, url: string) {
  return (platform: string) => ({
    subject: `Confirm your email for ${platform}`,
    ...layout(platform, {
      heading: "Confirm your email address",
      paragraphs: [`Hello ${name.split(/\s+/)[0] || name},`, `Thanks for signing up. Confirm this is your email address to open your account. The link works for 24 hours.`],
      button: { label: "Confirm my email", url },
      footnote: "If you did not create an account, you can ignore this email.",
    }),
  });
}
