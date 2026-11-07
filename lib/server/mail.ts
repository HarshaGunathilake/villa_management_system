import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { config, nowSql, sqlToIso } from "./config";
import { db } from "./db";
import type { EmailKind, EmailLogEntry, MailSettings, SmtpSecurity } from "../admin-types";
import { ApiError } from "./http";

/*
 * Email: SMTP settings (kept in platform_settings, the password encrypted with
 * APP_SECRET), sending, a log of every attempt, and the platform's emails.
 *
 * Sending never throws into the caller's work: a failed email is logged and the
 * booking, payment or sign-up it belongs to still goes through.
 */

export type { EmailKind, EmailLogEntry, MailSettings, SmtpSecurity };

const KEYS = ["smtpHost", "smtpPort", "smtpSecurity", "smtpUser", "smtpPassword", "mailFromName", "mailFromEmail", "emailWelcome", "emailPaymentReceived", "emailPaymentFailed", "emailSubscriptionEnded", "platformName"];

/* ---------------------------------------------------------- secret storage */

function key() {
  if (config.appSecret.length < 16) return null;
  return createHash("sha256").update(config.appSecret).digest();
}

export function canStoreSecrets() {
  return key() !== null;
}

function encrypt(plain: string) {
  const k = key();
  if (!k) throw new ApiError(400, "no_app_secret", "Set APP_SECRET (a long random text) in the server settings first, so the SMTP password can be stored safely.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

function decrypt(stored: string) {
  const k = key();
  const [v, iv, tag, data] = stored.split(":");
  if (!k || v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null; // APP_SECRET changed since it was saved
  }
}

/* ---------------------------------------------------------------- settings */

async function rawSettings() {
  const rows = await db.query<{ name: string; value: string }>(`SELECT name, value FROM platform_settings WHERE name IN (${KEYS.map(() => "?").join(",")})`, KEYS);
  return new Map(rows.map((r) => [r.name, r.value]));
}

export async function loadMailSettings(): Promise<MailSettings> {
  const s = await rawSettings();
  const on = (name: string) => s.get(name) !== "false";
  const security = s.get("smtpSecurity");
  return {
    host: s.get("smtpHost") ?? "",
    port: Number(s.get("smtpPort")) || 587,
    security: security === "tls" || security === "none" ? security : "starttls",
    user: s.get("smtpUser") ?? "",
    hasPassword: Boolean(s.get("smtpPassword")),
    fromName: s.get("mailFromName") ?? "",
    fromEmail: s.get("mailFromEmail") ?? "",
    emails: { welcome: on("emailWelcome"), paymentReceived: on("emailPaymentReceived"), paymentFailed: on("emailPaymentFailed"), subscriptionEnded: on("emailSubscriptionEnded") },
  };
}

/** Saves what the Super Admin changed. A blank password keeps the saved one; `clearPassword` removes it. */
export async function saveMailSettings(p: Record<string, unknown>) {
  const next: Record<string, string> = {};
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  if (p.host !== undefined) next.smtpHost = str(p.host, 190);
  if (p.port !== undefined) {
    const port = Number(p.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ApiError(400, "bad_request", "The SMTP port must be a number between 1 and 65535.");
    next.smtpPort = String(port);
  }
  if (p.security !== undefined) {
    if (!["tls", "starttls", "none"].includes(String(p.security))) throw new ApiError(400, "bad_request", "Choose a valid connection security.");
    next.smtpSecurity = String(p.security);
  }
  if (p.user !== undefined) next.smtpUser = str(p.user, 190);
  if (p.fromName !== undefined) next.mailFromName = str(p.fromName, 120);
  if (p.fromEmail !== undefined) {
    const e = str(p.fromEmail, 190).toLowerCase();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ApiError(400, "bad_request", "Enter a valid sender email address.");
    next.mailFromEmail = e;
  }
  if (typeof p.password === "string" && p.password !== "") next.smtpPassword = encrypt(p.password);
  if (p.clearPassword === true) next.smtpPassword = "";
  const emails = (p.emails ?? {}) as Record<string, unknown>;
  for (const [field, name] of [["welcome", "emailWelcome"], ["paymentReceived", "emailPaymentReceived"], ["paymentFailed", "emailPaymentFailed"], ["subscriptionEnded", "emailSubscriptionEnded"]] as const) {
    if (emails[field] !== undefined) next[name] = emails[field] === true ? "true" : "false";
  }
  for (const [name, value] of Object.entries(next)) {
    await db.run("INSERT INTO platform_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [name, value]);
  }
}

/* ----------------------------------------------------------------- sending */

async function transport() {
  const s = await rawSettings();
  const host = s.get("smtpHost") ?? "";
  const fromEmail = s.get("mailFromEmail") || s.get("smtpUser") || "";
  if (!host || !fromEmail) return null;
  const password = s.get("smtpPassword") ? decrypt(s.get("smtpPassword")!) : "";
  if (password === null) throw new Error("The saved SMTP password can't be read: APP_SECRET is missing or has changed. Save the password again.");
  const security = s.get("smtpSecurity") ?? "starttls";
  return {
    from: { name: s.get("mailFromName") || s.get("platformName") || "LankaStay", address: fromEmail },
    platform: s.get("platformName") || "LankaStay",
    mailer: nodemailer.createTransport({
      host,
      port: Number(s.get("smtpPort")) || 587,
      secure: security === "tls",
      requireTLS: security === "starttls",
      ignoreTLS: security === "none",
      auth: s.get("smtpUser") ? { user: s.get("smtpUser")!, pass: password } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    }),
  };
}

export async function mailConfigured() {
  const s = await rawSettings();
  return Boolean(s.get("smtpHost") && (s.get("mailFromEmail") || s.get("smtpUser")));
}

async function log(kind: EmailKind, to: string, subject: string, status: "sent" | "failed" | "skipped", error: string | null, villaId: string | null) {
  await db
    .run("INSERT INTO email_log (kind, to_email, subject, status, error, villa_id, created_at) VALUES (?,?,?,?,?,?,?)", [kind, to, subject, status, error?.slice(0, 500) ?? null, villaId, nowSql()])
    .catch((e) => console.error("[mail] could not log", e));
}

/** Sends one email and logs it. Returns whether it was sent; never throws. */
export interface MailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export async function sendEmail(input: { kind: EmailKind; to: string; cc?: string; villaId?: string | null; replyTo?: string; attachments?: MailAttachment[]; build: (platform: string) => { subject: string; text: string; html: string } }): Promise<{ ok: boolean; error?: string }> {
  let subject: string = input.kind;
  const who = [input.to, input.cc].filter(Boolean).join(", ").slice(0, 190);
  try {
    subject = input.build("LankaStay").subject;
    const t = await transport();
    if (!t) {
      await log(input.kind, who, subject, "skipped", "Email is not set up (Super Admin → Settings → Email).", input.villaId ?? null);
      return { ok: false, error: "Email is not set up yet. Add the SMTP settings first." };
    }
    const mail = input.build(t.platform);
    subject = mail.subject;
    await t.mailer.sendMail({ from: t.from, to: input.to, cc: input.cc || undefined, replyTo: input.replyTo, subject: mail.subject, text: mail.text, html: mail.html, attachments: input.attachments });
    await log(input.kind, who, subject, "sent", null, input.villaId ?? null);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[mail]", input.kind, message);
    await log(input.kind, who, subject, "failed", message, input.villaId ?? null);
    return { ok: false, error: message };
  }
}

export async function recentEmails(limit = 100): Promise<EmailLogEntry[]> {
  const rows = await db.query<{ id: number; kind: EmailKind; to_email: string; subject: string; status: EmailLogEntry["status"]; error: string | null; villa_id: string | null; created_at: string }>(
    "SELECT * FROM email_log ORDER BY id DESC LIMIT ?",
    [limit],
  );
  return rows.map((r) => ({ id: Number(r.id), kind: r.kind, to: r.to_email, subject: r.subject, status: r.status, error: r.error, villaId: r.villa_id, createdAt: sqlToIso(r.created_at)! }));
}

/* --------------------------------------------------------------- templates */

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain, branded email that reads well in every mail app. */
export function layout(platform: string, o: { heading: string; paragraphs: string[]; button?: { label: string; url: string }; footnote?: string }) {
  const p = o.paragraphs.map((t) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3c4846">${esc(t)}</p>`).join("");
  const button = o.button
    ? `<p style="margin:24px 0"><a href="${esc(o.button.url)}" style="display:inline-block;background:#0b5d50;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:13px 22px;border-radius:10px">${esc(o.button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f3f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f4;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;color:#0e1a19;padding-bottom:24px">${esc(platform)}</td></tr>
<tr><td><h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0e1a19">${esc(o.heading)}</h1>${p}${button}
${o.footnote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#55615f">${esc(o.footnote)}</p>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [o.heading, "", ...o.paragraphs, ...(o.button ? ["", `${o.button.label}: ${o.button.url}`] : []), ...(o.footnote ? ["", o.footnote] : []), "", `— ${platform}`].join("\n");
  return { html, text };
}
