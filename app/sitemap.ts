import type { MetadataRoute } from "next";
import { ensureReady } from "@/lib/server/db";
import { PUBLIC_PAGES, siteUrl } from "@/lib/server/seo";
import { websiteFlags } from "@/lib/server/site";

// Built per request, so it follows APP_URL and Super Admin → Settings → Website.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    await ensureReady();
    const flags = await websiteFlags();
    if (!flags.searchIndexing || flags.comingSoon) return [];
  } catch {
    return [];
  }
  const url = siteUrl();
  return PUBLIC_PAGES.map((p) => ({ url: `${url}${p.path === "/" ? "" : p.path}`, lastModified: new Date(), changeFrequency: p.changeFrequency, priority: p.priority }));
}
