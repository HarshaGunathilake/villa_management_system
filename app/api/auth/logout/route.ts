import { destroySession, type Portal } from "@/lib/server/auth";
import { readJson, route } from "@/lib/server/http";

export const POST = route(async (request) => {
  const body = await readJson(request);
  const portal: Portal = body.portal === "admin" ? "admin" : "villa";
  await destroySession(portal);
  return { ok: true };
});
