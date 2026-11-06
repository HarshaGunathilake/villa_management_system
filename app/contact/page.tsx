import type { Metadata } from "next";
import Link from "next/link";
import { kicker } from "@/components/site/bits";
import { ContactForm } from "@/components/site/contact-form";
import { JsonLd } from "@/components/site/json-ld";
import { SitePage } from "@/components/site/site-page";
import { breadcrumbs, organization, pageMeta, webPage } from "@/lib/server/seo";
import { loadSite, whatsappLink } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  const reach = [site.email, site.phone].filter(Boolean).join(" or ");
  const description = `Questions about ${site.name} for your villa, or help with your account? Send a message${reach ? `, or reach us at ${reach}` : ""}. WhatsApp welcome.`;
  return pageMeta({ siteName: site.name, index: site.indexable, title: `Contact us | ${site.name}`, description, path: "/contact" });
}

const ICON = "size-[1.375rem]";

export default async function ContactPage() {
  const site = await loadSite();
  const whatsapp = site.phone ? whatsappLink(site.phone) : null;

  const answers = [
    { href: "/pricing", title: "How much does it cost?", text: "One monthly price per villa, every feature included.", cta: "Pricing" },
    { href: "/forgot-password", title: "Forgot your password?", text: "Get a reset link by email in a minute, no need to write to us.", cta: "Reset password" },
    { href: "/features", title: "Will it work for my villa?", text: "If you rent the whole villa, single rooms, or both: yes.", cta: "Features" },
  ];

  return (
    <SitePage site={site}>
      <JsonLd
        items={[
          webPage("ContactPage", "/contact", `Contact ${site.name}`, `Contact ${site.name} by message, email, phone or WhatsApp.`),
          breadcrumbs([{ name: site.name, path: "/" }, { name: "Contact us", path: "/contact" }]),
          organization(site),
        ]}
      />
      <section className="mx-auto flex max-w-[75rem] flex-wrap items-start gap-x-[4.5rem] gap-y-12 px-6 pt-16 sm:pt-[5.5rem]">
        <div className="min-w-0 flex-[1_1_23.75rem]">
          <p className={kicker}>Contact us</p>
          <h1 className="mt-4 font-display text-[2.75rem] leading-[1.02] font-bold tracking-[-0.04em] sm:text-[3.75rem]">Talk to a person, not a ticket system.</h1>
          <p className="mt-5 max-w-[28.75rem] text-lg leading-relaxed text-lp-muted">
            Thinking about {site.name} for your villa, or stuck on something? Send a message and we&apos;ll get back to you ourselves.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-[1.125rem] bg-lp-night px-5 py-4 text-white transition-colors hover:bg-lp-ink">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lp-night-line">
                  <svg className={`${ICON} text-lp-mint`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] text-lp-night-muted">WhatsApp</span>
                  <span className="mt-0.5 block font-semibold">Message us on {site.phone}</span>
                </span>
                <svg className="size-[1.125rem] text-lp-night-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
                <span className="sr-only">(opens WhatsApp)</span>
              </a>
            ) : null}
            {site.email ? (
              <a href={`mailto:${site.email}`} className="flex items-center gap-4 rounded-[1.125rem] border border-lp-line bg-white px-5 py-4 transition-colors hover:border-lp-ink">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lp-accent-soft">
                  <svg className={`${ICON} text-lp-accent`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] text-lp-muted">Email</span>
                  <span className="mt-0.5 block font-semibold [overflow-wrap:anywhere]">{site.email}</span>
                </span>
              </a>
            ) : null}
            {site.phone ? (
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="flex items-center gap-4 rounded-[1.125rem] border border-lp-line bg-white px-5 py-4 transition-colors hover:border-lp-ink">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lp-accent-soft">
                  <svg className={`${ICON} text-lp-accent`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] text-lp-muted">Phone</span>
                  <span className="mt-0.5 block font-semibold">{site.phone}</span>
                </span>
              </a>
            ) : null}
          </div>

          <p className="mt-7 text-[0.9375rem] leading-relaxed text-lp-muted">
            Already using {site.name}?{" "}
            <Link href="/login" className="font-semibold text-lp-accent underline underline-offset-4">
              Sign in
            </Link>{" "}
            and tell us which villa it&apos;s about, so we can help faster.
          </p>
        </div>

        <ContactForm />
      </section>

      <section className="mx-auto max-w-[75rem] px-6 py-24 sm:py-28">
        <h2 className="font-display text-[1.875rem] leading-[1.1] font-bold tracking-[-0.03em] sm:text-4xl">Quick answers</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {answers.map((a) => (
            <Link key={a.href} href={a.href} className="block rounded-[1.25rem] border border-lp-line bg-white p-6 transition-colors hover:border-lp-ink">
              <span className="block text-[1.0625rem] font-semibold">{a.title}</span>
              <span className="mt-1.5 block text-[0.9375rem] leading-relaxed text-lp-muted">{a.text}</span>
              <span className="mt-3.5 block font-semibold text-lp-accent">{a.cta} →</span>
            </Link>
          ))}
        </div>
      </section>
    </SitePage>
  );
}
