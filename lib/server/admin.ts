import type { ActivityEntry, AdminData, AdminUser, AdminVilla, PlatformSettings, SubscriptionPayment } from "../admin-types";
import { bookingPhase, coversNight, guestCount, isActive } from "../availability";
import { addDays, fromISO, monthKey, toISO } from "../dates";
import { monthSummary } from "../finance";
import type { AppData, Booking, Expense, Room } from "../types";
import { endSessionsForUser, endSessionsForVilla, hashPassword, type SessionUser } from "./auth";
import { nowSql, serverToday, sqlToIso } from "./config";
import { db, transaction, type Db } from "./db";
import { ApiError, badRequest, email as cleanEmail, integer, isoDate, notFound, oneOf, password as cleanPassword, recordId, text } from "./http";
import { adminCancelSubscription, adminKeepSubscription, cancelForDisable, endFreeAccess, grantFreeAccess, isPaidByCard, repriceSubscription } from "./billing";
import { renameProducts } from "./dodo";
import { DEFAULT_SETTINGS } from "./seed";
import { later, queueOwnerEmails, testEmail } from "./emails";
import { loadMailSettings, saveMailSettings, sendEmail } from "./mail";
import { changeOwnPassword } from "./passwords";
import { loadBookings, loadRooms } from "./tenant";

/* Super Admin only. Routes call requireSuperAdmin() before anything in this file. */

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

/** Same day next month (31 Jan becomes 28/29 Feb). */
export function plusMonth(iso: string) {
  const d = fromISO(iso);
  const lastOfNext = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), lastOfNext)));
}

async function logActivity(q: Db, by: SessionUser, villaId: string | null, action: string, detail: string) {
  await q.run("INSERT INTO activity_log (villa_id, action, detail, created_by, created_at) VALUES (?,?,?,?,?)", [villaId, action, detail.slice(0, 255), by.id, nowSql()]);
}

export async function loadSettings(): Promise<PlatformSettings> {
  const rows = await db.query<{ name: string; value: string }>("SELECT name, value FROM platform_settings");
  const get = (name: keyof typeof DEFAULT_SETTINGS) => rows.find((r) => r.name === name)?.value ?? DEFAULT_SETTINGS[name];
  return {
    platformName: get("platformName"),
    supportEmail: get("supportEmail"),
    supportPhone: get("supportPhone"),
    defaultMonthlyAmount: Number(get("defaultMonthlyAmount")) || 0,
    trialDays: Math.max(0, Math.min(365, Math.round(Number(get("trialDays")) || 0))),
    signupsOpen: get("signupsOpen") !== "false",
    requireEmailVerification: get("requireEmailVerification") !== "false",
    searchIndexing: get("searchIndexing") !== "false",
    comingSoon: get("comingSoon") === "true",
    waitlistForm: get("waitlistForm") !== "false",
  };
}

/* ------------------------------------------------------------------ reading */

interface VillaRow {
  id: string; name: string; location: string; phone: string; email: string; address: string; description: string | null; plan: string;
  monthly_subscription_amount: number; subscription_status: AdminVilla["subscriptionStatus"]; account_status: AdminVilla["accountStatus"];
  subscription_start_date: string; next_payment_date: string; notes: string | null; created_at: string;
  disabled_reason: string | null; dodo_status: string | null; dodo_subscription_id: string | null; dodo_customer_id: string | null;
  trial_ends_on: string | null;
  free_until: string | null;
  cancel_at_period_end: number;
}

export async function loadAdminData(me: SessionUser): Promise<AdminData> {
  const today = serverToday();
  const [villaRows, userRows, paymentRows, activityRows, settings] = await Promise.all([
    db.query<VillaRow>("SELECT * FROM villas ORDER BY created_at DESC, name"),
    db.query<{ id: string; villa_id: string; name: string; email: string; phone: string; status: AdminUser["status"]; last_login_at: string | null; created_at: string; email_unverified: number }>(
      "SELECT id, villa_id, name, email, phone, status, last_login_at, created_at, email_unverified FROM users WHERE role = 'villa_admin' ORDER BY created_at",
    ),
    db.query<{ id: string; villa_id: string; amount: number; payment_date: string; period_start: string; period_end: string; status: string; note: string; by_name: string | null; created_at: string }>(
      `SELECT p.id, p.villa_id, p.amount, p.payment_date, p.period_start, p.period_end, p.status, p.note, u.name AS by_name, p.created_at
         FROM subscription_payments p LEFT JOIN users u ON u.id = p.created_by ORDER BY p.payment_date DESC, p.created_at DESC`,
    ),
    db.query<{ id: number; villa_id: string | null; action: string; detail: string; by_name: string | null; created_at: string }>(
      `SELECT a.id, a.villa_id, a.action, a.detail, u.name AS by_name, a.created_at
         FROM activity_log a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.created_at DESC, a.id DESC LIMIT 400`,
    ),
    loadSettings(),
  ]);

  const expenseRows = await db.query<{ villa_id: string; amount: number; date: string }>("SELECT villa_id, amount, date FROM expenses");
  // Villas that created their own account on the Register page (rather than being added here).
  const signedUp = new Set((await db.query<{ villa_id: string }>("SELECT DISTINCT villa_id FROM activity_log WHERE action = 'villa_signed_up'")).map((r) => r.villa_id));

  const villas: AdminVilla[] = [];
  for (const v of villaRows) {
    const [rooms, bookings] = [await loadRooms(db, v.id), await loadBookings(db, v.id)];
    villas.push({
      id: v.id,
      name: v.name,
      location: v.location,
      phone: v.phone,
      email: v.email,
      address: v.address,
      description: v.description ?? "",
      plan: v.plan,
      monthlyAmount: v.monthly_subscription_amount,
      subscriptionStatus: v.subscription_status,
      accountStatus: v.account_status,
      subscriptionStartDate: v.subscription_start_date,
      nextPaymentDate: v.next_payment_date,
      notes: v.notes ?? "",
      createdAt: sqlToIso(v.created_at)!,
      disabledReason: v.account_status === "disabled" ? (v.disabled_reason === "subscription" || v.disabled_reason === "unpaid" ? v.disabled_reason : "manual") : null,
      card: { status: v.dodo_status, subscriptionId: v.dodo_subscription_id, customerId: v.dodo_customer_id },
      trialEndsOn: v.trial_ends_on && v.trial_ends_on > today && v.dodo_status === "active" ? v.trial_ends_on : null,
      freeUntil: v.free_until,
      cancelAtPeriodEnd: !!v.cancel_at_period_end && !!v.dodo_status && ["active", "on_hold", "past_due", "paused"].includes(v.dodo_status),
      signedUp: signedUp.has(v.id),
      stats: villaStats(today, rooms, bookings, expenseRows.filter((e) => e.villa_id === v.id)),
    });
  }

  return {
    me: { id: me.id, name: me.name, email: me.email },
    today,
    settings,
    villas,
    admins: userRows.map((u) => ({ id: u.id, villaId: u.villa_id, name: u.name, email: u.email, phone: u.phone, status: u.status, lastLoginAt: sqlToIso(u.last_login_at), createdAt: sqlToIso(u.created_at)!, emailVerified: !u.email_unverified })),
    payments: paymentRows.map((p): SubscriptionPayment => ({
      id: p.id, villaId: p.villa_id, amount: p.amount, paymentDate: p.payment_date, periodStart: p.period_start, periodEnd: p.period_end, status: p.status, note: p.note,
      createdBy: p.by_name ?? (p.note === "Card payment" ? "Dodo Payments" : ""), createdAt: sqlToIso(p.created_at)!,
    })),
    activity: activityRows.map((a): ActivityEntry => ({ id: Number(a.id), villaId: a.villa_id, action: a.action, detail: a.detail, by: a.by_name ?? (a.action.startsWith("dodo_") ? "Dodo Payments" : ""), createdAt: sqlToIso(a.created_at)! })),
  };
}

function villaStats(today: string, rooms: Room[], bookings: Booking[], expenses: { amount: number; date: string }[]): AdminVilla["stats"] {
  const active = bookings.filter(isActive);
  const data = { rooms, bookings, expenses: expenses as unknown as Expense[] } as AppData;
  const month = monthSummary(data, monthKey(today));
  return {
    rooms: rooms.length,
    upcomingBookings: active.filter((b) => bookingPhase(b, today) === "upcoming").length,
    currentGuests: active.filter((b) => coversNight(b, today)).reduce((sum, b) => sum + guestCount(b), 0),
    monthRevenue: month.revenue,
    monthExpenses: month.expenses,
  };
}

/* ------------------------------------------------------------------ actions */

type Body = Record<string, unknown>;
const obj = (value: unknown, label: string): Body => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest(`${label} is missing.`);
  return value as Body;
};

async function villaOrThrow(q: Db, id: string) {
  const v = await q.one<VillaRow>("SELECT * FROM villas WHERE id = ?", [id]);
  if (!v) throw notFound("Villa");
  return v;
}

async function adminOrThrow(q: Db, id: string) {
  const u = await q.one<{ id: string; villa_id: string; name: string; email: string; phone: string; status: string }>(
    "SELECT id, villa_id, name, email, phone, status FROM users WHERE id = ? AND role = 'villa_admin'",
    [id],
  );
  if (!u) throw notFound("Admin");
  return u;
}

async function assertEmailFree(q: Db, emailAddress: string, exceptUserId?: string) {
  const taken = await q.one<{ id: string }>("SELECT id FROM users WHERE email = ?", [emailAddress]);
  if (taken && taken.id !== exceptUserId) throw new ApiError(409, "email_taken", "An account with this email already exists.");
}

export async function runAdminAction(me: SessionUser, body: Body): Promise<Record<string, unknown> | void> {
  const type = text(body.type, "Action", { min: 1, max: 40 });
  const now = nowSql();

  switch (type) {
    case "createVilla": {
      const v = obj(body.villa, "Villa");
      const s = obj(body.subscription, "Subscription");
      const a = obj(body.admin, "Admin");
      const name = text(v.name, "Villa name", { min: 2, max: 160 });
      const adminName = text(a.name, "Admin name", { min: 2, max: 120 });
      const adminEmail = cleanEmail(a.email, "Admin email");
      const adminPassword = cleanPassword(a.password);
      const start = isoDate(s.startDate, "Subscription start date");
      // A free trial: free access (no card) from the start date; the first payment is due the day after.
      const trialDays = s.trialDays === undefined || s.trialDays === null || s.trialDays === 0 ? 0 : integer(s.trialDays, "Free trial", { min: 1, max: 365 });
      const freeUntil = trialDays > 0 ? addDays(start, trialDays - 1) : null;
      const nextDue = freeUntil ? addDays(freeUntil, 1) : s.nextPaymentDate ? isoDate(s.nextPaymentDate, "Next payment date") : plusMonth(start);
      if (nextDue < start) throw badRequest("Next payment date cannot be before the start date.");
      const villaId = newId("v");
      const userId = newId("u");
      const activate = body.activate !== false;
      // Every villa pays the same price, set in Settings.
      const price = (await loadSettings()).defaultMonthlyAmount;

      await transaction(async (tx) => {
        await assertEmailFree(tx, adminEmail);
        await tx.run(
          `INSERT INTO villas (id, name, location, phone, email, address, description, plan, monthly_subscription_amount, subscription_status, account_status,
                               subscription_start_date, next_payment_date, created_at, updated_at, free_until)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            villaId, name, text(v.location, "Location", { max: 160, optional: true }), text(v.phone, "Phone", { max: 40, optional: true }),
            v.email ? cleanEmail(v.email, "Villa email") : "", text(v.address, "Address", { max: 255, optional: true }), text(v.description, "Description", { max: 2000, optional: true }) || null,
            text(s.plan, "Plan", { max: 40, optional: true }) || "Standard", price, "active", "active", start, nextDue, now, now, freeUntil,
          ],
        );
        await tx.run("INSERT INTO users (id, villa_id, name, email, phone, password_hash, role, status, created_at, updated_at, tour_pending) VALUES (?,?,?,?,?,?,?,?,?,?,1)", [
          userId, villaId, adminName, adminEmail, text(a.phone, "Admin phone", { max: 40, optional: true }), await hashPassword(adminPassword), "villa_admin", activate ? "active" : "disabled", now, now,
        ]);
        await logActivity(tx, me, villaId, "villa_created", `${name} created${trialDays > 0 ? ` with a ${trialDays}-day free trial, free until ${freeUntil}` : ""}`);
        await logActivity(tx, me, villaId, "admin_created", `Admin account created for ${adminName}${activate ? "" : " (not activated yet)"}`);
      });
      if (activate) queueOwnerEmails([{ kind: "welcome", villaId, signedUp: false }]);
      return { villaId };
    }

    case "updateVilla": {
      const id = recordId(body.id, "Villa");
      const current = await villaOrThrow(db, id);
      const p = obj(body.patch, "Changes");
      const pick = <T,>(value: unknown, fallback: T) => (value === undefined ? fallback : value);
      const start = isoDate(pick(p.subscriptionStartDate, current.subscription_start_date), "Subscription start date");
      // The price is the same for every villa and only changes in Settings.
      const amount = current.monthly_subscription_amount;
      const nextDue = isoDate(pick(p.nextPaymentDate, current.next_payment_date), "Next payment date");
      // A villa paying by card: Dodo sets the next payment date.
      if ((await isPaidByCard(id)) && nextDue !== current.next_payment_date) {
        throw new ApiError(409, "paid_by_card", "This villa pays by card, so Dodo sets the next payment date.");
      }
      await db.run(
        `UPDATE villas SET name=?, location=?, phone=?, email=?, address=?, description=?, plan=?, monthly_subscription_amount=?, subscription_start_date=?, next_payment_date=?, notes=?, updated_at=? WHERE id = ?`,
        [
          text(pick(p.name, current.name), "Villa name", { min: 2, max: 160 }),
          text(pick(p.location, current.location), "Location", { max: 160, optional: true }),
          text(pick(p.phone, current.phone), "Phone", { max: 40, optional: true }),
          pick(p.email, current.email) ? cleanEmail(pick(p.email, current.email), "Villa email") : "",
          text(pick(p.address, current.address), "Address", { max: 255, optional: true }),
          text(pick(p.description, current.description ?? ""), "Description", { max: 2000, optional: true }) || null,
          text(pick(p.plan, current.plan), "Plan", { max: 40, optional: true }) || "Standard",
          amount,
          start,
          nextDue,
          text(pick(p.notes, current.notes ?? ""), "Notes", { max: 2000, optional: true }) || null,
          now,
          id,
        ],
      );
      const subscriptionChanged = ["plan", "subscriptionStartDate", "nextPaymentDate"].some((k) => p[k] !== undefined);
      await logActivity(db, me, id, subscriptionChanged ? "subscription_updated" : "villa_updated", subscriptionChanged ? `Subscription details updated for ${current.name}` : `${current.name} details updated`);
      return;
    }

    case "setVillaAccess": {
      const id = recordId(body.id, "Villa");
      const status = oneOf(body.status, ["active", "disabled"] as const, "Status");
      const v = await villaOrThrow(db, id);
      // Off by hand: stop the card first, so a failed cancel leaves nothing half done.
      const cancelled = status === "disabled" ? await cancelForDisable(id) : false;
      // Back on: a villa that paid by card but has no live subscription any more has to pay again first.
      const freeNow = !!v.free_until && v.free_until >= serverToday();
      const mustPay = status === "active" && !!v.dodo_customer_id && !freeNow && !(await isPaidByCard(id));
      await db.run("UPDATE villas SET account_status = ?, disabled_reason = ?, updated_at = ? WHERE id = ?", [
        mustPay ? "disabled" : status, status === "disabled" ? "manual" : mustPay ? "subscription" : null, now, id,
      ]);
      // Switching a villa off signs its admins out straight away.
      if (status === "disabled") await endSessionsForVilla(id);
      const detail = status === "disabled"
        ? `${v.name} access disabled${cancelled ? ", card subscription cancelled" : ""}`
        : `${v.name} access enabled${mustPay ? ", waiting for a new card payment" : ""}`;
      await logActivity(db, me, id, status === "disabled" ? "villa_disabled" : "villa_enabled", detail);
      return;
    }

    case "setSubscriptionStatus": {
      const id = recordId(body.id, "Villa");
      const status = oneOf(body.status, ["active", "payment_due", "overdue"] as const, "Status");
      const v = await villaOrThrow(db, id);
      await db.run("UPDATE villas SET subscription_status = ?, updated_at = ? WHERE id = ?", [status, now, id]);
      await logActivity(db, me, id, "subscription_updated", `${v.name} subscription marked as ${status.replace("_", " ")}`);
      return;
    }

    case "cancelSubscription": {
      const id = recordId(body.id, "Villa");
      const when = oneOf(body.when, ["period_end", "now"] as const, "When");
      await villaOrThrow(db, id);
      const detail = await adminCancelSubscription(id, when);
      await logActivity(db, me, id, "subscription_updated", detail);
      return;
    }

    case "keepSubscription": {
      const id = recordId(body.id, "Villa");
      await villaOrThrow(db, id);
      await logActivity(db, me, id, "subscription_updated", await adminKeepSubscription(id));
      return;
    }

    case "giveFreeAccess": {
      const id = recordId(body.id, "Villa");
      const until = isoDate(body.until, "Free until");
      await villaOrThrow(db, id);
      await logActivity(db, me, id, "subscription_updated", await grantFreeAccess(id, until));
      return;
    }

    case "endFreeAccess": {
      const id = recordId(body.id, "Villa");
      await villaOrThrow(db, id);
      const detail = await endFreeAccess(id, "ended");
      if (!detail) throw badRequest("This villa has no free access to end.");
      await logActivity(db, me, id, "subscription_updated", detail);
      return;
    }

    case "createAdmin": {
      const villaId = recordId(body.villaId, "Villa");
      const v = await villaOrThrow(db, villaId);
      const name = text(body.name, "Admin name", { min: 2, max: 120 });
      const adminEmail = cleanEmail(body.email, "Admin email");
      await assertEmailFree(db, adminEmail);
      await db.run("INSERT INTO users (id, villa_id, name, email, phone, password_hash, role, status, created_at, updated_at, tour_pending) VALUES (?,?,?,?,?,?,?,?,?,?,1)", [
        newId("u"), villaId, name, adminEmail, text(body.phone, "Phone", { max: 40, optional: true }), await hashPassword(cleanPassword(body.password)), "villa_admin", "active", now, now,
      ]);
      await logActivity(db, me, villaId, "admin_created", `Admin account created for ${name} at ${v.name}`);
      return;
    }

    case "markEmailVerified": {
      const id = recordId(body.id, "Admin");
      const u = await adminOrThrow(db, id);
      await db.run("UPDATE users SET email_unverified = 0, updated_at = ? WHERE id = ?", [now, id]);
      await db.run("DELETE FROM email_verifications WHERE user_id = ?", [id]);
      await logActivity(db, me, u.villa_id, "admin_updated", `Email of ${u.name} marked as verified`);
      return;
    }

    case "setAdminStatus": {
      const id = recordId(body.id, "Admin");
      const status = oneOf(body.status, ["active", "disabled"] as const, "Status");
      const u = await adminOrThrow(db, id);
      await db.run("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", [status, now, id]);
      if (status === "disabled") await endSessionsForUser(id);
      await logActivity(db, me, u.villa_id, status === "disabled" ? "admin_disabled" : "admin_enabled", `Admin ${u.name} ${status === "disabled" ? "disabled" : "enabled"}`);
      return;
    }

    case "updateSettings": {
      const p = obj(body.patch, "Settings");
      const next: Record<string, string> = {};
      if (p.platformName !== undefined) next.platformName = text(p.platformName, "Platform name", { min: 2, max: 80 });
      if (p.supportEmail !== undefined) next.supportEmail = p.supportEmail ? cleanEmail(p.supportEmail, "Support email") : "";
      if (p.supportPhone !== undefined) next.supportPhone = text(p.supportPhone, "Support phone", { max: 40, optional: true });
      if (p.defaultMonthlyAmount !== undefined) {
        const price = integer(p.defaultMonthlyAmount, "Subscription price");
        if (price < 1) throw badRequest("The subscription price must be at least LKR 1.");
        next.defaultMonthlyAmount = String(price);
      }
      if (p.trialDays !== undefined) {
        const days = integer(p.trialDays, "Free trial");
        if (days < 0 || days > 365) throw badRequest("The free trial must be between 0 and 365 days.");
        next.trialDays = String(days);
      }
      if (p.signupsOpen !== undefined) next.signupsOpen = p.signupsOpen === true ? "true" : "false";
      if (p.requireEmailVerification !== undefined) next.requireEmailVerification = p.requireEmailVerification === true ? "true" : "false";
      if (p.searchIndexing !== undefined) next.searchIndexing = p.searchIndexing === true ? "true" : "false";
      if (p.comingSoon !== undefined) next.comingSoon = p.comingSoon === true ? "true" : "false";
      if (p.waitlistForm !== undefined) next.waitlistForm = p.waitlistForm === true ? "true" : "false";
      const before = await loadSettings();
      for (const [name, value] of Object.entries(next)) {
        await db.run("INSERT INTO platform_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [name, value]);
      }
      await logActivity(db, me, null, "settings_updated", "Platform settings updated");
      if (next.trialDays !== undefined && Number(next.trialDays) !== before.trialDays) {
        const days = Number(next.trialDays);
        await logActivity(db, me, null, "trial_changed", days > 0 ? `Free trial for new sign-ups set to ${days} days` : "Free trial for new sign-ups switched off");
      }
      // The Dodo checkout shows the platform name in the product; keep it in step.
      if (next.platformName && next.platformName !== before.platformName) {
        const platformName = next.platformName;
        later(() => renameProducts(platformName));
      }

      // One price for every villa: a new price moves them all. Card subscriptions change from their next payment.
      const price = next.defaultMonthlyAmount ? Number(next.defaultMonthlyAmount) : null;
      if (price === null) return;
      const villas = await db.query<{ id: string; monthly_subscription_amount: number }>("SELECT id, monthly_subscription_amount FROM villas");
      let cardFailures = 0;
      for (const v of villas) {
        if (v.monthly_subscription_amount === price) continue;
        try {
          await repriceSubscription(v.id, price);
        } catch (error) {
          cardFailures += 1;
          console.error("[settings] could not move card subscription to the new price", v.id, error);
          continue; // keep the old amount, so it matches what Dodo charges; saving again retries it
        }
        await db.run("UPDATE villas SET monthly_subscription_amount = ?, updated_at = ? WHERE id = ?", [price, nowSql(), v.id]);
      }
      if (price !== before.defaultMonthlyAmount) {
        await logActivity(db, me, null, "price_changed", `Subscription price changed to LKR ${price.toLocaleString("en-US")} for every villa`);
      }
      if (cardFailures > 0) {
        throw new ApiError(502, "payments_error", `Saved. ${cardFailures} card subscription(s) could not be moved to the new price yet. Save again to retry.`);
      }
      return;
    }

    case "changePassword": {
      await changeOwnPassword(me, "admin", body.current, body.next);
      return;
    }

    case "saveMail": {
      await saveMailSettings(obj(body.mail, "Email settings"));
      await logActivity(db, me, null, "settings_updated", "Email settings updated");
      return { mail: await loadMailSettings() };
    }

    case "sendTestEmail": {
      const to = cleanEmail(body.to, "Send to");
      const result = await sendEmail({ kind: "test", to, build: testEmail() });
      if (!result.ok) throw new ApiError(502, "email_failed", `The test email could not be sent: ${result.error}`);
      return;
    }

    default:
      throw badRequest("Unknown action.");
  }
}
