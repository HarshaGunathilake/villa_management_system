/** The public website, a separate project on its own domain (e.g. https://lankastay.com). Empty when not set. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
