import { requireSuperAdmin } from "@/lib/server/auth";
import { sqlToIso } from "@/lib/server/config";
import { db } from "@/lib/server/db";
import { route } from "@/lib/server/http";

/** Who asked to hear when the site opens, newest first. */
export const GET = route(async () => {
  await requireSuperAdmin();
  const rows = await db.query<{ email: string; created_at: string }>("SELECT email, created_at FROM waitlist ORDER BY created_at DESC");
  return { ok: true, waitlist: rows.map((r) => ({ email: r.email, createdAt: sqlToIso(r.created_at)! })) };
});
