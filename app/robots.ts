import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server/seo";
import { websiteFlags } from "@/lib/server/site";
import { ensureReady } from "@/lib/server/db";

// Built per request, so it follows APP_URL and Super Admin → Settings → Website.
export const dynamic = "force-dynamic";

const PRIVATE = ["/api/", "/admin", "/dashboard", "/calendar", "/bookings", "/guests", "/expenses", "/money", "/reports", "/rooms", "/amenities", "/settings", "/subscription", "/more", "/document", "/reset-password", "/verify-email"];

/** Search and answer engines may read the public website, unless indexing is switched off or the site is "coming soon". */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const url = siteUrl();
  let open = false;
  try {
    await ensureReady();
    const flags = await websiteFlags();
    open = flags.searchIndexing && !flags.comingSoon;
  } catch {
    open = false; // can't tell: stay out of search results rather than risk it
  }
  if (!open) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }], sitemap: `${url}/sitemap.xml`, host: url };
}
