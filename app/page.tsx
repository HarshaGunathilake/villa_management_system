import type { Metadata } from "next";
import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";
import { ComingSoon, PreviewBar } from "@/components/site/coming-soon";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { organization, pageMeta, SITE_DESCRIPTION, softwareApp, webPage, website } from "@/lib/server/seo";
import { BillPicture, CalendarPicture, GuestPicture, MoneyPicture, TonightPanel } from "@/components/landing/previews";
import { loadSite } from "@/lib/server/site";
import { money } from "@/lib/utils";

/*
 * The public landing page. Name, price, contact details and whether sign-ups
 * are open all come from Super Admin → Settings, so the page always matches.
 */

export const dynamic = "force-dynamic";


const loadPlatform = loadSite;

export async function generateMetadata(): Promise<Metadata> {
  const p = await loadPlatform();
  const description = "Villa booking and management app for Sri Lanka: one calendar for the whole villa or single rooms, guests, payments, WhatsApp receipts, expenses and reports.";
  return pageMeta({ siteName: p.name, title: `${p.name}: villa booking and management app for Sri Lanka`, description, path: "/", index: p.indexable });
}

const h2 = "font-display text-[2.125rem] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[2.75rem]";
const kicker = "text-[0.9375rem] font-semibold text-lp-accent";

function Arrow({ className = "size-[1.125rem]" }: { className?: string }) {
  return (
    <svg className={`${className} transition-transform duration-200 group-hover:translate-x-0.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

const FACTS = [
  { text: "Whole villa or room by room", icon: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></> },
  { text: "Works on any phone, nothing to install", icon: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></> },
  { text: "One monthly price, paid by card", icon: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></> },
];

const SMALL = [
  { title: "Amenities and extras", text: "Pickups, meals and tours, priced once and added to any bill." },
  { title: "Invoices and confirmations", text: "Print or save as PDF for any stay." },
  { title: "Expenses with receipts", text: "Logged by category, receipt attached." },
  { title: "Private to your villa", text: "Your bookings and money are only visible to your account." },
];

const STEPS = [
  { title: "Register your villa", text: "Your villa's name, your email and a password. About a minute." },
  { title: "Pay the first month", text: "By card, securely. The villa opens the moment it goes through." },
  { title: "Add rooms, take bookings", text: "Set your rooms and prices, then start adding guests and stays." },
];

export default async function LandingPage() {
  const p = await loadPlatform();
  if (p.comingSoon && !p.adminPreview) return <ComingSoon site={p} />;
  const signedIn = p.signedIn;
  const priced = p.signup.monthlyAmount > 0;
  const whatsapp = p.phone ? `https://wa.me/${p.phone.replace(/[^\d]/g, "")}` : null;

  const primary = signedIn
    ? { href: "/dashboard", label: "Open dashboard" }
    : p.signup.open
      ? { href: "/register", label: "Register your villa" }
      : { href: "/login", label: "Sign in" };

  const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-accent";

  return (
    <div className="landing min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-lp-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      {p.adminPreview ? <PreviewBar /> : null}
      <JsonLd items={[organization(p), website(p), softwareApp(p), webPage("WebPage", "/", `${p.name}: villa booking and management app for Sri Lanka`, SITE_DESCRIPTION)]} />
      <LandingNav platform={p.name} signedIn={signedIn} signupsOpen={p.signup.open} />

      <main id="main">
        {/* Hero */}
        <section className="mx-auto flex max-w-[75rem] flex-wrap items-center gap-14 px-6 pt-14 pb-20 sm:pt-[4.5rem] sm:pb-[5.5rem]">
          <div className="min-w-0 flex-[1_1_27.5rem]">
            <p className={kicker}>For villas with a handful of rooms</p>
            <h1 className="mt-4 font-display text-[2.75rem] leading-[1.02] font-bold tracking-[-0.04em] sm:text-[4rem]">Every room, every guest, every rupee.</h1>
            <p className="mt-6 max-w-[31.25rem] text-lg leading-relaxed text-lp-muted sm:text-[1.1875rem]">
              Take bookings for the whole villa or a single room, check guests in and out, settle the bill and track what you spend. On your phone or your laptop.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href={primary.href}
                className={`group inline-flex min-h-[3.25rem] items-center gap-2.5 rounded-xl bg-lp-accent px-[1.625rem] font-semibold text-white transition-colors duration-200 hover:bg-lp-accent-deep active:translate-y-px ${focus}`}
              >
                {primary.label} <Arrow />
              </Link>
              <Link href="/features" className="font-medium underline decoration-lp-line decoration-2 underline-offset-[6px] transition-colors hover:decoration-lp-ink">
                See what it does
              </Link>
            </div>
            {priced ? <p className="mt-5 text-[0.9375rem] text-lp-muted">{money(p.signup.monthlyAmount)} a month, paid by card. Cancel any time.</p> : null}
          </div>
          <div className="min-w-0 flex-[1_1_30rem]">
            <TonightPanel />
          </div>
        </section>

        {/* Three plain facts */}
        <section aria-label="At a glance" className="border-y border-lp-line bg-white">
          <ul className="mx-auto flex max-w-[75rem] flex-wrap gap-x-12 gap-y-5 px-6 py-7">
            {FACTS.map((f) => (
              <li key={f.text} className="flex flex-[1_1_15rem] items-center gap-3.5 font-medium">
                <svg className="size-[1.375rem] shrink-0 text-lp-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {f.icon}
                </svg>
                {f.text}
              </li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-[75rem] scroll-mt-20 px-6 pt-24 pb-28 sm:pt-[6.5rem]">
          <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
            <h2 className={`${h2} flex-[1_1_30rem]`}>Built around how a villa actually runs</h2>
            <p className="max-w-[26.25rem] flex-[1_1_20rem] text-[1.0625rem] leading-relaxed text-lp-muted">
              No hotel jargon and no spreadsheets. The screens your team uses every day, and rules that catch mistakes before a guest does.
            </p>
          </div>

          <div className="mt-14 flex flex-wrap gap-5">
            <article className="flex min-w-0 flex-[999_1_40rem] flex-col gap-6 rounded-[1.375rem] border border-lp-line bg-white p-6 sm:p-8">
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-[-0.015em]">The whole villa, or one room. Never both by mistake.</h3>
                <p className="mt-2.5 max-w-[35rem] leading-relaxed text-lp-muted">
                  Rooms and the entire villa share one calendar. A room can&apos;t be booked twice, and the whole villa is only free when every room is.
                </p>
              </div>
              <CalendarPicture />
            </article>

            <article className="flex min-w-0 flex-[1_1_21.25rem] flex-col gap-6 rounded-[1.375rem] bg-lp-ink p-6 text-white sm:p-8">
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-[-0.015em]">The bill adds itself up</h3>
                <p className="mt-2.5 leading-relaxed text-lp-night-muted">Extras and payments land on the booking. At check-out you see exactly what&apos;s owed.</p>
              </div>
              <BillPicture />
            </article>

            <article className="flex min-w-0 flex-[1_1_21.25rem] flex-col gap-5 rounded-[1.375rem] border border-lp-line bg-white p-6 sm:p-8">
              <div>
                <h3 className="font-display text-2xl font-semibold tracking-[-0.015em]">Know where the month went</h3>
                <p className="mt-2.5 leading-relaxed text-lp-muted">Income, expenses and how full the villa was, every month.</p>
              </div>
              <MoneyPicture />
            </article>

            <article className="flex min-w-0 flex-[1_1_21.25rem] flex-col gap-5 rounded-[1.375rem] bg-lp-accent-soft p-6 sm:p-8">
              <h3 className="font-display text-2xl font-semibold tracking-[-0.015em]">Guests come back. You&apos;ll know them.</h3>
              <p className="leading-relaxed text-lp-accent-ink">Phone, email and every past stay in one place, so a returning guest is booked in seconds.</p>
              <GuestPicture />
            </article>

            {SMALL.map((s) => (
              <article key={s.title} className="min-w-0 flex-[1_1_16.25rem] rounded-[1.375rem] border border-lp-line bg-white p-7">
                <h3 className="font-display text-[1.1875rem] font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-lp-muted">{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-lp-line bg-white">
          <div className="mx-auto max-w-[75rem] px-6 pt-24 pb-[6.5rem]">
            <h2 className={h2}>Open for bookings today</h2>
            <ol className="mt-12 flex flex-wrap gap-10">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex-[1_1_17.5rem] border-t-2 border-lp-ink pt-5">
                  <div className="font-display text-[0.9375rem] font-bold text-lp-accent">0{i + 1}</div>
                  <h3 className="mt-2.5 font-display text-[1.375rem] font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-lp-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-[75rem] scroll-mt-20 px-6 py-24 sm:py-[6.5rem]">
          <div className="flex flex-wrap items-center gap-12 rounded-[1.75rem] bg-lp-accent p-7 text-white sm:p-14">
            <div className="min-w-0 flex-[1_1_23.75rem]">
              <p className="text-[0.9375rem] font-semibold text-[#bfe3d8]">Pricing</p>
              <h2 className={`${h2} mt-3`}>One plan. Everything in it.</h2>
              <p className="mt-4 max-w-[26.25rem] text-[1.0625rem] leading-relaxed text-[#d9eee8]">
                No setup fee, no contract and no per-room charges. Pay monthly by card and stop whenever you like.
              </p>
            </div>
            <div className="min-w-0 flex-[1_1_23.75rem] rounded-[1.25rem] bg-white p-7 text-lp-ink sm:p-9">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-display text-5xl font-bold tracking-[-0.035em] tabular-nums sm:text-[3.5rem]">{priced ? money(p.signup.monthlyAmount) : "Ask us"}</span>
                {priced ? <span className="text-[1.0625rem] text-lp-muted">a month</span> : null}
              </div>
              <ul className="mt-6 grid grid-cols-1 gap-x-5 gap-y-3 border-t border-lp-hairline pt-6 text-[0.9375rem] sm:grid-cols-2">
                {["Unlimited bookings", "All your rooms", "Invoices and reports", "Cancel any time"].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="text-lp-accent"><Check /></span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={primary.href}
                className={`group mt-7 flex min-h-[3.25rem] items-center justify-center gap-2.5 rounded-xl bg-lp-ink font-semibold text-white transition-colors duration-200 hover:bg-lp-accent active:translate-y-px ${focus}`}
              >
                {primary.label} <Arrow />
              </Link>
              <p className="mt-3 text-center text-[0.8125rem] text-lp-muted">Card payments are handled by Dodo Payments.</p>
            </div>
          </div>
        </section>

        {/* About us */}
        <section id="about" className="mx-auto flex max-w-[75rem] scroll-mt-20 flex-wrap gap-x-[4.5rem] gap-y-6 px-6 pt-6 pb-24 sm:pb-[6.5rem]">
          <div className="min-w-0 flex-[1_1_22.5rem]">
            <p className={kicker}>About us</p>
            <h2 className={`${h2} mt-3`}>Made for the villa, not the hotel</h2>
          </div>
          <div className="min-w-0 flex-[1.4_1_28.75rem] space-y-5 text-lg leading-[1.7] text-lp-body lg:pt-9">
            <p>
              {p.name} is for the owners and managers of small villas: a handful of rooms, where the same few people take the booking, welcome the guest and pay
              the electricity bill.
            </p>
            <p>Hotel systems are built for front offices and night auditors. Notebooks lose track the moment a room is booked twice. We built the part in between.</p>
            <Link href="/about" className="inline-block text-base font-semibold text-lp-accent underline-offset-[5px] hover:underline">
              More about us
            </Link>
          </div>
        </section>

        {/* Contact us */}
        <section id="contact" className="scroll-mt-20 border-t border-lp-line bg-white">
          <div className="mx-auto flex max-w-[75rem] flex-wrap gap-x-[4.5rem] gap-y-10 px-6 py-24">
            <div className="min-w-0 flex-[1_1_22.5rem]">
              <p className={kicker}>Contact us</p>
              <h2 className={`${h2} mt-3`}>Talk to a person</h2>
              <p className="mt-4 max-w-[22.5rem] text-[1.0625rem] leading-relaxed text-lp-muted">Questions before you sign up, or help with your account.</p>
              <Link href="/contact" className="mt-5 inline-block font-semibold text-lp-accent underline-offset-[5px] hover:underline">
                Send us a message
              </Link>
            </div>
            <div className="flex min-w-0 flex-[1.4_1_28.75rem] flex-wrap gap-4">
              {p.email ? (
                <ContactCard href={`mailto:${p.email}`} label="Email" value={p.email} icon={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></>} />
              ) : null}
              {p.phone ? (
                <ContactCard
                  href={`tel:${p.phone.replace(/\s/g, "")}`}
                  label="Phone"
                  value={p.phone}
                  icon={<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />}
                />
              ) : null}
              {whatsapp ? <ContactCard dark external href={whatsapp} label="WhatsApp" value="Send us a message" icon={<path d="M4 20l1.3-3.9A8.5 8.5 0 1 1 8 19z" />} /> : null}
              {!p.email && !p.phone ? <p className="text-lp-muted">Contact details will appear here soon.</p> : null}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter platform={p.name} signupsOpen={p.signup.open} />
    </div>
  );
}

function ContactCard({ href, label, value, icon, dark, external }: { href: string; label: string; value: string; icon: React.ReactNode; dark?: boolean; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={`group flex min-w-0 flex-[1_1_12.5rem] flex-col gap-7 rounded-[1.125rem] p-6 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-accent ${
        dark ? "bg-lp-ink text-white hover:bg-lp-night" : "bg-lp-ground hover:bg-lp-accent-soft"
      }`}
    >
      <svg className={`size-6 ${dark ? "text-lp-mint" : "text-lp-accent"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon}
      </svg>
      <span>
        <span className={`block text-[0.8125rem] ${dark ? "text-lp-night-muted" : "text-lp-muted"}`}>{label}</span>
        <span className="mt-0.5 block font-semibold [overflow-wrap:anywhere]">{value}</span>
      </span>
    </a>
  );
}
