import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { signupsHeldBack } from "@/lib/server/site";
import { SITE_URL } from "@/lib/site-url";

// Checked on every visit: it follows Super Admin → Settings → Website.
export const dynamic = "force-dynamic";

export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  // Sign-ups wait for launch while the website is "coming soon" (a signed-in Super Admin can still try them).
  if (await signupsHeldBack()) {
    return (
      <AuthPanel back={{ href: "/login", label: "Sign in" }}>
        <h1 className="text-2xl font-semibold">Sign-ups open soon</h1>
        <p className="mt-2 text-muted">We are getting ready to launch. Leave your email on our website and we will tell you the day it opens.</p>
        {SITE_URL ? (
          <Link href={SITE_URL} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-ink px-5 font-semibold text-white">
            Go to the website
          </Link>
        ) : null}
      </AuthPanel>
    );
  }
  return children;
}
