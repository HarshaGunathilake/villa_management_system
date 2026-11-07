import { cookies } from "next/headers";
import { requireSuperAdmin, supportContact } from "./auth";
import { db } from "./db";
import { signupInfo } from "./signup";

/*
 * The public website is a separate project on its own domain (lankastay.com).
 * It reads what it shows from here, through GET /api/public/site: the name,
 * price, contact details, whether sign-ups are open, and the Website switches
 * in Super Admin → Settings.
 */
export async function publicSite() {
  const [support, signup, flags] = await Promise.all([supportContact(), signupInfo(), websiteFlags()]);
  return {
    name: support.platformName || "LankaStay",
    email: support.email,
    phone: support.phone,
    signup,
    comingSoon: flags.comingSoon,
    waitlistForm: flags.waitlistForm,
    /** Search engines may index the website: switched on, and not "coming soon" */
    indexable: flags.searchIndexing && !flags.comingSoon,
  };
}

/** Super Admin → Settings → Website: search engine indexing and the Coming soon page. */
export async function websiteFlags() {
  const rows = await db.query<{ name: string; value: string }>("SELECT name, value FROM platform_settings WHERE name IN ('searchIndexing','comingSoon','waitlistForm')");
  const get = (name: string) => rows.find((r) => r.name === name)?.value;
  return { searchIndexing: get("searchIndexing") !== "false", comingSoon: get("comingSoon") === "true", waitlistForm: get("waitlistForm") !== "false" };
}

/** Sign-ups wait for launch while the website is "coming soon"; a signed-in Super Admin can still try them. */
export async function signupsHeldBack() {
  const flags = await websiteFlags();
  if (!flags.comingSoon) return false;
  const jar = await cookies();
  if (!jar.has("vms_admin")) return true;
  return requireSuperAdmin().then(() => false, () => true);
}
