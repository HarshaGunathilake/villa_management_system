import { createHash, randomBytes } from "node:crypto";
import { createSession, endSessionsForUser, hashPassword, verifyPassword, type Portal, type SessionUser } from "./auth";
import { config, nowSql } from "./config";
import { db, transaction } from "./db";
import { later, passwordResetEmail } from "./emails";
import { ApiError, password as cleanPassword } from "./http";
import { sendEmail } from "./mail";

/*
 * Forgotten passwords (a one-time link by email) and changing a password
 * while signed in. Works the same for villa owners and the Super Admin.
 */

const HOUR = 3_600_000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// Per IP and per email, so the form can't be used to flood someone's inbox.
const recent = new Map<string, number[]>();
function allowed(key: string, max: number) {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((t) => now - t < HOUR);
  if (times.length >= max) return false;
  times.push(now);
  recent.set(key, times);
  return true;
}

/**
 * Sends a reset link if the email belongs to an active account for this portal.
 * The answer is the same either way, so the form never reveals who has an account.
 */
export async function requestPasswordReset(portal: Portal, emailAddress: string, origin: string, ip: string) {
  if (!allowed(`ip:${ip}`, 10)) throw new ApiError(429, "too_many_attempts", "Too many requests from here. Please try again later.");
  if (!allowed(`email:${emailAddress}`, 3)) return; // quietly: the link already went out

  const role = portal === "admin" ? "super_admin" : "villa_admin";
  const user = await db.one<{ id: string; name: string; email: string }>("SELECT id, name, email FROM users WHERE email = ? AND role = ? AND status = 'active'", [emailAddress, role]);
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  // A new link replaces any earlier one.
  await db.run("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
  await db.run("INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)", [sha256(token), user.id, nowSql(HOUR), nowSql()]);

  const base = config.appUrl || origin;
  const url = `${base}/reset-password?token=${encodeURIComponent(token)}${portal === "admin" ? "&portal=admin" : ""}`;
  // After the response, so how long sending takes doesn't give away whether the account exists.
  later(() => sendEmail({ kind: "password_reset", to: user.email, build: passwordResetEmail(user.name, url) }));
}

/** Whether a reset link is still good, for the page to show the form or an expired message. */
export async function checkResetToken(token: string) {
  const row = await db.one("SELECT 1 FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?", [sha256(token), nowSql()]);
  return Boolean(row);
}

/** Sets the new password from a reset link. The link then stops working and every session is signed out. */
export async function resetPassword(token: string, nextPassword: unknown): Promise<{ portal: Portal }> {
  const plain = cleanPassword(nextPassword, "New password");
  const hash = await hashPassword(plain);
  return transaction(async (tx) => {
    const row = await tx.one<{ user_id: string; role: string }>(
      "SELECT r.user_id, u.role FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ? FOR UPDATE",
      [sha256(token), nowSql()],
    );
    if (!row) throw new ApiError(400, "invalid_token", "This reset link has expired or was already used. Ask for a new one.");
    const now = nowSql();
    // The link went to this address, so it is verified too.
    await tx.run("UPDATE users SET password_hash = ?, email_unverified = 0, updated_at = ? WHERE id = ?", [hash, now, row.user_id]);
    await tx.run("DELETE FROM email_verifications WHERE user_id = ?", [row.user_id]);
    await tx.run("DELETE FROM password_resets WHERE user_id = ?", [row.user_id]);
    await tx.run("DELETE FROM sessions WHERE user_id = ?", [row.user_id]);
    await tx.run("INSERT INTO activity_log (villa_id, action, detail, created_by, created_at) SELECT villa_id, 'password_reset_by_email', CONCAT(name, ' reset their password by email'), id, ? FROM users WHERE id = ?", [now, row.user_id]);
    return { portal: row.role === "super_admin" ? "admin" : "villa" };
  });
}

/** Change a password while signed in. Other devices are signed out; this one stays signed in. */
export async function changeOwnPassword(user: SessionUser, portal: Portal, current: unknown, next: unknown) {
  const row = await db.one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [user.id]);
  if (!row || !(await verifyPassword(String(current ?? ""), row.password_hash))) throw new ApiError(400, "wrong_password", "The current password is not right.");
  const plain = cleanPassword(next, "New password");
  if (plain === current) throw new ApiError(400, "bad_request", "The new password must be different from the current one.");
  const now = nowSql();
  await db.run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [await hashPassword(plain), now, user.id]);
  await db.run("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
  await endSessionsForUser(user.id);
  await createSession(user.id, portal, true);
  await db.run("INSERT INTO activity_log (villa_id, action, detail, created_by, created_at) VALUES (?,?,?,?,?)", [user.villaId, "password_changed", `${user.name} changed their password`, user.id, now]);
}
