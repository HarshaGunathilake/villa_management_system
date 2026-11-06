import type { Metadata } from "next";
import Link from "next/link";
import { ISLAND_SIMPLE } from "@/components/brand";
import { h2, kicker, primaryAction, PrimaryButton } from "@/components/site/bits";
import { PhoneFrame, SHOTS } from "@/components/site/frames";
import { JsonLd } from "@/components/site/json-ld";
import { SitePage } from "@/components/site/site-page";
import { breadcrumbs, organization, pageMeta, webPage } from "@/lib/server/seo";
import { loadSite } from "@/lib/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  const description = `${site.name} is villa booking and management software made in Sri Lanka, for small villas with a handful of rooms. Why we built it and what we hold to.`;
  return pageMeta({ siteName: site.name, index: site.indexable, title: `About us: made in Sri Lanka for small villas | ${site.name}`, description, path: "/about" });
}

/*
 * The founder's note. Fill these in to show it on the About page; while they
 * are empty the section is left out, so the page never shows placeholder text.
 */
const FOUNDER = {
  name: "",
  role: "Founder",
  /** Two or three sentences in your own words */
  quote: "",
  /** A photo in /public, e.g. "/site/founder.jpg" */
  photo: "",
};

const PRINCIPLES = [
  { title: "Simple first", text: "Big buttons, plain words, no training. If a screen needs explaining, we change the screen." },
  { title: "Made for here", text: "Rupees, Sri Lankan phone numbers, Colombo time, and receipts that go out on WhatsApp." },
  { title: "One honest price", text: "Every feature for every villa, at the same monthly fee. No tiers, no commission on bookings." },
  { title: "Your records are yours", text: "Each villa's data is kept apart, and you can take it with you as a CSV at any time." },
];

export default async function AboutPage() {
  const site = await loadSite();
  const primary = primaryAction(site);

  return (
    <SitePage site={site}>
      <JsonLd
        items={[
          webPage("AboutPage", "/about", `About ${site.name}`, `${site.name} is villa booking and management software made in Sri Lanka, for small villas.`),
          breadcrumbs([{ name: site.name, path: "/" }, { name: "About us", path: "/about" }]),
          organization(site),
        ]}
      />
      <section className="mx-auto flex max-w-[75rem] flex-wrap items-end gap-x-16 gap-y-8 px-6 pt-16 sm:pt-[5.5rem]">
        <div className="min-w-0 flex-[999_1_35rem]">
          <p className={kicker}>About us</p>
          <h1 className="mt-4 font-display text-[2.75rem] leading-[1.02] font-bold tracking-[-0.045em] sm:text-[4.5rem] sm:leading-none">
            Made in Sri Lanka, for the small villas that make it special.
          </h1>
        </div>
        <p className="min-w-0 flex-[1_1_20rem] text-lg leading-relaxed text-lp-muted sm:text-[1.1875rem]">
          {site.name} is a booking and money app for villas with a handful of rooms: the kind run by a family, a caretaker and a phone that never stops ringing.
        </p>
      </section>

      <section className="mx-auto max-w-[77.5rem] px-4 pt-14 sm:px-6 sm:pt-16">
        <div className="relative flex min-h-[32.5rem] flex-wrap items-center gap-10 overflow-hidden rounded-[1.5rem] bg-lp-accent p-8 sm:rounded-[2rem] sm:p-14">
          <svg viewBox="0 0 48 48" aria-hidden="true" className="pointer-events-none absolute -top-16 -left-10 size-[40rem] opacity-[0.14]">
            <path d={ISLAND_SIMPLE} fill="#fff" />
          </svg>
          <div className="relative min-w-0 flex-[1_1_22.5rem] text-white">
            <p className="font-display text-[1.625rem] leading-[1.25] font-semibold tracking-[-0.02em] sm:text-[2.125rem]">
              &ldquo;Is the garden room free on the 14th?&rdquo; should take five seconds to answer, not five minutes of scrolling through WhatsApp.
            </p>
            <p className="mt-5 text-lp-accent-soft">The question {site.name} was built around.</p>
          </div>
          <div className="relative ml-auto flex items-end gap-4 sm:gap-5">
            <PhoneFrame shot={SHOTS.phoneCalendar} className="w-[10.5rem] shadow-[0_30px_60px_rgba(4,30,26,0.45)] sm:w-[13.75rem]" />
            <PhoneFrame shot={SHOTS.phoneHome} className="mb-12 w-[10.5rem] shadow-[0_30px_60px_rgba(4,30,26,0.45)] sm:w-[13.75rem]" />
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[75rem] flex-wrap gap-x-20 gap-y-8 px-6 pt-24 sm:pt-[7.5rem]">
        <h2 className={`${h2} min-w-0 flex-[1_1_18.75rem]`}>Why we built it</h2>
        <div className="min-w-0 flex-[999_1_35rem] space-y-5 text-lg leading-[1.7] text-lp-accent-ink">
          <p>
            A small villa takes bookings from everywhere at once: Booking.com, Airbnb, a cousin&apos;s friend on WhatsApp, a walk-in from the beach road. The dates live in a
            notebook, the advances in someone&apos;s memory, the electricity bill in a drawer.
          </p>
          <p>
            Hotel software is built for front desks with fifty rooms and a manager who reads manuals. Spreadsheets break the first time two people edit them. Neither was
            made for a villa with three rooms and a garden.
          </p>
          <p>
            So we made {site.name}: one place for the calendar, the guests and the money, plain enough for anyone at the villa to use on a phone, and priced in rupees at one
            simple monthly fee.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[75rem] px-6 pt-24 sm:pt-[7.5rem]">
        <h2 className={h2}>What we hold to</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => (
            <div key={p.title} className="rounded-[1.375rem] border border-lp-line bg-white p-7">
              <div className="font-display text-[0.9375rem] font-bold text-lp-accent">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="mt-3.5 font-display text-[1.3125rem] font-semibold">{p.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-lp-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {FOUNDER.name && FOUNDER.quote ? (
        <section className="mx-auto max-w-[75rem] px-6 pt-24 sm:pt-[7.5rem]">
          <figure className="flex flex-wrap items-center gap-x-14 gap-y-8 rounded-[1.75rem] bg-lp-night p-8 text-white sm:p-14">
            {FOUNDER.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={FOUNDER.photo} alt={FOUNDER.name} className="size-[7.5rem] rounded-full object-cover" />
            ) : null}
            <blockquote className="min-w-0 flex-[1_1_30rem]">
              <p className="font-display text-[1.5rem] leading-[1.35] font-medium tracking-[-0.015em] sm:text-[1.75rem]">{FOUNDER.quote}</p>
              <figcaption className="mt-5 text-lp-night-muted">
                {FOUNDER.name}, {FOUNDER.role}, {site.name}
              </figcaption>
            </blockquote>
          </figure>
        </section>
      ) : null}

      <section className="mx-auto flex max-w-[75rem] flex-wrap gap-6 px-6 py-24 sm:py-28">
        <Link href="/features" className="group block min-w-0 flex-[1_1_22.5rem] rounded-3xl border border-lp-line bg-white p-9 transition-colors hover:border-lp-ink">
          <span className="block font-display text-[1.625rem] font-semibold">See what it does</span>
          <span className="mt-2 block text-lp-muted">A tour of the calendar, bookings, receipts and reports.</span>
          <span className="mt-6 inline-flex font-semibold text-lp-accent">Features →</span>
        </Link>
        <Link href="/contact" className="group block min-w-0 flex-[1_1_22.5rem] rounded-3xl bg-lp-accent p-9 text-white transition-colors hover:bg-lp-accent-deep">
          <span className="block font-display text-[1.625rem] font-semibold">Talk to us</span>
          <span className="mt-2 block text-lp-accent-soft">Questions about your villa? We reply ourselves.</span>
          <span className="mt-6 inline-flex font-semibold">Contact us →</span>
        </Link>
        <div className="w-full pt-4 text-center">
          <PrimaryButton href={primary.href} label={primary.label} tone="ink" />
        </div>
      </section>
    </SitePage>
  );
}
