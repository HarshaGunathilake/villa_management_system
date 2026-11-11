"use client";

import { BrandMark, Wordmark } from "@/components/brand";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, Building2, Check, ChevronRight, CreditCard, ExternalLink, Globe, LayoutDashboard, LogOut, Settings, ShieldCheck, Wallet } from "lucide-react";
import { fmtLong } from "@/lib/dates";
import { ServerUnavailable } from "@/components/access-screens";
import { AdminProvider, useAdmin } from "@/lib/admin-store";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/site-url";

const NAV = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/villas", label: "Villas", icon: Building2 },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/admin/payments", label: "Payments", icon: Wallet },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/activity", label: "Activity", icon: Activity },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminApp({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminFrame>{children}</AdminFrame>
    </AdminProvider>
  );
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  // The console theme is set on <html> so dialogs and sheets (in portals) use it too.
  useEffect(() => {
    document.documentElement.classList.add("admin-theme");
    return () => document.documentElement.classList.remove("admin-theme");
  }, []);
  const pathname = usePathname();
  const router = useRouter();
  const { access, data, error, refresh, signOut, toast } = useAdmin();
  const onLogin = pathname === "/admin/login";

  useEffect(() => {
    if (access === "signed_out" && !onLogin) router.replace("/admin/login");
    if (access === "ok" && onLogin) {
      router.replace("/admin");
      // If the in-page switch doesn't happen (seen through tunnels such as ngrok), load the console the ordinary way.
      const fallback = setTimeout(() => {
        if (window.location.pathname === "/admin/login") window.location.replace("/admin");
      }, 2000);
      return () => clearTimeout(fallback);
    }
  }, [access, onLogin, router]);

  const toastEl = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-4">
      {toast ? (
        <div className="anim-toast flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-medium text-white shadow-float">
          <Check className="size-5 text-[#a9d3b8]" /> {toast}
        </div>
      ) : null}
    </div>
  );

  if (access === "error") return <ServerUnavailable message={error} onRetry={() => void refresh()} />;
  // The form is in the page from the first byte; only an already signed-in admin is sent on to the console.
  if (onLogin) {
    return (
      <>
        {access === "ok" ? (
          <div className="grid min-h-dvh place-items-center px-5 text-lg text-muted" role="status" aria-live="polite">
            Opening the console…
          </div>
        ) : (
          children
        )}
        {toastEl}
      </>
    );
  }
  if (access !== "ok" || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 pt-10" aria-busy="true" aria-label="Loading">
        <div className="h-10 w-64 rounded-xl bg-well" />
        <div className="h-40 rounded-2xl bg-well/70" />
      </div>
    );
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const initials = data.me.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // Small counts beside the menu items that need a look.
  const counts: Record<string, number> = {
    "/admin/villas": data.villas.filter((v) => v.disabledReason === "unpaid").length,
    "/admin/subscriptions": data.villas.filter((v) => v.card.status === "on_hold" || v.card.status === "past_due").length,
  };
  const current = NAV.flatMap((g) => g.items).find((i) => isActive(i.href));

  return (
    <div className="min-h-dvh lg:pl-[17rem]">
      {/* Sidebar: the deep lagoon night of the brand, so it is always clear this is the platform side */}
      <aside className="fixed inset-y-0 left-0 hidden w-[17rem] flex-col border-r border-white/5 bg-[#0b1615] px-4 pt-6 pb-4 text-white lg:flex">
        <Link href="/admin" className="flex items-center gap-2.5 rounded-xl px-2 py-1">
          <BrandMark className="size-9" />
          <span className="min-w-0">
            <Wordmark name={data.settings.platformName} className="block text-lg leading-tight" accentClassName="text-[#8fd3b4]" />
            <span className="block text-xs font-medium tracking-wide text-white/50 uppercase">Console</span>
          </span>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-6 overflow-y-auto" aria-label="Super Admin">
          {NAV.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-white/40 uppercase">{group.label}</div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const count = counts[item.href] ?? 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white",
                        active && "bg-white/[0.08] text-white",
                      )}
                    >
                      {active ? <span aria-hidden className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-[#8fd3b4]" /> : null}
                      <item.icon className={cn("size-[1.125rem]", active ? "text-[#8fd3b4]" : "text-white/45")} />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 ? (
                        <span className="tnum min-w-6 rounded-full bg-[#f2b35e] px-1.5 text-center text-xs leading-5 font-semibold text-[#2a1a05]" aria-label={`${count} need a look`}>
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <a
          href={SITE_URL || "/"}
          target="_blank"
          rel="noreferrer"
          className="mb-3 flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium text-white/65 hover:bg-white/[0.06] hover:text-white"
        >
          <Globe className="size-[1.125rem] text-white/45" /> View website <ExternalLink className="ml-auto size-3.5 text-white/40" aria-hidden />
        </a>
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0b5d50] text-sm font-semibold text-white" aria-hidden>
            {initials}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-medium">{data.me.name}</span>
            <span className="flex items-center gap-1 truncate text-white/50">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden /> Super Admin
            </span>
          </span>
          <button type="button" onClick={() => void signOut()} className="grid size-10 shrink-0 place-items-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white" aria-label="Sign out">
            <LogOut className="size-[1.125rem]" />
          </button>
        </div>
      </aside>

      {/* Phones and tablets: a top bar with the same links */}
      <header className="sticky top-0 z-30 bg-[#0b1615] text-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark className="size-7" />
            <Wordmark name={data.settings.platformName} className="truncate" accentClassName="text-[#8fd3b4]" />
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-white/70 uppercase">Console</span>
          </div>
          <button type="button" onClick={() => void signOut()} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Sign out">
            <LogOut className="size-5" />
          </button>
        </div>
        <nav aria-label="Super Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pt-2 pb-2.5">
          {NAV.flatMap((g) => g.items).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[0.9375rem] font-medium text-white/65",
                isActive(item.href) && "bg-[#8fd3b4] text-[#0b1615]",
              )}
            >
              <item.icon className="size-4" /> {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Desktop: a slim bar with where you are */}
      <div className="sticky top-0 z-20 hidden border-b border-line bg-sand/85 backdrop-blur lg:block">
        <div className="mx-auto flex h-14 max-w-[80rem] items-center gap-2 px-8 text-sm">
          <span className="text-muted">Console</span>
          <ChevronRight className="size-4 text-line-strong" aria-hidden />
          <span className="font-medium">{current?.label ?? "Dashboard"}</span>
          <span className="ml-auto text-muted">{fmtLong(data.today)}</span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[80rem] px-4 pt-6 pb-16 sm:px-8 sm:pt-8">{children}</main>
      {toastEl}
    </div>
  );
}
