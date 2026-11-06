import { later, queueOwnerEmails } from "./emails";
import { sendVerification } from "./verify";
import { randomBytes } from "node:crypto";
import { createSession, hashPassword, verificationRequired } from "./auth";
import { isoToLocalDate, nowSql } from "./config";
import { db, transaction } from "./db";
import { ApiError, email as cleanEmail, password as cleanPassword, text } from "./http";

/*
 * Public sign-up: anyone can create a villa account. The villa starts locked
 * (account_status 'disabled', disabled_reason 'unpaid'): its admin can sign in
 * but sees only "Start your subscription" until the first card payment goes
 * through, which switches it on by itself (lib/server/billing.ts).
 *
 * The price is the platform's default monthly amount (Super Admin → Settings),
 * and the Super Admin can close sign-ups there too.
 */

export interface SignupInfo {
  open: boolean;
  monthlyAmount: number;
}

export async function signupInfo(): Promise<SignupInfo> {
  const rows = await db.query<{ name: string; value: string }>("SELECT name, value FROM platform_settings WHERE name IN ('signupsOpen','defaultMonthlyAmount','comingSoon')");
  const get = (name: string) => rows.find((r) => r.name === name)?.value;
  const monthlyAmount = Number(get("defaultMonthlyAmount")) || 0;
  // Open unless the Super Admin closed them or the site is still "coming soon", and only with a price to charge.
  return { open: get("signupsOpen") !== "false" && get("comingSoon") !== "true" && monthlyAmount > 0, monthlyAmount };
}

/* A few sign-ups per address per hour, so the form cannot be used to flood the database. */
const HOUR = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;
const recent = new Map<string, number[]>();

function rateLimit(ip: string) {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < HOUR);
  if (times.length >= MAX_PER_HOUR) throw new ApiError(429, "too_many_attempts", "Too many sign-ups from here. Please try again later.");
  times.push(now);
  recent.set(ip, times);
}

const newId = (prefix: string) => `${prefix}_${randomBytes(6).toString("hex")}${Date.now().toString(36).slice(-4)}`;

export async function register(body: Record<string, unknown>, ip: string, origin: string) {
  const villaName = text(body.villaName, "Villa name", { min: 2, max: 160 });
  const location = text(body.location, "Location", { max: 160, optional: true });
  const ownerName = text(body.ownerName, "Your name", { min: 2, max: 120 });
  const adminEmail = cleanEmail(body.email);
  const phone = text(body.phone, "Phone", { max: 40, optional: true });
  const plain = cleanPassword(body.password);
  if (body.acceptTerms !== true) throw new ApiError(400, "bad_request", "Please accept the terms to create an account.");

  const info = await signupInfo();
  if (!info.open) throw new ApiError(403, "signups_closed", "New sign-ups are closed at the moment. Please contact us.");
  rateLimit(ip);

  const villaId = newId("v");
  const userId = newId("u");
  const now = nowSql();
  const today = isoToLocalDate(new Date().toISOString());
  const hash = await hashPassword(plain);
  const mustVerify = await verificationRequired();

  try {
    await transaction(async (tx) => {
      const taken = await tx.one<{ id: string }>("SELECT id FROM users WHERE email = ?", [adminEmail]);
      if (taken) throw new ApiError(409, "email_taken", "An account with this email already exists. Sign in instead.");
      // A villa may already use this address even if no login does (its owner's sign-in email was changed). One villa per address.
      const villaTaken = await tx.one<{ id: string }>("SELECT id FROM villas WHERE email = ? LIMIT 1", [adminEmail]);
      if (villaTaken) {
        throw new ApiError(409, "email_taken", "A villa is already registered with this email. Sign in instead, or contact us if you need a second villa.");
      }
      await tx.run(
        `INSERT INTO villas (id, name, location, phone, email, plan, monthly_subscription_amount, subscription_status, account_status, disabled_reason,
                             subscription_start_date, next_payment_date, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [villaId, villaName, location, phone, adminEmail, "Standard", info.monthlyAmount, "payment_due", "disabled", "unpaid", today, today, now, now],
      );
      await tx.run(
        "INSERT INTO users (id, villa_id, name, email, phone, password_hash, role, status, last_login_at, created_at, updated_at, email_unverified, tour_pending) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)",
        [userId, villaId, ownerName, adminEmail, phone, hash, "villa_admin", "active", now, now, now, mustVerify ? 1 : 0],
      );
      await tx.run("INSERT INTO activity_log (villa_id, action, detail, created_by, created_at) VALUES (?,?,?,?,?)", [
        villaId,
        "villa_signed_up",
        `${villaName} signed up, waiting for the first payment`,
        userId,
        now,
      ]);
    });
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the unique key catches the second.
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new ApiError(409, "email_taken", "An account with this email already exists. Sign in instead.");
    throw error;
  }

  await createSession(userId, "villa", true);
  // The welcome email follows once the address is confirmed.
  if (mustVerify) later(() => sendVerification({ id: userId, name: ownerName, email: adminEmail, villaId }, origin));
  else queueOwnerEmails([{ kind: "welcome", villaId, signedUp: true }]);
}
