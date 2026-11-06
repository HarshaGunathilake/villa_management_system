import { requireVillaAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { route } from "@/lib/server/http";

/** The first-time guide was finished or skipped: don't show it again, on any device. */
export const POST = route(async () => {
  const { user } = await requireVillaAdmin({ allowLapsed: true });
  await db.run("UPDATE users SET tour_pending = 0 WHERE id = ?", [user.id]);
  return { ok: true };
});
