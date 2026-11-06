import { siteUrl } from "@/lib/server/seo";
import { loadSite } from "@/lib/server/site";
import { money } from "@/lib/utils";

/*
 * /llms.txt: a plain summary of the product for AI assistants and answer
 * engines (llmstxt.org). Price and contact details come from Settings.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const site = await loadSite();
  // Off with search indexing, and while the site is "coming soon".
  if (!site.indexable) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const url = siteUrl();
  const price = site.signup.monthlyAmount > 0 ? `${money(site.signup.monthlyAmount)} a month per villa` : "one monthly price per villa";
  const body = `# ${site.name}

> ${site.name} is online booking and management software for small villas in Sri Lanka. Owners and caretakers use it on a phone or laptop to manage the booking calendar (entire villa or single rooms), guests, payments, receipts, expenses and reports. It costs ${price}, every feature included, paid by card, with no contract.

## What it does
- Booking calendar for the whole villa or one room at a time; double bookings are blocked (an entire-villa booking blocks every room, and a room booking blocks the entire villa for those nights).
- Check-in and check-out times per villa, changeable per booking; changeover days are checked.
- Guest records with stay history; bookings from Booking.com, Airbnb, WhatsApp, phone or direct are recorded by hand (there is no automatic channel sync).
- Advances, extras (amenities such as meals or airport pickups) and balances on each booking; check-out is blocked while money is owed.
- Booking confirmations and invoices to print or save as PDF, and to send to the guest on WhatsApp.
- Expenses by category; reports of income, expenses, profit and occupancy by month, by room and by booking source; CSV export.
- Works in any web browser; nothing to install. Prices are in Sri Lankan rupees (LKR).

## Getting started
Register online, confirm the email address, pay the first month by card (through Dodo Payments) and the villa opens straight away. A short guide shows new owners around.

## Pages
- [Features](${url}/features): the calendar, bookings and payments, receipts, expenses and reports, with screenshots
- [Pricing](${url}/pricing): ${price}, what is included, and payment questions
- [About us](${url}/about): who it is for and why it was made
- [Contact us](${url}/contact): ${[site.email, site.phone].filter(Boolean).join(", ") || "contact form"}
- [Register](${url}/register): create a villa account
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
