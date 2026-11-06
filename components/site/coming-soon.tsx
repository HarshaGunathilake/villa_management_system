import Link from "next/link";
import { BrandMark, ISLAND_SIMPLE, Wordmark } from "@/components/brand";
import type { Site } from "@/lib/server/site";
import { whatsappLink } from "@/lib/server/site";
import { PhoneFrame, SHOTS } from "./frames";
import { WaitlistForm } from "./waitlist-form";

/** What visitors see on every public page while Super Admin → Settings → Website → Coming soon is on. */
export function ComingSoon({ site }: { site: Site }) {
  const whatsapp = site.phone ? whatsappLink(site.phone) : null;
  return (
    <div className="landing flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[75rem] items-center gap-4 px-6 py-5">
        <span className="flex items-center gap-2.5">
          <BrandMark />
          <Wordmark name={site.name} className="text-[1.25rem]" />
        </span>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-[75rem] flex-1 flex-wrap items-center gap-x-16 gap-y-12 px-6 pt-8 pb-16 sm:pt-12">
        <div className="min-w-0 flex-[1_1_28rem]">
          <p className="inline-flex items-center gap-2 rounded-full bg-lp-accent-soft px-3.5 py-1.5 text-[0.875rem] font-semibold text-lp-accent">
            <span className="size-2 rounded-full bg-lp-accent motion-safe:animate-pulse" aria-hidden="true" />
            Coming soon
          </p>
          <h1 className="mt-6 font-display text-[2.75rem] leading-[1.02] font-bold tracking-[-0.045em] sm:text-[4.25rem]">A calmer way to run your villa is almost here.</h1>
          <p className="mt-6 max-w-[33rem] text-lg leading-relaxed text-lp-muted sm:text-[1.1875rem]">
            {site.name} keeps bookings, guests, payments and expenses for small villas in Sri Lanka in one place, on your phone or laptop.
            {site.waitlistForm ? " Leave your email and we'll tell you the day it opens." : null}
          </p>
          {site.waitlistForm ? (
            <div className="mt-9 max-w-[30rem]">
              <WaitlistForm />
            </div>
          ) : null}
          {site.email || whatsapp ? (
            <p className="mt-8 text-[0.9375rem] text-lp-muted">
              Questions before then?{" "}
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-lp-accent underline underline-offset-4">
                  WhatsApp us
                </a>
              ) : null}
              {whatsapp && site.email ? " or " : null}
              {site.email ? (
                <a href={`mailto:${site.email}`} className="font-semibold text-lp-accent underline underline-offset-4">
                  {site.email}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="relative flex min-w-0 flex-[1_1_24rem] justify-center overflow-hidden rounded-[2rem] bg-lp-accent px-6 pt-12 sm:px-10">
          <svg viewBox="0 0 48 48" aria-hidden="true" className="pointer-events-none absolute -top-10 -right-24 size-[34rem] opacity-[0.14]">
            <path d={ISLAND_SIMPLE} fill="#fff" />
          </svg>
          <div className="relative flex items-end gap-4">
            <PhoneFrame shot={SHOTS.phoneCalendar} className="mb-0 w-[11rem] translate-y-6 shadow-[0_30px_60px_rgba(4,30,26,0.45)] sm:w-[13.5rem]" />
            <PhoneFrame shot={SHOTS.phoneHome} className="mb-0 hidden w-[11rem] translate-y-16 shadow-[0_30px_60px_rgba(4,30,26,0.45)] sm:block sm:w-[13.5rem]" />
          </div>
        </div>
      </main>

      <footer className="border-t border-lp-line">
        <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-lp-muted">
          <span>
            © {new Date().getFullYear()} {site.name}
          </span>
          <span>Made in Sri Lanka</span>
        </div>
      </footer>
    </div>
  );
}

/** A thin bar on the real pages, only for a signed-in Super Admin, while visitors see Coming soon. */
export function PreviewBar() {
  return (
    <div className="bg-lp-ink px-6 py-2.5 text-center text-sm text-white">
      <span className="font-semibold">Coming soon is on.</span> Visitors see the coming-soon page; you see the real site because you&apos;re signed in as Super Admin.{" "}
      <Link href="/admin/settings" className="font-semibold text-lp-mint underline underline-offset-4">
        Settings
      </Link>
    </div>
  );
}
