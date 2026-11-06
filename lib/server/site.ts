import { cookies } from "next/headers";
import { requireSuperAdmin, supportContact } from "./auth";
import { db, ensureReady } from "./db";
import { signupInfo } from "./signup";

/*
 * What the public website pages show from Super Admin → Settings: the name,
 * price, contact details and whether sign-ups are open.
 */
export async function loadSite() {
  const jar = await cookies();
  const signedIn = jar.has("vms_session");
  try {
    await ensureReady();
    const [support, signup, flags] = await Promise.all([supportContact(), signupInfo(), websiteFlags()]);
    // A signed-in Super Admin sees the real pages while "coming soon" is on, to check them before launch.
    const adminPreview = flags.comingSoon && jar.has("vms_admin") ? await requireSuperAdmin().then(() => true, () => false) : false;
    return {
      name: support.platformName || "LankaStay",
      email: support.email,
      phone: support.phone,
      signup,
      signedIn,
      comingSoon: flags.comingSoon,
      waitlistForm: flags.waitlistForm,
      adminPreview,
      /** Search engines may index the pages: switched on, and not "coming soon" */
      indexable: flags.searchIndexing && !flags.comingSoon,
    };
  } catch (error) {
    // The pages still show (without a price) if the database is briefly unavailable.
    console.error("[site]", error);
    return { name: "LankaStay", email: "", phone: "", signup: { open: false, monthlyAmount: 0 }, signedIn, comingSoon: false, waitlistForm: false, adminPreview: false, indexable: false };
  }
}

/** Super Admin → Settings → Website: search engine indexing and the Coming soon page. */
export async function websiteFlags() {
  const rows = await db.query<{ name: string; value: string }>("SELECT name, value FROM platform_settings WHERE name IN ('searchIndexing','comingSoon','waitlistForm')");
  const get = (name: string) => rows.find((r) => r.name === name)?.value;
  return { searchIndexing: get("searchIndexing") !== "false", comingSoon: get("comingSoon") === "true", waitlistForm: get("waitlistForm") !== "false" };
}

export type Site = Awaited<ReturnType<typeof loadSite>>;

/** A phone number as a wa.me link, or null. Local Sri Lankan numbers (07…) get 94. */
export function whatsappLink(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = `94${d.slice(1)}`;
  return d.length >= 10 ? `https://wa.me/${d}` : null;
}
