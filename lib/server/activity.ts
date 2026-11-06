import type { ActivityEntry, ActivityType } from "../admin-types";
import { sqlToIso } from "./config";
import { db } from "./db";
import { isoDate } from "./http";

/* Super Admin → Activity: the full log, searched and filtered on the server. */

const TYPE_SQL: Record<ActivityType, string> = {
  villas: "a.action IN ('villa_created','villa_updated','villa_enabled','villa_disabled','villa_signed_up')",
  payments: "a.action LIKE 'dodo\\_%'",
  subscriptions: "a.action IN ('subscription_updated','price_changed')",
  logins: "(a.action LIKE 'admin\\_%' OR a.action LIKE 'password\\_%')",
  settings: "a.action = 'settings_updated'",
};

/** Turns a local date (YYYY-MM-DD, in the app's time zone) into the UTC instant it starts at. */
function startOfLocalDay(iso: string, timeZone: string) {
  const guess = new Date(`${iso}T00:00:00Z`);
  const local = new Date(guess.toLocaleString("en-US", { timeZone }));
  const offset = local.getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess.getTime() - offset).toISOString().slice(0, 19).replace("T", " ");
}

export async function searchActivity(params: URLSearchParams, timeZone: string): Promise<{ entries: ActivityEntry[]; more: boolean }> {
  const where: string[] = [];
  const args: (string | number)[] = [];

  const q = (params.get("q") ?? "").trim().slice(0, 100);
  if (q) {
    where.push("(a.detail LIKE ? OR u.name LIKE ? OR v.name LIKE ?)");
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    args.push(like, like, like);
  }
  const villa = params.get("villa");
  if (villa === "platform") where.push("a.villa_id IS NULL");
  else if (villa && villa !== "all") {
    where.push("a.villa_id = ?");
    args.push(villa.slice(0, 40));
  }
  const type = params.get("type") as ActivityType | null;
  if (type && TYPE_SQL[type]) where.push(TYPE_SQL[type]);
  const from = params.get("from");
  if (from) {
    where.push("a.created_at >= ?");
    args.push(startOfLocalDay(isoDate(from, "From"), timeZone));
  }
  const to = params.get("to");
  if (to) {
    const next = new Date(`${isoDate(to, "To")}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    where.push("a.created_at < ?");
    args.push(startOfLocalDay(next.toISOString().slice(0, 10), timeZone));
  }
  const before = Number(params.get("before"));
  if (Number.isInteger(before) && before > 0) {
    where.push("a.id < ?");
    args.push(before);
  }
  const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 5000);

  const rows = await db.query<{ id: number; villa_id: string | null; action: string; detail: string; by_name: string | null; created_at: string }>(
    `SELECT a.id, a.villa_id, a.action, a.detail, u.name AS by_name, a.created_at
       FROM activity_log a LEFT JOIN users u ON u.id = a.created_by LEFT JOIN villas v ON v.id = a.villa_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.id DESC LIMIT ?`,
    [...args, limit + 1],
  );
  return {
    more: rows.length > limit,
    entries: rows.slice(0, limit).map((a) => ({ id: Number(a.id), villaId: a.villa_id, action: a.action, detail: a.detail, by: a.by_name ?? (a.action.startsWith("dodo_") ? "Dodo Payments" : ""), createdAt: sqlToIso(a.created_at)! })),
  };
}
