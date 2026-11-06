import { createHash, randomBytes } from "node:crypto";
import type { SessionUser } from "./auth";
import { config, nowSql } from "./config";
import { db, transaction } from "./db";
import { queueOwnerEmails, verificationEmail } from "./emails";
import { ApiError } from "./http";
import { sendEmail } from "./mail";

/*
 * Email verification for villa owners who sign up themselves. Until they click
 * the link, every villa route answers 403 email_unverified (see requireVillaAdmin).
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// At most 5 emails an hour per account, so the button can't flood an inbox.
const sent = new Map<string, number[]>();
function allowed(userId: string) {
  const now = Date.now();
  const times = (sent.get(userId) ?? []).filter((t) => now - t < HOUR);
  if (times.length >= 5) return false;
  times.push(now);
  sent.set(userId, times);
  return true;
}

/** Sends a new link (any earlier link stops working). Returns an error message when it could not be sent. */
export async function sendVerification(user: { id: string; name: string; email: string; villaId: string | null }, origin: string): Promise<string | null> {
  if (!allowed(user.id)) return "We have sent several emails already. Please wait a while, then try again.";
  const token = randomBytes(32).toString("base64url");
  await db.run("DELETE FROM email_verifications WHERE user_id = ?", [user.id]);
  await db.run("INSERT INTO email_verifications (token_hash, user_id, email, expires_at, created_at) VALUES (?,?,?,?,?)", [sha256(token), user.id, user.email, nowSql(DAY), nowSql()]);
  const url = `${config.appUrl || origin}/verify-email?token=${encodeURIComponent(token)}`;
  const result = await sendEmail({ kind: "verify_email", to: user.email, villaId: user.villaId, build: verificationEmail(user.name, url) });
  return result.ok ? null : "We could not send the email right now. Please try again in a few minutes, or contact support.";
}

/** The link from the email. Works once, for the address it was sent to. */
export async function verifyEmail(token: string): Promise<{ email: string }> {
  const result = await transaction(async (tx) => {
    const row = await tx.one<{ user_id: string; email: string; villa_id: string | null; name: string; current: string; unverified: number }>(
      `SELECT v.user_id, v.email, u.villa_id, u.name, u.email AS current, u.email_unverified AS unverified
         FROM email_verifications v JOIN users u ON u.id = v.user_id
        WHERE v.token_hash = ? AND v.expires_at > ? FOR UPDATE`,
      [sha256(token), nowSql()],
    );
    if (!row || row.email !== row.current) throw new ApiError(400, "invalid_token", "This link has expired or is no longer valid. Sign in to get a new one.");
    await tx.run("UPDATE users SET email_unverified = 0, updated_at = ? WHERE id = ?", [nowSql(), row.user_id]);
    await tx.run("DELETE FROM email_verifications WHERE user_id = ?", [row.user_id]);
    if (row.unverified) {
      await tx.run("INSERT INTO activity_log (villa_id, action, detail, created_by, created_at) VALUES (?,?,?,?,?)", [row.villa_id, "email_verified", `${row.name} verified their email`, row.user_id, nowSql()]);
    }
    return row;
  });
  if (result.unverified && result.villa_id) queueOwnerEmails([{ kind: "welcome", villaId: result.villa_id, signedUp: true }]);
  return { email: result.email };
}

/** A sign-up that typed the wrong address can correct it, until it is verified. */
export async function changeUnverifiedEmail(user: SessionUser, nextEmail: string, origin: string) {
  if (user.emailVerified) throw new ApiError(400, "bad_request", "Your email is already verified.");
  if (nextEmail === user.email) return sendVerification(user, origin);
  const taken = await db.one("SELECT 1 FROM users WHERE email = ?", [nextEmail]);
  if (taken) throw new ApiError(409, "email_taken", "An account with this email already exists.");
  await db.run("UPDATE users SET email = ?, updated_at = ? WHERE id = ?", [nextEmail, nowSql(), user.id]);
  // The villa's contact email was filled in from the sign-up; keep it in step.
  if (user.villaId) await db.run("UPDATE villas SET email = ?, updated_at = ? WHERE id = ? AND email = ?", [nextEmail, nowSql(), user.villaId, user.email]);
  return sendVerification({ ...user, email: nextEmail }, origin);
}
