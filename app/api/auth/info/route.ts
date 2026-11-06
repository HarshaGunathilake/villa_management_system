import { supportContact } from "@/lib/server/auth";
import { route } from "@/lib/server/http";

/** Public: the platform's name and support contact, shown on the sign-in screens. */
export const GET = route(async () => ({ ok: true, ...(await supportContact()) }));
