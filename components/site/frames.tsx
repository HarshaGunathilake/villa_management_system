import Image from "next/image";
import { cn } from "@/lib/utils";

/*
 * Real screenshots of the app (public/site/*.webp, taken with sample data),
 * shown in a plain browser window or a phone.
 */

export const SHOTS = {
  dashboard: { src: "/site/d-dashboard.webp", w: 2880, h: 1800, alt: "The home screen: check-ins, check-outs, guests staying and rooms free tonight, with each room's status" },
  calendar: { src: "/site/d-calendar.webp", w: 2880, h: 1800, alt: "The calendar: rooms down the side, days across, bookings shown as blocks" },
  booking: { src: "/site/d-booking.webp", w: 2880, h: 1800, alt: "A booking open beside the list: guest, stay dates, total, paid and balance" },
  document: { src: "/site/d-document.webp", w: 2880, h: 1800, alt: "A printable booking confirmation with the guest, stay and amounts" },
  expenses: { src: "/site/d-expenses.webp", w: 2880, h: 1800, alt: "The expenses list with a spending summary by category" },
  reports: { src: "/site/d-reports.webp", w: 2880, h: 1800, alt: "The reports page: income, expenses, profit, occupancy and a monthly chart" },
  phoneHome: { src: "/site/m-dashboard.webp", w: 1170, h: 2532, alt: "The home screen on a phone" },
  phoneCalendar: { src: "/site/m-calendar.webp", w: 1170, h: 2532, alt: "The calendar on a phone" },
  phoneReports: { src: "/site/m-reports.webp", w: 1170, h: 2532, alt: "Reports on a phone" },
  phoneBooking: { src: "/site/m-booking.webp", w: 1170, h: 2532, alt: "A booking on a phone, with the Send on WhatsApp button" },
} as const;

type Shot = (typeof SHOTS)[keyof typeof SHOTS];

export function Shot({ shot, className, sizes, priority }: { shot: Shot; className?: string; sizes: string; priority?: boolean }) {
  return <Image src={shot.src} width={shot.w} height={shot.h} alt={shot.alt} sizes={sizes} priority={priority} className={cn("block h-auto w-full", className)} />;
}

/** A laptop browser window around a screenshot. */
export function BrowserFrame({ shot, url, className, priority }: { shot: Shot; url: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-t-2xl bg-white", className)}>
      <div className="flex h-9 items-center gap-[7px] bg-[#eef1f0] px-4" aria-hidden="true">
        <span className="size-[11px] rounded-full bg-[#d4dad8]" />
        <span className="size-[11px] rounded-full bg-[#d4dad8]" />
        <span className="size-[11px] rounded-full bg-[#d4dad8]" />
        <span className="ml-4 hidden h-[22px] max-w-[22.5rem] flex-1 items-center rounded-md bg-white px-2.5 text-xs text-lp-muted sm:flex">{url}</span>
      </div>
      <Shot shot={shot} sizes="(min-width: 1240px) 1144px, 100vw" priority={priority} />
    </div>
  );
}

/** A phone around a screenshot. */
export function PhoneFrame({ shot, className, dark, sizes = "240px", priority }: { shot: Shot; className?: string; dark?: boolean; sizes?: string; priority?: boolean }) {
  return (
    <div className={cn("rounded-[2.25rem] p-[9px]", dark ? "border border-lp-night-line bg-[#0a1211]" : "bg-lp-ink", className)}>
      <Shot shot={shot} sizes={sizes} priority={priority} className="rounded-[1.75rem]" />
    </div>
  );
}
