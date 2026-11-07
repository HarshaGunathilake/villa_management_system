import type { MetadataRoute } from "next";

/** The app stays out of search results; the public website (its own project and domain) has its own robots.txt. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
