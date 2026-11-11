// Server settings, read from environment variables (.env.local in development).

export const config = {
  db: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "villa_management",
  },
  /** The first Super Admin, created when the database is empty. */
  superAdmin: {
    name: process.env.SUPER_ADMIN_NAME ?? "Platform Admin",
    email: (process.env.SUPER_ADMIN_EMAIL ?? "admin@villaplatform.lk").toLowerCase(),
    password: process.env.SUPER_ADMIN_PASSWORD ?? "superadmin2026",
  },
  /** Fill a new database with three sample villas. Set SEED_DEMO=false for a clean production start. */
  seedDemo: (process.env.SEED_DEMO ?? "true") !== "false",
  /** Dates such as "today" are worked out in this time zone. */
  timeZone: process.env.APP_TIMEZONE ?? "Asia/Colombo",
  production: process.env.NODE_ENV === "production",
  /** Session cookies are HTTPS-only in production. Set COOKIE_SECURE=false only when serving production over plain http for a test. */
  secureCookies: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE !== "false" : process.env.NODE_ENV === "production",
  /** The site's own address, used for the page Dodo sends a villa back to after paying. Falls back to the address of the request. */
  appUrl: (process.env.APP_URL ?? "").replace(/\/+$/, ""),
  /** The public website, a separate project (e.g. https://lankastay.com). Its forms may post to the app. */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, ""),
  /** Encrypts secrets kept in the database (the SMTP password). Any long random string; keep it the same once set. */
  appSecret: process.env.APP_SECRET ?? "",
  /** Protects the scheduled jobs (/api/cron/...). Vercel sends it as "Authorization: Bearer <CRON_SECRET>". */
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Card payments for villa subscriptions. Leave DODO_PAYMENTS_API_KEY empty and card payments stay switched off. */
  dodo: {
    apiKey: process.env.DODO_PAYMENTS_API_KEY ?? "",
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "",
    /** test_mode (default) or live_mode. Test and live have separate keys, products and customers. */
    mode: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? ("live_mode" as const) : ("test_mode" as const),
    /** Only for automated tests against a stand-in server. */
    baseUrl: (process.env.DODO_PAYMENTS_BASE_URL ?? "").replace(/\/+$/, ""),
    currency: "LKR",
    /** Customers are billed with a Sri Lankan billing country, so prices stay in LKR. */
    country: "LK",
  },
  /** Uploaded files (expense and bill receipts) go to a DigitalOcean Space. Leave the keys empty and uploads stay switched off. */
  storage: {
    accessKey: process.env.DO_ACCESS_KEY_ID ?? "",
    secretKey: process.env.DO_SECRET_ACCESS_KEY ?? "",
    region: process.env.DO_DEFAULT_REGION || "sfo3",
    /** The Space (bucket) name */
    space: process.env.DO_SPACE ?? "",
    /** https://sfo3.digitaloceanspaces.com, or the Space's own address (https://<space>.sfo3.digitaloceanspaces.com); both work */
    endpoint: (process.env.DO_ENDPOINT ?? "").replace(/\/+$/, ""),
    /** The folder inside the Space that all of this app's uploads go into */
    folder: (process.env.DO_FOLDER || "Bills").replace(/^\/+|\/+$/g, ""),
  },
};

export const storageEnabled = () => !!(config.storage.accessKey && config.storage.secretKey && config.storage.space && config.storage.endpoint);

export const dodoEnabled = () => config.dodo.apiKey !== "" && config.dodo.webhookKey !== "";

/** A Dodo timestamp ("2026-11-06T04:00:00Z") as a date (YYYY-MM-DD) in the app's time zone. */
export function isoToLocalDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** Today's date (YYYY-MM-DD) in the app's time zone. */
export function serverToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** A UTC timestamp in MySQL DATETIME form. */
export function nowSql(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 19).replace("T", " ");
}

/** MySQL DATETIME (stored as UTC) to an ISO string the browser can format. */
export function sqlToIso(value: string | null) {
  return value ? `${value.replace(" ", "T")}Z` : null;
}

/** The free trial new sign-ups get until the Super Admin changes it (Settings → Subscription). */
export const DEFAULT_TRIAL_DAYS = 30;
