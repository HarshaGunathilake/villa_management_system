"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
];

/** The website's top bar: the pages, Sign in, and Register as the main button. */
export function LandingNav({ platform, signedIn, signupsOpen }: { platform: string; signedIn: boolean; signupsOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = "inline-flex min-h-11 items-center justify-center rounded-[0.625rem] bg-lp-ink px-[1.125rem] text-[0.9375rem] font-semibold text-white transition-colors duration-200 hover:bg-lp-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-accent active:translate-y-px";

  const actions = signedIn ? (
    <Link href="/dashboard" className={solid}>Open dashboard</Link>
  ) : (
    <>
      <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-[0.625rem] px-3.5 text-[0.9375rem] font-medium transition-colors duration-200 hover:text-lp-accent">
        Sign in
      </Link>
      {signupsOpen ? <Link href="/register" className={solid}>Register</Link> : null}
    </>
  );

  return (
    <header className={cn("sticky top-0 z-40 border-b border-lp-line transition-colors duration-200", scrolled || open ? "bg-lp-ground/90 backdrop-blur-md" : "bg-lp-ground")}>
      <nav aria-label="Main" className="mx-auto flex min-h-[4.5rem] max-w-[75rem] items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <BrandMark />
          <Wordmark name={platform} className="text-[1.25rem]" />
        </Link>

        <ul className="ml-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={pathname === l.href ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center px-3 text-[0.9375rem] transition-colors duration-200 hover:text-lp-ink",
                  pathname === l.href ? "font-semibold text-lp-ink shadow-[inset_0_-2px_0_var(--color-lp-accent)]" : "text-lp-muted",
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 lg:flex">{actions}</div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          {!signedIn && signupsOpen ? <Link href="/register" className={solid}>Register</Link> : null}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid size-11 place-items-center rounded-[0.625rem] hover:bg-lp-line/60"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="landing-menu" className="border-t border-lp-line px-6 pt-2 pb-5 lg:hidden">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className={cn("flex min-h-12 items-center text-lg font-medium", pathname === l.href && "text-lp-accent")}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2">{actions}</div>
        </div>
      ) : null}
    </header>
  );
}
