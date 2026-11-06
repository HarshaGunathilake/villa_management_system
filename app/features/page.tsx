import type { Metadata } from "next";
import { Check, CtaBand, h1, h2, kicker, lead, primaryAction, PrimaryButton, SecondaryButton } from "@/components/site/bits";
import { BrowserFrame, PhoneFrame, Shot, SHOTS } from "@/components/site/frames";
import { FaqList } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { SitePage } from "@/components/site/site-page";
import { breadcrumbs, faqPage, pageMeta, softwareApp, webPage } from "@/lib/server/seo";
import { loadSite } from "@/lib/server/site";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TITLE = "Villa booking calendar, payments & reports";
const DESCRIPTION = "A booking calendar for the whole villa or single rooms with no double bookings, guest records, payments and extras, WhatsApp receipts, expenses and profit reports.";

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  return pageMeta({ siteName: site.name, index: site.indexable, title: `${TITLE} | ${site.name}`, description: DESCRIPTION, path: "/features" });
}

/** Plain answers to what villa owners ask before signing up. Also published as FAQ structured data. */
function faq(name: string, price: string | null) {
  return [
    { q: `What is ${name}?`, a: `${name} is online booking and management software for small villas in Sri Lanka. It keeps the booking calendar, guests, payments, receipts, expenses and reports in one place, on a phone or a laptop.` },
    { q: "Can I take bookings for the whole villa and for single rooms?", a: "Yes. Each booking is for the entire villa or for one room. An entire-villa booking blocks every room for those nights, and any room booking blocks the entire villa, so the two can never overlap." },
    { q: `Does ${name} stop double bookings?`, a: "Yes. A room or the villa can't be booked twice for the same night, and on changeover days the leaving guest's check-out time must come before the arriving guest's check-in time." },
    { q: "Does it connect to Booking.com or Airbnb?", a: `Not automatically. You add bookings from Booking.com, Airbnb, WhatsApp, phone or walk-ins in ${name}, note where each came from, and see them all on one calendar. Reports then show income by booking source.` },
    { q: "Can I send a booking confirmation to a guest on WhatsApp?", a: "Yes. Every booking has a confirmation, and an invoice after check-out. You can print them, save them as a PDF, or open WhatsApp with the details already written to the guest's number." },
    { q: "Do I need to install an app?", a: `No. ${name} works in the web browser on any phone, tablet or computer, and the same account can be signed in on several devices at once.` },
    { q: `How much does ${name} cost?`, a: price ? `${price} a month per villa, with every feature included, any number of rooms, and no contract.` : "One monthly price per villa, with every feature included, any number of rooms, and no contract." },
  ];
}

const IN_SHORT = [
  { title: "No double bookings", text: "The whole villa or one room. Taken nights are blocked for you." },
  { title: "Every rupee on the booking", text: "Advances, extras and the balance, settled at check-out." },
  { title: "Receipts on WhatsApp", text: "Send the confirmation or invoice to the guest in one tap." },
  { title: "Profit you can see", text: "Income, expenses and occupancy by month, with CSV export." },
];

const SMALL = [
  { title: "Guest history", text: "Returning guests are found by name or phone, with every past stay.", icon: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 8" /><path d="M22 21a7 7 0 0 0-4-6.3" /></> },
  { title: "Rooms your way", text: "Each room with its own price and guests, switched off when it's being painted.", icon: <><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><path d="M2 17h20" /></> },
  { title: "Check-in and out times", text: "Usual times for the villa, changed for one booking when a guest asks.", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  { title: "Your data stays yours", text: "Each villa's records are kept apart, and only your sign-in can open them.", icon: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></> },
  { title: "Export to CSV", text: "Bookings, expenses and monthly totals, ready for Excel or Google Sheets.", icon: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></> },
  { title: "Safe sign-in", text: "Email confirmation, password reset by email, and sign-out everywhere after a change.", icon: <><path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z" /><path d="m9 12 2 2 4-4" /></> },
];

function Points({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3">
          <Check />
          {t}
        </li>
      ))}
    </ul>
  );
}

function Copy({ label, title, text, children }: { label: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-[1_1_26rem] lg:max-w-[28rem]">
      <p className={kicker}>{label}</p>
      <h2 className={`${h2} mt-3`}>{title}</h2>
      <p className="mt-4 text-[1.0625rem] leading-[1.65] text-lp-muted">{text}</p>
      {children}
    </div>
  );
}

export default async function FeaturesPage() {
  const site = await loadSite();
  const primary = primaryAction(site);
  const questions = faq(site.name, site.signup.monthlyAmount > 0 ? money(site.signup.monthlyAmount) : null);

  return (
    <SitePage site={site}>
      <JsonLd
        items={[
          webPage("WebPage", "/features", `${site.name} features`, DESCRIPTION),
          breadcrumbs([{ name: site.name, path: "/" }, { name: "Features", path: "/features" }]),
          softwareApp(site),
          faqPage(questions),
        ]}
      />
      {/* Hero */}
      <section className="mx-auto max-w-[75rem] px-6 pt-16 text-center sm:pt-[5.5rem]">
        <p className={kicker}>Features</p>
        <h1 className={`${h1} mx-auto mt-4 max-w-[55rem]`}>Everything a small villa runs on, in one calm app.</h1>
        <p className={`${lead} mx-auto mt-6 max-w-[38.75rem]`}>
          Bookings, guests, payments, expenses and reports. Built for villas with a handful of rooms, priced in rupees, and at home on a phone.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <PrimaryButton href={primary.href} label={primary.label} />
          <SecondaryButton href="/pricing" label="See pricing" />
        </div>
      </section>

      <section className="mx-auto max-w-[77.5rem] px-4 pt-14 sm:px-6 sm:pt-16">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-lp-accent px-4 pt-4 sm:rounded-[2rem] sm:px-12 sm:pt-12">
          <BrowserFrame shot={SHOTS.dashboard} url="lankastay.lk/dashboard" priority className="shadow-[0_30px_80px_rgba(4,30,26,0.35)]" />
          <PhoneFrame shot={SHOTS.phoneCalendar} className="absolute right-6 -bottom-10 hidden w-[14.375rem] shadow-[0_30px_60px_rgba(4,30,26,0.45)] md:block lg:right-16" />
        </div>
      </section>

      {/* In short */}
      <section aria-label="In short" className="mx-auto max-w-[75rem] px-6 pt-16 sm:pt-[4.5rem]">
        <ul className="grid gap-px overflow-hidden rounded-[1.25rem] border border-lp-line bg-lp-line sm:grid-cols-2 lg:grid-cols-4">
          {IN_SHORT.map((f) => (
            <li key={f.title} className="bg-white px-6 py-6">
              <div className="font-display text-lg font-semibold">{f.title}</div>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-lp-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Calendar */}
      <section className="mx-auto flex max-w-[75rem] flex-wrap items-center gap-14 px-6 pt-24 sm:pt-32">
        <Copy label="Calendar" title="Every night at a glance." text="See which rooms are free, booked, arriving or leaving across two weeks. Tap an empty night to start a booking right there.">
          <Points items={["Entire-villa bookings block every room, and the other way round", "Check-in and check-out times kept on changeover days", "Swipe through the days on a phone"]} />
        </Copy>
        <figure className="min-w-0 flex-[999_1_35rem] rounded-[1.75rem] bg-[#e3ecea] p-4 sm:p-8">
          <Shot shot={SHOTS.calendar} sizes="(min-width: 1200px) 700px, 100vw" className="rounded-[0.875rem] shadow-[0_18px_50px_rgba(14,26,25,0.16)]" />
        </figure>
      </section>

      {/* Bookings */}
      <section className="mx-auto flex max-w-[75rem] flex-wrap-reverse items-center gap-14 px-6 pt-24 sm:pt-32">
        <figure className="min-w-0 flex-[999_1_35rem] rounded-[1.75rem] bg-lp-ink p-4 sm:p-8">
          <Shot shot={SHOTS.booking} sizes="(min-width: 1200px) 700px, 100vw" className="rounded-[0.875rem]" />
        </figure>
        <Copy
          label="Bookings and payments"
          title="The bill adds itself up."
          text="Record the advance, add a BBQ night or airport pickup, and the balance is always right. Check-out won't go through while money is still owed."
        >
          <Points items={["Booking.com, Airbnb, WhatsApp, phone or direct", "Amenities and extras priced once, added in a tap", "Upcoming, current and completed stays, all in one list"]} />
        </Copy>
      </section>

      {/* Receipts */}
      <section className="mx-auto flex max-w-[75rem] flex-wrap items-center gap-14 px-6 pt-24 sm:pt-32">
        <Copy
          label="Receipts and invoices"
          title="Send it where your guests already are."
          text="A clean booking confirmation when they book, an invoice when they leave. Print it, save it as a PDF, or send the details straight to the guest on WhatsApp."
        />
        <div className="flex min-w-0 flex-[999_1_35rem] items-end gap-6 overflow-hidden rounded-[1.75rem] border border-lp-line bg-white px-4 pt-4 sm:px-8 sm:pt-8">
          <Shot shot={SHOTS.document} sizes="(min-width: 1200px) 480px, 70vw" className="min-w-0 flex-1 rounded-t-xl shadow-[0_12px_40px_rgba(14,26,25,0.12)]" />
          <div className="hidden w-[13.75rem] shrink-0 rounded-t-[2.125rem] bg-lp-ink px-[9px] pt-[9px] sm:block">
            <Shot shot={SHOTS.phoneBooking} sizes="220px" className="rounded-t-[1.625rem]" />
          </div>
        </div>
      </section>

      {/* Money */}
      <section className="mx-auto max-w-[75rem] px-6 pt-24 sm:pt-32">
        <div className="max-w-[45rem]">
          <p className={kicker}>Money</p>
          <h2 className={`${h2} mt-3`}>Know where the month went.</h2>
          <p className="mt-4 text-[1.0625rem] leading-[1.65] text-lp-muted">
            Write down the electricity bill, the staff and the groceries. Reports show income, expenses and profit for any run of months.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-6">
          <article className="flex min-w-0 flex-[1_1_28rem] flex-col overflow-hidden rounded-3xl border border-lp-line bg-white px-6 pt-7 sm:px-7">
            <h3 className="font-display text-[1.375rem] font-semibold">Expenses by category</h3>
            <p className="mt-2 mb-6 text-[0.9375rem] leading-relaxed text-lp-muted">Bills, staff, cleaning and repairs, with the month&apos;s total beside them.</p>
            <Shot shot={SHOTS.expenses} sizes="(min-width: 1200px) 560px, 100vw" className="mt-auto rounded-t-xl border border-b-0 border-lp-hairline" />
          </article>
          <article className="flex min-w-0 flex-[1_1_28rem] flex-col overflow-hidden rounded-3xl bg-lp-night px-6 pt-7 text-white sm:px-7">
            <h3 className="font-display text-[1.375rem] font-semibold">Reports and CSV</h3>
            <p className="mt-2 mb-6 text-[0.9375rem] leading-relaxed text-lp-night-muted">Income by room and by booking source, balances still to collect, and files for your accountant.</p>
            <Shot shot={SHOTS.reports} sizes="(min-width: 1200px) 560px, 100vw" className="mt-auto rounded-t-xl" />
          </article>
        </div>
      </section>

      {/* Phone */}
      <section className="mt-24 bg-lp-night text-white sm:mt-32">
        <div className="mx-auto flex max-w-[75rem] flex-wrap items-center gap-14 px-6 py-20 sm:py-24">
          <div className="min-w-0 flex-[1_1_26rem] lg:max-w-[28rem]">
            <p className="text-[0.9375rem] font-semibold text-lp-mint">On your phone</p>
            <h2 className={`${h2} mt-3`}>Run the villa from the verandah.</h2>
            <p className="mt-4 text-[1.0625rem] leading-[1.65] text-lp-night-muted">
              Every screen works on a phone, with big buttons and nothing to install. Sign in on the laptop at the desk and the phone by the pool, and both stay in step.
            </p>
          </div>
          <div className="flex min-w-0 flex-[999_1_35rem] items-start justify-center gap-3 sm:gap-5">
            <PhoneFrame dark shot={SHOTS.phoneHome} className="mt-12 w-[13.75rem] min-w-0 shrink" />
            <PhoneFrame dark shot={SHOTS.phoneCalendar} className="w-[13.75rem] min-w-0 shrink" />
            <PhoneFrame dark shot={SHOTS.phoneReports} className="mt-24 hidden w-[13.75rem] min-w-0 shrink sm:block" />
          </div>
        </div>
      </section>

      {/* Small things */}
      <section className="mx-auto max-w-[75rem] px-6 pt-24 sm:pt-28">
        <h2 className="font-display text-[1.875rem] leading-[1.1] font-bold tracking-[-0.03em] sm:text-4xl">And the small things that save an afternoon.</h2>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SMALL.map((s) => (
            <div key={s.title} className="rounded-[1.125rem] border border-lp-line bg-white p-6">
              <svg className="size-[1.625rem] text-lp-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {s.icon}
              </svg>
              <h3 className="mt-3.5 text-[1.0625rem] font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-lp-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex max-w-[75rem] flex-wrap gap-x-16 gap-y-10 px-6 pt-24 sm:pt-28">
        <div className="min-w-0 flex-[1_1_17.5rem]">
          <h2 className="font-display text-[2.125rem] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[2.5rem]">Questions villa owners ask</h2>
          <p className="mt-3.5 leading-relaxed text-lp-muted">Short, straight answers. Anything else, just ask us.</p>
        </div>
        <div className="min-w-0 flex-[999_1_32.5rem]">
          <FaqList items={questions} openFirst />
        </div>
      </section>

      <CtaBand
        title="Ready for the next booking?"
        text={site.signup.open ? "Register in two minutes. Your villa opens as soon as the first month is paid." : "Sign in to your villa, or get in touch to hear when sign-ups open."}
        primary={primary}
        secondary={{ href: "/contact", label: "Talk to us" }}
      />
    </SitePage>
  );
}
