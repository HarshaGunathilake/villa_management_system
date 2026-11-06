import Link from "next/link";
import { cn } from "@/lib/utils";

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-accent";
export const kicker = "text-[0.9375rem] font-semibold text-lp-accent";
export const h1 = "font-display text-[2.75rem] leading-[1.02] font-bold tracking-[-0.04em] sm:text-[4rem]";
export const h2 = "font-display text-[2.125rem] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[2.75rem]";
export const lead = "text-lg leading-relaxed text-lp-muted sm:text-[1.1875rem]";

export function Arrow({ className = "size-[1.125rem]" }: { className?: string }) {
  return (
    <svg className={cn(className, "transition-transform duration-200 group-hover:translate-x-0.5")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function Check({ className = "size-[1.375rem] text-lp-accent" }: { className?: string }) {
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** The main button: Register, or Open dashboard when signed in, or Sign in when sign-ups are closed. */
export function primaryAction(site: { signedIn: boolean; signup: { open: boolean } }) {
  return site.signedIn ? { href: "/dashboard", label: "Open dashboard" } : site.signup.open ? { href: "/register", label: "Register your villa" } : { href: "/login", label: "Sign in" };
}

export function PrimaryButton({ href, label, tone = "accent", className }: { href: string; label: string; tone?: "accent" | "white" | "ink"; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex min-h-[3.25rem] items-center justify-center gap-2.5 rounded-xl px-[1.625rem] font-semibold transition-colors duration-200 active:translate-y-px",
        tone === "accent" && "bg-lp-accent text-white hover:bg-lp-accent-deep",
        tone === "white" && "bg-white text-lp-ink hover:bg-lp-accent-soft",
        tone === "ink" && "bg-lp-ink text-white hover:bg-lp-accent",
        focusRing,
        className,
      )}
    >
      {label} <Arrow />
    </Link>
  );
}

export function SecondaryButton({ href, label, onDark, className }: { href: string; label: string; onDark?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-[3.25rem] items-center justify-center rounded-xl border px-6 font-semibold transition-colors duration-200",
        onDark ? "border-white/45 text-white hover:bg-white/10" : "border-[#c9d2cf] bg-white text-lp-ink hover:border-lp-ink",
        focusRing,
        className,
      )}
    >
      {label}
    </Link>
  );
}

/** The green band at the bottom of each page. */
export function CtaBand({ title, text, primary, secondary }: { title: string; text: string; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <section className="mx-auto max-w-[75rem] px-6 py-24 sm:py-28">
      <div className="flex flex-wrap items-center justify-between gap-7 rounded-[1.75rem] bg-lp-accent p-8 text-white sm:p-14">
        <div className="min-w-0 flex-[1_1_26rem]">
          <h2 className="font-display text-[2rem] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[2.5rem]">{title}</h2>
          <p className="mt-3 text-[1.0625rem] text-lp-accent-soft">{text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PrimaryButton href={primary.href} label={primary.label} tone="white" />
          {secondary ? <SecondaryButton href={secondary.href} label={secondary.label} onDark /> : null}
        </div>
      </div>
    </section>
  );
}
