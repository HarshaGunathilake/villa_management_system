import { readJson, route } from "@/lib/server/http";
import { register } from "@/lib/server/signup";

/** Public: create a villa account. It stays locked until the first card payment goes through. */
export const POST = route(async (request) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  await register(await readJson(request), ip, new URL(request.url).origin);
  return { ok: true };
});
