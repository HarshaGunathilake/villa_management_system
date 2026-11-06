import type { Metadata } from "next";
import Link from "next/link";
import { Check, CtaBand, h1, kicker, lead, primaryAction, PrimaryButton } from "@/components/site/bits";
import { Shot, SHOTS } from "@/components/site/frames";
import { FaqList } from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { SitePage } from "@/components/site/site-page";
import { breadcrumbs, faqPage, pageMeta, softwareApp, webPage } from "@/lib/server/seo";
import { loadSite } from "@/lib/server/site";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  const price = site.signup.monthlyAmount > 0 ? `${money(site.signup.monthlyAmount)} a month` : "One monthly price";
  const description = `${price} per villa, every feature included: any number of rooms, unlimited bookings, receipts and reports. No setup fee, no contract.`;
  return pageMeta({ siteName: site.name, index: site.indexable, title: `Pricing: ${price} per villa | ${site.name}`, description, path: "/pricing" });
}

const INCLUDED = [
  "Any number of rooms",
  "Unlimited bookings and guests",
  "Calendar and availability",
  "Payments, extras and balances",
  "Receipts, invoices and WhatsApp",
  "Expenses and reports",
  "CSV export",
  "Phone, tablet and laptop",
];

const STEPS = [
  { title: "Register", text: "Your villa's name, your name, email and a password." },
  { title: "Confirm your email", text: "Click the link we send, so the account is truly yours." },
  { title: "Pay the first month", text: "By card. Your villa opens the moment it goes through." },
  { title: "Add your rooms and go", text: "A short guide shows you around on your first visit." },
];

const FAQ = [
  { q: "Is there a contract?", a: "No. You pay month by month and can cancel from the Subscription page whenever you like." },
  { q: "Does the price change with the number of rooms?", a: "No. Every villa pays the same price, with as many rooms, bookings and guests as it has." },
  { q: "How do I pay?", a: "By card. The first payment opens your villa, then the card is charged automatically each month. Card details are handled by Dodo Payments and never stored by us." },
  { q: "What if a payment doesn't go through?", a: "We email you and the card is tried again. While a payment is due you can still see everything, but new changes wait until it's paid. Nothing is deleted." },
  { q: "What happens to my records if I cancel?", a: "They're kept. Subscribe again later and everything is where you left it." },
];

export default async function PricingPage() {
  const site = await loadSite();
  const primary = primaryAction(site);
  const priced = site.signup.monthlyAmount > 0;
  const price = priced ? money(site.signup.monthlyAmount) : null;
  const questions = [
    {
      q: `How much does ${site.name} cost?`,
      a: price
        ? `${price} a month per villa. Every feature is included, with any number of rooms, bookings and guests, and there is no setup fee.`
        : "One monthly price per villa. Every feature is included, with any number of rooms, bookings and guests, and there is no setup fee.",
    },
    ...FAQ,
  ];

  return (
    <SitePage site={site}>
      <JsonLd
        items={[
          webPage("WebPage", "/pricing", `${site.name} pricing`, `${price ? `${price} a month` : "One monthly price"} per villa, every feature included.`),
          breadcrumbs([{ name: site.name, path: "/" }, { name: "Pricing", path: "/pricing" }]),
          softwareApp(site),
          faqPage(questions),
        ]}
      />
      <section className="mx-auto max-w-[75rem] px-6 pt-16 text-center sm:pt-[5.5rem]">
        <p className={kicker}>Pricing</p>
        <h1 className={`${h1} mx-auto mt-4 max-w-[51rem]`}>One price. Every feature. No surprises.</h1>
        <p className={`${lead} mx-auto mt-6 max-w-[37.5rem]`}>
          The same monthly price for every villa, however many rooms you have. No setup fee, no contract, cancel whenever you like.
        </p>
      </section>

      <section className="mx-auto flex max-w-[68.75rem] flex-wrap items-stretch gap-6 px-6 pt-14 sm:pt-16">
        <article className="flex min-w-0 flex-[1_1_27.5rem] flex-col rounded-[1.75rem] bg-lp-ink p-7 text-white sm:p-11">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">{site.name}</h2>
            <span className="rounded-full bg-lp-mint px-3 py-1 text-[0.8125rem] font-semibold text-lp-ink">Everything included</span>
          </div>
          <div className="mt-7 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-display text-[3.25rem] leading-none font-bold tracking-[-0.04em] tabular-nums sm:text-[4rem]">{price ?? "Ask us"}</span>
            {price ? <span className="text-[1.0625rem] text-lp-night-muted">a month</span> : null}
          </div>
          <p className="mt-3 text-[0.9375rem] text-lp-night-muted">
            {price ? "Per villa. Paid by card every month, through Dodo Payments." : "Get in touch and we'll tell you the current price."}
          </p>
          <PrimaryButton href={price ? primary.href : "/contact"} label={price ? primary.label : "Contact us"} tone="white" className="mt-8 w-full" />
          <ul className="mt-9 grid gap-x-6 gap-y-3.5 border-t border-lp-night-line pt-7 text-[0.9375rem] sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="size-5 text-lp-mint" />
                {item}
              </li>
            ))}
          </ul>
        </article>

        <aside className="min-w-0 flex-[1_1_22.5rem] rounded-[1.75rem] border border-lp-line bg-white p-7 sm:p-11">
          <h2 className="font-display text-2xl font-semibold">How it starts</h2>
          <ol className="mt-7 flex flex-col gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full font-bold ${i === STEPS.length - 1 ? "bg-lp-accent text-white" : "bg-lp-accent-soft text-lp-accent"}`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[1.0625rem] font-semibold">{s.title}</span>
                  <span className="mt-1 block text-[0.9375rem] leading-relaxed text-lp-muted">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="mx-auto max-w-[68.75rem] px-6 pt-20 sm:pt-24">
        <div className="flex flex-wrap items-end gap-8 overflow-hidden rounded-[1.75rem] bg-[#e3ecea] px-6 pt-8 sm:px-10 sm:pt-10">
          <div className="min-w-0 flex-[1_1_17.5rem] self-center pb-2 sm:pb-10">
            <h2 className="font-display text-[1.875rem] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[2.125rem]">The whole app, from the first month.</h2>
            <p className="mt-3.5 leading-relaxed text-lp-accent-ink">No feature is held back for a bigger plan. What you see here is what you get.</p>
            <Link href="/features" className="mt-5 inline-block font-semibold text-lp-accent underline-offset-[5px] hover:underline">
              Tour the features
            </Link>
          </div>
          <Shot shot={SHOTS.reports} sizes="(min-width: 1100px) 620px, 100vw" className="min-w-0 flex-[999_1_32.5rem] rounded-t-[0.875rem] shadow-[0_18px_50px_rgba(14,26,25,0.16)]" />
        </div>
      </section>

      <section className="mx-auto flex max-w-[68.75rem] flex-wrap gap-x-16 gap-y-10 px-6 pt-24 sm:pt-28">
        <div className="min-w-0 flex-[1_1_17.5rem]">
          <h2 className="font-display text-[2.125rem] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[2.5rem]">Questions about paying</h2>
          <p className="mt-3.5 leading-relaxed text-lp-muted">
            Something else?{" "}
            <Link href="/contact" className="font-semibold text-lp-accent underline underline-offset-4">
              Ask us
            </Link>
            , we reply ourselves.
          </p>
        </div>
        <div className="min-w-0 flex-[999_1_32.5rem]">
          <FaqList items={questions} openFirst />
        </div>
      </section>

      <CtaBand
        title={price ? `${price} a month. That's it.` : "One price for every villa."}
        text={site.signup.open ? `Register now, and take your next booking in ${site.name}.` : "Get in touch and we'll help you get started."}
        primary={primary}
        secondary={{ href: "/contact", label: "Talk to us" }}
      />
    </SitePage>
  );
}
