/*
 * Search engines and answer engines (Google, Bing, ChatGPT, Perplexity …):
 * the site's own address, and structured data (JSON-LD) describing it.
 */

/** The public address, without a trailing slash. Set APP_URL in production. */
export function siteUrl() {
  const raw = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export const SITE_DESCRIPTION =
  "Villa booking and management software for Sri Lanka: one calendar for the whole villa or single rooms, guests, payments, receipts on WhatsApp, expenses and reports.";

/** The public pages, for the sitemap and robots.txt. */
export const PUBLIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/about", priority: 0.6, changeFrequency: "yearly" as const },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" as const },
  { path: "/register", priority: 0.7, changeFrequency: "yearly" as const },
];

export function organization(site: { name: string; email: string; phone: string }) {
  const url = siteUrl();
  return {
    "@type": "Organization",
    "@id": `${url}/#organization`,
    name: site.name,
    url,
    logo: `${url}/icon.svg`,
    areaServed: { "@type": "Country", name: "Sri Lanka" },
    ...(site.email || site.phone
      ? {
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              ...(site.email ? { email: site.email } : {}),
              ...(site.phone ? { telephone: site.phone } : {}),
              areaServed: "LK",
              availableLanguage: ["English"],
            },
          ],
        }
      : {}),
  };
}

export function softwareApp(site: { name: string; signup: { monthlyAmount: number } }) {
  const url = siteUrl();
  return {
    "@type": "SoftwareApplication",
    "@id": `${url}/#software`,
    name: site.name,
    url,
    description: SITE_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Property management system",
    operatingSystem: "Web browser, Android, iOS, Windows, macOS",
    publisher: { "@id": `${url}/#organization` },
    featureList: [
      "Booking calendar for the entire villa or single rooms",
      "Double-booking prevention",
      "Guest records and stay history",
      "Advance payments, extras and balances",
      "Booking confirmations and invoices, printable or as PDF",
      "Send receipts to guests on WhatsApp",
      "Expenses by category",
      "Income, expense, profit and occupancy reports",
      "CSV export",
    ],
    ...(site.signup.monthlyAmount > 0
      ? {
          offers: {
            "@type": "Offer",
            price: site.signup.monthlyAmount,
            priceCurrency: "LKR",
            url: `${url}/pricing`,
            category: "Subscription",
            priceSpecification: { "@type": "UnitPriceSpecification", price: site.signup.monthlyAmount, priceCurrency: "LKR", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } },
          },
        }
      : {}),
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  const url = siteUrl();
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${url}${it.path === "/" ? "" : it.path}` })),
  };
}

export function faqPage(faq: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function webPage(type: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage", path: string, name: string, description: string) {
  const url = siteUrl();
  return { "@type": type, "@id": `${url}${path}#webpage`, url: `${url}${path}`, name, description, isPartOf: { "@id": `${url}/#website` }, about: { "@id": `${url}/#software` }, inLanguage: "en" };
}

const SHARE_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "LankaStay: villa bookings, guests and money" };

/** Metadata for a public page: its canonical address, share cards, and whether search engines may index it. */
export function pageMeta(o: { siteName: string; title: string; description: string; path: string; index: boolean }) {
  return {
    title: o.title,
    description: o.description,
    alternates: { canonical: o.path },
    // Super Admin → Settings → Website can keep the whole site out of search results.
    robots: o.index
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" as const, "max-snippet": -1 } }
      : { index: false, follow: false },
    // Pages that set their own openGraph don't inherit app/opengraph-image.png, so it is named here.
    openGraph: { title: o.title, description: o.description, url: o.path, siteName: o.siteName, type: "website" as const, locale: "en_LK", images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image" as const, title: o.title, description: o.description, images: [SHARE_IMAGE.url] },
  };
}

export function website(site: { name: string }) {
  const url = siteUrl();
  return { "@type": "WebSite", "@id": `${url}/#website`, name: site.name, url, publisher: { "@id": `${url}/#organization` }, inLanguage: "en" };
}
