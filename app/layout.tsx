import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/space-grotesk/wght.css";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  // Lets the share image (app/opengraph-image.png) use the site's full address.
  metadataBase: process.env.APP_URL ? new URL(process.env.APP_URL) : undefined,
  title: "LankaStay",
  description: "Bookings, guests and expenses for small villas in Sri Lanka.",
  applicationName: "LankaStay",
  // The app behind sign-in stays out of search results. Public pages (home, features,
  // pricing, about, contact, register) switch this on with pageMeta() in lib/server/seo.ts.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
