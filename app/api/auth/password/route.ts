import { requireVillaAdmin } from "@/lib/server/auth";
import { readJson, route } from "@/lib/server/http";
import { changeOwnPassword } from "@/lib/server/passwords";

/** A villa owner changes their own password. Allowed while payment is due too: it changes no villa data. */
export const POST = route(async (request) => {
  const { user } = await requireVillaAdmin({ allowLapsed: true });
  const body = await readJson(request);
  await changeOwnPassword(user, "villa", body.current, body.next);
  return { ok: true };
});
