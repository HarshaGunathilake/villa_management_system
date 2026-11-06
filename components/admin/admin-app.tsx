"use client";

import { BrandMark, Wordmark } from "@/components/brand";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, Building2, Check, CreditCard, LayoutDashboard, LogOut, Settings, ShieldCheck } from "lucide-react";
import { ServerUnavailable } from "@/components/access-screens";
import { AdminProvider, useAdmin } from "@/lib/admin-store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/villas", label: "Villas", icon: Building2 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminApp({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminFrame>{children}</AdminFrame>
    </AdminProvider>
  );
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { access, data, error, refresh, signOut, toast } = useAdmin();
  const onLogin = pathname === "/admin/login";

  useEffect(() => {
    if (access === "signed_out" && !onLogin) router.replace("/admin/login");
    if (access === "ok" && onLogin) router.replace("/admin");
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
  if (onLogin) return <>{access === "signed_out" ? children : null}{toastEl}</>;
  if (access !== "ok" || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 pt-10" aria-busy="true" aria-label="Loading">
        <div className="h-10 w-64 rounded-xl bg-well" />
        <div className="h-40 rounded-2xl bg-well/70" />
      </div>
    );
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar: darker than the villa app, so it is always clear this is the platform side */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-ink px-4 py-6 text-white lg:flex">
        <Link href="/admin" className="rounded-xl px-3 py-1">
          <div className="flex items-center gap-2.5">
            <BrandMark variant="bare" roof="#252525" className="size-8" />
            <Wordmark name={data.settings.platformName} className="text-lg leading-tight" accentClassName="text-[#8fd3b4]" />
          </div>
          <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/65">
            <ShieldCheck className="size-4" /> Super Admin
          </div>
        </Link>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Super Admin">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white",
                isActive(item.href) && "bg-white/12 text-white",
              )}
            >
              <item.icon className={cn("size-5", isActive(item.href) && "text-brass")} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/15 pt-4">
          <div className="px-3 text-sm">
            <div className="truncate font-medium">{data.me.name}</div>
            <div className="truncate text-white/60">{data.me.email}</div>
          </div>
          <button type="button" onClick={() => void signOut()} className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 font-medium text-white/70 hover:bg-white/10 hover:text-white">
            <LogOut className="size-5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Phones and tablets: a top bar with the same links */}
      <header className="sticky top-0 z-30 bg-ink text-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BrandMark variant="bare" roof="#252525" className="size-6" />
              <Wordmark name={data.settings.platformName} className="truncate" accentClassName="text-[#8fd3b4]" />
            </div>
            <div className="text-xs text-white/65">Super Admin</div>
          </div>
          <button type="button" onClick={() => void signOut()} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Sign out">
            <LogOut className="size-5" />
          </button>
        </div>
        <nav aria-label="Super Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pt-1 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn("flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[0.9375rem] font-medium text-white/70", isActive(item.href) && "bg-white/15 text-white")}
            >
              <item.icon className="size-4" /> {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[76rem] px-4 pt-6 pb-16 sm:px-8 sm:pt-10">{children}</main>
      {toastEl}
    </div>
  );
}
