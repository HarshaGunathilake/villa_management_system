import { login, type Portal } from "@/lib/server/auth";
import { email, readJson, route } from "@/lib/server/http";

/** Sign in. `portal` chooses the door: "villa" for villa admins, "admin" for the Super Admin. */
export const POST = route(async (request) => {
  const body = await readJson(request);
  const portal: Portal = body.portal === "admin" ? "admin" : "villa";
  const user = await login(portal, email(body.email), String(body.password ?? ""), body.remember !== false);
  return { ok: true, user: { name: user.name, email: user.email, role: user.role } };
});
