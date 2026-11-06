import Link from "next/link";
import { Wordmark } from "@/components/brand";

const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL;

/** The website's footer: the pages, sign-in, and the legal links when they are set. */
export function SiteFooter({ platform, signupsOpen }: { platform: string; signupsOpen: boolean }) {
  const link = "text-lp-night-muted transition-colors hover:text-white";
  return (
    <footer className="bg-lp-night text-lp-night-muted">
      <div className="mx-auto flex max-w-[75rem] flex-wrap gap-x-16 gap-y-10 px-6 pt-14 pb-8">
        <div className="min-w-0 flex-[1_1_17.5rem]">
          <Wordmark name={platform} className="text-[1.375rem] text-white" accentClassName="text-lp-mint" />
          <p className="mt-2.5 max-w-[18.75rem] text-[0.9375rem] leading-relaxed">Bookings, guests and money for small villas in Sri Lanka.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-16 gap-y-10 text-[0.9375rem]">
          <div className="flex flex-col gap-2.5">
            <span className="font-semibold text-white">Product</span>
            <Link href="/features" className={link}>Features</Link>
            <Link href="/pricing" className={link}>Pricing</Link>
            {signupsOpen ? <Link href="/register" className={link}>Register</Link> : null}
            <Link href="/login" className={link}>Sign in</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="font-semibold text-white">Company</span>
            <Link href="/about" className={link}>About us</Link>
            <Link href="/contact" className={link}>Contact us</Link>
            {TERMS_URL ? <a href={TERMS_URL} className={link}>Terms of Service</a> : null}
            {PRIVACY_URL ? <a href={PRIVACY_URL} className={link}>Privacy Policy</a> : null}
          </div>
        </nav>
      </div>
      <div className="mx-auto max-w-[75rem] border-t border-lp-night-line px-6 pt-5 pb-8 text-sm">
        © {new Date().getFullYear()} {platform}
      </div>
    </footer>
  );
}
