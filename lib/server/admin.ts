import type { ActivityEntry, AdminData, AdminUser, AdminVilla, PlatformSettings, SubscriptionPayment } from "../admin-types";
import { bookingPhase, coversNight, guestCount, isActive } from "../availability";
import { fromISO, monthKey, toISO } from "../dates";
import { monthSummary } from "../finance";
import type { AppData, Booking, Expense, Room } from "../types";
import { endSessionsForUser, endSessionsForVilla, hashPassword, verifyPassword, type SessionUser } from "./auth";
import { nowSql, serverToday, sqlToIso } from "./config";
import { db, transaction, type Db } from "./db";
import { ApiError, badRequest, email as cleanEmail, integer, isoDate, notFound, oneOf, password as cleanPassword, recordId, text } from "./http";
import { isPaidByCard, repriceSubscription } from "./billing";
import { DEFAULT_SETTINGS } from "./seed";
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
  };
}

/* ------------------------------------------------------------------ reading */

interface VillaRow {
  id: string; name: string; location: string; phone: string; email: string; address: string; description: string | null; plan: string;
  monthly_subscription_amount: number; subscription_status: AdminVilla["subscriptionStatus"]; account_status: AdminVilla["accountStatus"];
  subscription_start_date: string; next_payment_date: string; notes: string | null; created_at: string;
  disabled_reason: string | null; dodo_status: string | null; dodo_subscription_id: string | null; dodo_customer_id: string | null;
}

export async function loadAdminData(me: SessionUser): Promise<AdminData> {
  const today = serverToday();
  const [villaRows, userRows, paymentRows, activityRows, settings] = await Promise.all([
    db.query<VillaRow>("SELECT * FROM villas ORDER BY created_at DESC, name"),
    db.query<{ id: string; villa_id: string; name: string; email: string; phone: string; status: AdminUser["status"]; last_login_at: string | null; created_at: string }>(
      "SELECT id, villa_id, name, email, phone, status, last_login_at, created_at FROM users WHERE role = 'villa_admin' ORDER BY created_at",
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
      disabledReason: v.account_status === "disabled" ? (v.disabled_reason === "subscription" ? "subscription" : "manual") : null,
      card: { status: v.dodo_status, subscriptionId: v.dodo_subscription_id, customerId: v.dodo_customer_id },
      stats: villaStats(today, rooms, bookings, expenseRows.filter((e) => e.villa_id === v.id)),
    });
  }

  return {
    me: { id: me.id, name: me.name, email: me.email },
    today,
    settings,
    villas,
    admins: userRows.map((u) => ({ id: u.id, villaId: u.villa_id, name: u.name, email: u.email, phone: u.phone, status: u.status, lastLoginAt: sqlToIso(u.last_login_at), createdAt: sqlToIso(u.created_at)! })),
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
      const nextDue = s.nextPaymentDate ? isoDate(s.nextPaymentDate, "Next payment date") : plusMonth(start);
      if (nextDue < start) throw badRequest("Next payment date cannot be before the start date.");
      const villaId = newId("v");
      const userId = newId("u");
      const activate = body.activate !== false;

      await transaction(async (tx) => {
        await assertEmailFree(tx, adminEmail);
        await tx.run(
          `INSERT INTO villas (id, name, location, phone, email, address, description, plan, monthly_subscription_amount, subscription_status, account_status,
                               subscription_start_date, next_payment_date, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            villaId, name, text(v.location, "Location", { max: 160, optional: true }), text(v.phone, "Phone", { max: 40, optional: true }),
            v.email ? cleanEmail(v.email, "Villa email") : "", text(v.address, "Address", { max: 255, optional: true }), text(v.description, "Description", { max: 2000, optional: true }) || null,
            text(s.plan, "Plan", { max: 40, optional: true }) || "Standard", integer(s.monthlyAmount, "Monthly amount"), "active", "active", start, nextDue, now, now,
          ],
        );
        await tx.run("INSERT INTO users (id, villa_id, name, email, phone, password_hash, role, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
          userId, villaId, adminName, adminEmail, text(a.phone, "Admin phone", { max: 40, optional: true }), await hashPassword(adminPassword), "villa_admin", activate ? "active" : "disabled", now, now,
        ]);
        await logActivity(tx, me, villaId, "villa_created", `${name} created`);
        await logActivity(tx, me, villaId, "admin_created", `Admin account created for ${adminName}${activate ? "" : " (not activated yet)"}`);
      });
      return { villaId };
    }

    case "updateVilla": {
      const id = recordId(body.id, "Villa");
      const current = await villaOrThrow(db, id);
      const p = obj(body.patch, "Changes");
      const pick = <T,>(value: unknown, fallback: T) => (value === undefined ? fallback : value);
      const start = isoDate(pick(p.subscriptionStartDate, current.subscription_start_date), "Subscription start date");
      const amount = integer(pick(p.monthlyAmount, current.monthly_subscription_amount), "Monthly amount");
      const nextDue = isoDate(pick(p.nextPaymentDate, current.next_payment_date), "Next payment date");
      // A villa paying by card: Dodo sets the next payment date, and a new amount moves the card subscription to the new price.
      if (await isPaidByCard(id)) {
        if (nextDue !== current.next_payment_date) throw new ApiError(409, "paid_by_card", "This villa pays by card, so Dodo sets the next payment date.");
        if (amount !== current.monthly_subscription_amount) {
          if (amount < 1) throw badRequest("A villa paying by card needs a monthly amount.");
          await repriceSubscription(id, amount);
        }
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
      const subscriptionChanged = ["plan", "monthlyAmount", "subscriptionStartDate", "nextPaymentDate"].some((k) => p[k] !== undefined);
      await logActivity(db, me, id, subscriptionChanged ? "subscription_updated" : "villa_updated", subscriptionChanged ? `Subscription details updated for ${current.name}` : `${current.name} details updated`);
      return;
    }

    case "setVillaAccess": {
      const id = recordId(body.id, "Villa");
      const status = oneOf(body.status, ["active", "disabled"] as const, "Status");
      const v = await villaOrThrow(db, id);
      await db.run("UPDATE villas SET account_status = ?, disabled_reason = ?, updated_at = ? WHERE id = ?", [status, status === "disabled" ? "manual" : null, now, id]);
      // Switching a villa off signs its admins out straight away.
      if (status === "disabled") await endSessionsForVilla(id);
      await logActivity(db, me, id, status === "disabled" ? "villa_disabled" : "villa_enabled", `${v.name} access ${status === "disabled" ? "disabled" : "enabled"}`);
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

    case "createAdmin": {
      const villaId = recordId(body.villaId, "Villa");
      const v = await villaOrThrow(db, villaId);
      const name = text(body.name, "Admin name", { min: 2, max: 120 });
      const adminEmail = cleanEmail(body.email, "Admin email");
      await assertEmailFree(db, adminEmail);
      await db.run("INSERT INTO users (id, villa_id, name, email, phone, password_hash, role, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
        newId("u"), villaId, name, adminEmail, text(body.phone, "Phone", { max: 40, optional: true }), await hashPassword(cleanPassword(body.password)), "villa_admin", "active", now, now,
      ]);
      await logActivity(db, me, villaId, "admin_created", `Admin account created for ${name} at ${v.name}`);
      return;
    }

    case "updateAdmin": {
      const id = recordId(body.id, "Admin");
      const u = await adminOrThrow(db, id);
      const adminEmail = cleanEmail(body.email ?? u.email, "Admin email");
      await assertEmailFree(db, adminEmail, id);
      const name = text(body.name ?? u.name, "Admin name", { min: 2, max: 120 });
      await db.run("UPDATE users SET name=?, email=?, phone=?, updated_at=? WHERE id = ?", [name, adminEmail, text(body.phone ?? u.phone, "Phone", { max: 40, optional: true }), now, id]);
      await logActivity(db, me, u.villa_id, "admin_updated", `Admin ${name} updated`);
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

    case "resetPassword": {
      const id = recordId(body.id, "Admin");
      const u = await adminOrThrow(db, id);
      await db.run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [await hashPassword(cleanPassword(body.password)), now, id]);
      await endSessionsForUser(id);
      await logActivity(db, me, u.villa_id, "admin_password_reset", `Password reset for ${u.name}`);
      return;
    }

    case "updateSettings": {
      const p = obj(body.patch, "Settings");
      const next: Record<string, string> = {};
      if (p.platformName !== undefined) next.platformName = text(p.platformName, "Platform name", { min: 2, max: 80 });
      if (p.supportEmail !== undefined) next.supportEmail = p.supportEmail ? cleanEmail(p.supportEmail, "Support email") : "";
      if (p.supportPhone !== undefined) next.supportPhone = text(p.supportPhone, "Support phone", { max: 40, optional: true });
      if (p.defaultMonthlyAmount !== undefined) next.defaultMonthlyAmount = String(integer(p.defaultMonthlyAmount, "Default monthly amount"));
      for (const [name, value] of Object.entries(next)) {
        await db.run("INSERT INTO platform_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [name, value]);
      }
      await logActivity(db, me, null, "settings_updated", "Platform settings updated");
      return;
    }

    case "changePassword": {
      const row = await db.one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [me.id]);
      if (!row || !(await verifyPassword(String(body.current ?? ""), row.password_hash))) throw new ApiError(400, "wrong_password", "The current password is not right.");
      await db.run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [await hashPassword(cleanPassword(body.next, "New password")), now, me.id]);
      await logActivity(db, me, null, "settings_updated", "Super Admin password changed");
      return;
    }

    default:
      throw badRequest("Unknown action.");
  }
}
