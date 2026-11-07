import { route } from "@/lib/server/http";
import { publicSite } from "@/lib/server/site";

/** Public: what the website (lankastay.com) shows. Read by the website's server; nothing private in it. */
export const GET = route(async () => ({ ok: true, site: await publicSite() }));
