"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  CalendarDays,
  Check,
  ClipboardList,
  ConciergeBell,
  Home,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { BookingSheet } from "@/components/booking-sheet";
import { ExpenseSheet } from "@/components/expense-sheet";
import { GuestFormSheet, GuestSheet } from "@/components/guest-sheets";
import { Button } from "@/components/ui/button";
import { StoreProvider, useStore, type BookingDraft } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/guests", label: "Guests", icon: Users },
];

const MORE = [
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/rooms", label: "Rooms", icon: BedDouble },
  { href: "/amenities", label: "Amenities", icon: ConciergeBell },
  { href: "/settings", label: "Villa settings", icon: Settings },
];

export function useStartBooking() {
  const router = useRouter();
  const { setDraft, openBooking, openGuest } = useStore();
  return (draft?: BookingDraft) => {
    openBooking(null);
    openGuest(null);
    setDraft(draft ?? null);
    router.push("/bookings/new");
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Frame>{children}</Frame>
    </StoreProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, villa, toast, signedIn, signOut } = useStore();
  const startBooking = useStartBooking();
  const onLogin = pathname === "/login";

  // Nothing in the app opens without signing in first.
  useEffect(() => {
    if (!ready) return;
    if (!signedIn && !onLogin) router.replace("/login");
    if (signedIn && onLogin) router.replace("/");
  }, [ready, signedIn, onLogin, router]);

  if (onLogin) {
    return (
      <>
        {ready && !signedIn ? children : null}
        <Toast message={toast} />
      </>
    );
  }

  if (!ready || !signedIn) {
    return (
      <div className="mx-auto w-full max-w-[72rem] px-4 pt-6 sm:px-8 sm:pt-10">
        <LoadingState />
      </div>
    );
  }

  // Invoices and confirmations are shown on their own, ready to print.
  if (pathname.startsWith("/document")) {
    return (
      <>
        {children}
        <div className="no-print">
          <Toast message={toast} />
        </div>
      </>
    );
  }

  const inBookingFlow = pathname.startsWith("/bookings/new");
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const moreActive = pathname === "/more" || MORE.some((m) => isActive(m.href));
  const showFab = ["/", "/calendar", "/bookings"].includes(pathname);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar, large screens */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-card/60 px-4 py-6 lg:flex">
        <Link href="/" className="rounded-xl px-3 py-1">
          <div className="text-xl font-semibold tracking-tight">{villa.name}</div>
          <div className="text-sm text-muted">{villa.location}</div>
        </Link>
        <Button className="mt-6" block onClick={() => startBooking()} disabled={inBookingFlow}>
          <Plus /> New booking
        </Button>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          {[...NAV, ...MORE].map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium text-muted transition-colors hover:bg-well hover:text-ink",
                isActive(item.href) && "bg-well text-ink",
                i === NAV.length && "mt-4",
              )}
            >
              <item.icon className={cn("size-5", isActive(item.href) && "text-brass-deep")} />
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={signOut}
          className="mt-auto flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium text-muted transition-colors hover:bg-well hover:text-ink"
        >
          <LogOut className="size-5" /> Sign out
        </button>
      </aside>

      <main
        className={cn(
          "mx-auto w-full max-w-[72rem] px-4 pt-6 sm:px-8 sm:pt-10",
          inBookingFlow ? "pb-10" : "pb-40 lg:pb-16",
        )}
      >
        {children}
      </main>

      {/* New booking, always one tap away on phones */}
      {showFab ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 lg:hidden">
          <Button size="lg" className="pointer-events-auto shadow-float" onClick={() => startBooking()}>
            <Plus /> New booking
          </Button>
        </div>
      ) : null}

      {/* Bottom navigation, phones and tablets */}
      {!inBookingFlow ? (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {[...NAV, { href: "/more", label: "More", icon: Menu }].map((item) => {
            const active = item.href === "/more" ? moreActive : isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.8125rem] font-medium text-muted",
                  active && "text-ink",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-brass-soft text-brass-deep")}>
                  <item.icon className="size-[1.375rem]" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <BookingSheet />
      <GuestSheet />
      <GuestFormSheet />
      <ExpenseSheet />

      <Toast message={toast} />
    </div>
  );
}

function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      {message ? (
        <div className="anim-toast flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-medium text-white shadow-float">
          <Check className="size-5 text-[#a9d3b8]" /> {message}
        </div>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-64 rounded-xl bg-well" />
      <div className="h-48 rounded-2xl bg-well/70" />
      <div className="h-32 rounded-2xl bg-well/50" />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div>
        <h1 className="text-[1.875rem] leading-tight font-semibold sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-lg text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-card shadow-card", className)} {...props} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-lg font-medium">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export { MORE as MORE_LINKS };
