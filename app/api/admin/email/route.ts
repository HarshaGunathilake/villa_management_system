import { requireSuperAdmin } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { route } from "@/lib/server/http";
import { canStoreSecrets, loadMailSettings, recentEmails } from "@/lib/server/mail";

/** Email settings and the latest emails sent, for Super Admin → Settings. */
export const GET = route(async () => {
  await requireSuperAdmin();
  return { ok: true, mail: await loadMailSettings(), log: await recentEmails(50), canStoreSecrets: canStoreSecrets(), appUrlSet: Boolean(config.appUrl) };
});
