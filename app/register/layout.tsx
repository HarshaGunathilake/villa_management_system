import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/coming-soon";
import { pageMeta } from "@/lib/server/seo";
import { loadSite } from "@/lib/server/site";

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  return pageMeta({
    siteName: site.name,
    index: site.indexable,
    title: `Register your villa | ${site.name}`,
    description: `Create a ${site.name} account for your villa in two minutes. Confirm your email, pay the first month by card, and start taking bookings.`,
    path: "/register",
  });
}

export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  // Sign-ups wait for launch while the site is "coming soon".
  const site = await loadSite();
  if (site.comingSoon && !site.adminPreview) return <ComingSoon site={site} />;
  return children;
}
