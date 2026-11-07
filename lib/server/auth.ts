import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { config, dodoEnabled, nowSql } from "./config";
import { db } from "./db";
import { ApiError } from "./http";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/* --------------------------------------------------------------- passwords */

/** Passwords are never stored. Only a salted scrypt hash is. */
export async function hashPassword(plain: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string) {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(plain, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/* ---------------------------------------------------------------- sessions */

export type Portal = "villa" | "admin";
export type Role = "super_admin" | "villa_admin";

// Separate cookies, so a Super Admin can be signed in to the admin area and a villa at once.
const COOKIE: Record<Portal, string> = { villa: "vms_session", admin: "vms_admin" };
export const SESSION_COOKIES = COOKIE;

const HOUR = 3_600_000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export interface SessionUser {
  id: string;
  villaId: string | null;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: "active" | "disabled";
  /** False only for a self sign-up that has not clicked its verification link yet */
  emailVerified: boolean;
  /** Show the first-time guide on the next visit */
  tourPending: boolean;
}

interface UserRow {
  id: string;
  villa_id: string | null;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: "active" | "disabled";
  password_hash: string;
  email_unverified: number;
  tour_pending: number;
}

const toUser = (r: UserRow): SessionUser => ({ id: r.id, villaId: r.villa_id, name: r.name, email: r.email, phone: r.phone, role: r.role, status: r.status, emailVerified: !r.email_unverified, tourPending: !!r.tour_pending });

export async function createSession(userId: string, portal: Portal, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const lifetime = remember ? 30 * 24 * HOUR : 12 * HOUR;
  // Only a hash of the token is stored, so a copy of the database cannot be used to sign in.
  await db.run("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [sha256(token), userId, nowSql(lifetime), nowSql()]);
  await db.run("DELETE FROM sessions WHERE expires_at < ?", [nowSql()]);
  (await cookies()).set(COOKIE[portal], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
    ...(remember ? { maxAge: Math.floor(lifetime / 1000) } : {}),
  });
}

export async function destroySession(portal: Portal) {
  const jar = await cookies();
  const token = jar.get(COOKIE[portal])?.value;
  if (token) await db.run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  jar.delete(COOKIE[portal]);
}

export async function endSessionsForUser(userId: string) {
  await db.run("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

export async function endSessionsForVilla(villaId: string) {
  await db.run("DELETE s FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.villa_id = ?", [villaId]);
}

async function currentUser(portal: Portal): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE[portal])?.value;
  if (!token) return null;
  const row = await db.one<UserRow>(
    `SELECT u.id, u.villa_id, u.name, u.email, u.phone, u.role, u.status, u.password_hash, u.email_unverified, u.tour_pending
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    [sha256(token), nowSql()],
  );
  return row ? toUser(row) : null;
}

/* ------------------------------------------------------------------ guards */

/** Super Admin → Settings: new sign-ups must verify their email (on unless switched off). */
export async function verificationRequired() {
  const row = await db.one<{ value: string }>("SELECT value FROM platform_settings WHERE name = 'requireEmailVerification'");
  return row?.value !== "false";
}

export async function supportContact() {
  const rows = await db.query<{ name: string; value: string }>("SELECT name, value FROM platform_settings WHERE name IN ('supportEmail','supportPhone','platformName')");
  const get = (name: string) => rows.find((r) => r.name === name)?.value ?? "";
  return { email: get("supportEmail"), phone: get("supportPhone"), platformName: get("platformName") };
}

async function accessDisabled() {
  return new ApiError(403, "access_disabled", "Your villa account is currently inactive.", { support: await supportContact() });
}

/**
 * No access until the villa pays: either the card subscription ended, or the
 * villa signed up itself and has not made its first payment (firstPayment).
 * The admin may sign in, but only to pay.
 */
async function subscriptionEnded(villaId: string) {
  const villa = await db.one<{ monthly_subscription_amount: number; disabled_reason: string | null }>("SELECT monthly_subscription_amount, disabled_reason FROM villas WHERE id = ?", [villaId]);
  const firstPayment = villa?.disabled_reason === "unpaid";
  return new ApiError(403, "subscription_ended", firstPayment ? "Your subscription has not started yet." : "Your subscription has ended.", {
    support: await supportContact(),
    renewal: { monthlyAmount: villa?.monthly_subscription_amount ?? 0, canPay: dodoEnabled(), firstPayment },
  });
}

interface VillaAccessRow {
  account_status: string;
  disabled_reason: string | null;
}
/** Off because of payment: the subscription ended ("subscription"), or a self sign-up has not paid yet ("unpaid"). */
const lapsed = (v: VillaAccessRow) => v.account_status === "disabled" && (v.disabled_reason === "subscription" || v.disabled_reason === "unpaid");

/**
 * Every villa request passes through here. The villa is taken from the
 * signed-in user's own record, never from anything the browser sends, and both
 * the user and the villa must be active.
 *
 * A self sign-up that has not made its first payment ("unpaid") may look at its
 * villa (allowUnpaid: the data route) but change nothing: every other route
 * answers payment_due until the first payment goes through.
 */
export async function requireVillaAdmin(
  opts: { allowLapsed?: boolean; allowUnverified?: boolean; allowUnpaid?: boolean } = {},
): Promise<{ user: SessionUser; villaId: string; unpaid: boolean }> {
  const user = await currentUser("villa");
  if (!user || user.role !== "villa_admin" || !user.villaId) throw new ApiError(401, "unauthenticated", "Please sign in.");
  if (user.status !== "active") throw await accessDisabled();
  // A new sign-up proves the email is theirs before anything else, paying included.
  if (!user.emailVerified && !opts.allowUnverified && (await verificationRequired())) {
    throw new ApiError(403, "email_unverified", "Please verify your email address first.", { email: user.email, support: await supportContact() });
  }
  const villa = await db.one<VillaAccessRow>("SELECT account_status, disabled_reason FROM villas WHERE id = ?", [user.villaId]);
  if (!villa) throw await accessDisabled();
  if (lapsed(villa)) {
    const unpaid = villa.disabled_reason === "unpaid";
    // Only the payment routes accept a villa whose subscription ended.
    if (opts.allowLapsed || (unpaid && opts.allowUnpaid)) return { user, villaId: user.villaId, unpaid };
    if (unpaid) throw new ApiError(403, "payment_due", "Subscribe to start using your villa. You can look around until then.");
    throw await subscriptionEnded(user.villaId);
  }
  if (villa.account_status !== "active") throw await accessDisabled();
  return { user, villaId: user.villaId, unpaid: false };
}

/**
 * A villa with a payment due or overdue is read-only: the admin can still see
 * everything and pay, but every change is refused until the status is Active again.
 */
export async function requireVillaCanEdit(villaId: string) {
  const villa = await db.one<{ subscription_status: string }>("SELECT subscription_status FROM villas WHERE id = ?", [villaId]);
  if (villa && villa.subscription_status !== "active") {
    throw new ApiError(
      403,
      "payment_due",
      villa.subscription_status === "overdue"
        ? "Your subscription payment is overdue, so changes are paused. Pay from the Subscription page to carry on."
        : "Your subscription payment is due, so changes are paused. Pay from the Subscription page to carry on.",
    );
  }
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await currentUser("admin");
  if (!user) throw new ApiError(401, "unauthenticated", "Please sign in.");
  if (user.role !== "super_admin" || user.status !== "active") throw new ApiError(403, "forbidden", "Super Admin access only.");
  return user;
}

/* ------------------------------------------------------------------- login */

// Slows down password guessing: 8 wrong tries for one email locks it for 10 minutes.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_TRIES = 8;
const LOCK_MS = 10 * 60_000;

export async function login(portal: Portal, emailInput: string, passwordInput: string, remember: boolean) {
  const key = `${portal}:${emailInput}`;
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.count >= MAX_TRIES && record.until > now) {
    throw new ApiError(429, "too_many_attempts", "Too many attempts. Please wait a few minutes and try again.");
  }

  const row = await db.one<UserRow>("SELECT id, villa_id, name, email, phone, role, status, password_hash, email_unverified, tour_pending FROM users WHERE email = ?", [emailInput]);
  const wantedRole: Role = portal === "admin" ? "super_admin" : "villa_admin";
  const valid = !!row && row.role === wantedRole && (await verifyPassword(passwordInput, row.password_hash));

  if (!valid) {
    const next = record && record.until > now ? record.count + 1 : 1;
    attempts.set(key, { count: next, until: now + LOCK_MS });
    // The same answer whether the email is unknown, the password is wrong or the account belongs to the other portal.
    throw new ApiError(401, "invalid_credentials", "That email or password is not right.");
  }
  attempts.delete(key);

  // Only after the password is proven do we say the account is switched off.
  if (row.status !== "active") {
    if (portal === "admin") throw new ApiError(403, "forbidden", "This account is disabled.");
    throw await accessDisabled();
  }
  if (portal === "villa") {
    const villa = await db.one<VillaAccessRow>("SELECT account_status, disabled_reason FROM villas WHERE id = ?", [row.villa_id]);
    // A villa whose card subscription ended may sign in, to pay again. Switched off by hand, it may not.
    if (!villa || (villa.account_status !== "active" && !lapsed(villa))) throw await accessDisabled();
  }

  await db.run("UPDATE users SET last_login_at = ? WHERE id = ?", [nowSql(), row.id]);
  await createSession(row.id, portal, remember);
  return toUser(row);
}
