import { LandingNav } from "@/components/landing/landing-nav";
import type { Site } from "@/lib/server/site";
import { ComingSoon, PreviewBar } from "./coming-soon";
import { SiteFooter } from "./site-footer";

/** The frame every public website page shares: skip link, top bar, footer. */
export function SitePage({ site, children }: { site: Site; children: React.ReactNode }) {
  // Before launch, visitors get the Coming soon page; a signed-in Super Admin still sees the real one.
  if (site.comingSoon && !site.adminPreview) return <ComingSoon site={site} />;
  return (
    <div className="landing min-h-dvh">
      {site.adminPreview ? <PreviewBar /> : null}
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-lp-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <LandingNav platform={site.name} signedIn={site.signedIn} signupsOpen={site.signup.open} />
      <main id="main">{children}</main>
      <SiteFooter platform={site.name} signupsOpen={site.signup.open} />
    </div>
  );
}
