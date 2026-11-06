import { supportContact } from "@/lib/server/auth";
import { route } from "@/lib/server/http";
import { signupInfo } from "@/lib/server/signup";

/** Public: the platform's name and support contact, and whether new villas can sign up and for how much. */
export const GET = route(async () => ({ ok: true, ...(await supportContact()), signup: await signupInfo() }));
