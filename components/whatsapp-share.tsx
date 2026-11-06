"use client";

import { MessageCircle } from "lucide-react";
import { guestCount } from "@/lib/availability";
import { fmtDayWeek, nightsBetween } from "@/lib/dates";
import { bookingNumber } from "@/lib/documents";
import { useLookups, useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { cn, extrasTotal, money, plural } from "@/lib/utils";

/*
 * "Share on WhatsApp": opens WhatsApp with the booking written out as a
 * message, addressed to the guest's number when there is one. Nothing is sent
 * until the owner presses send in WhatsApp.
 */

/** A phone number as WhatsApp wants it: digits only, with the country code. Local Sri Lankan numbers (07…) get 94. */
export function whatsappNumber(phone: string | undefined) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `94${digits.slice(1)}`;
  else if (digits.length === 9 && digits.startsWith("7")) digits = `94${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function useBookingMessage(booking: Booking, kind: "confirmation" | "invoice") {
  const { bookings, villa } = useStore();
  const { guest, placeName, checkInTime, checkOutTime } = useLookups();
  const g = guest(booking.guestId);
  const index = bookings.findIndex((b) => b.id === booking.id);
  const number = `${kind === "invoice" ? "INV" : "BK"}-${bookingNumber(Math.max(index, 0))}`;
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const extras = booking.extras ?? [];
  const balance = Math.max(booking.total - booking.paid, 0);
  const first = g?.name.split(/\s+/)[0] ?? "";

  const lines = [
    kind === "invoice"
      ? `Hello${first ? ` ${first}` : ""}, thank you for staying at ${villa.name}. Here is your invoice.`
      : booking.status === "cancelled"
        ? `Hello${first ? ` ${first}` : ""}, your booking at ${villa.name} has been cancelled.`
        : `Hello${first ? ` ${first}` : ""}, your booking at ${villa.name} is confirmed.`,
    "",
    `*${kind === "invoice" ? "Invoice" : "Booking"} ${number}*`,
    `Stay: ${placeName(booking)}`,
    `Check-in: ${fmtDayWeek(booking.checkIn)}, from ${checkInTime(booking)}`,
    `Check-out: ${fmtDayWeek(booking.checkOut)}, by ${checkOutTime(booking)}`,
    `${plural(nights, "night")}, ${plural(guestCount(booking), "guest")}`,
    ...(extras.length > 0 ? ["", ...extras.map((e) => `${e.name}${e.qty > 1 ? ` x${e.qty}` : ""}: ${money(e.price * e.qty)}`)] : []),
    "",
    ...(extras.length > 0 ? [`Stay: ${money(booking.total - extrasTotal(extras))}`] : []),
    `*Total: ${money(booking.total)}*`,
    `Paid: ${money(booking.paid)}`,
    balance > 0 ? `*Balance to pay: ${money(balance)}*` : "Paid in full. Thank you!",
    "",
    kind === "invoice" ? "We hope to welcome you back." : `For any changes, call ${villa.phone || "us"}.`,
    `${villa.name}${villa.location ? `, ${villa.location}` : ""}`,
  ];

  const to = whatsappNumber(g?.phone);
  const text = lines.join("\n");
  return { text, to, href: `https://wa.me/${to ?? ""}?text=${encodeURIComponent(text)}` };
}

export function WhatsAppShareButton({ booking, kind, className, size = "lg" }: { booking: Booking; kind: "confirmation" | "invoice"; className?: string; size?: "md" | "lg" }) {
  const { href, to } = useBookingMessage(booking, kind);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d7a4a] px-5 font-medium text-white transition-colors hover:bg-[#166339] [&_svg]:size-5 [&_svg]:shrink-0",
        size === "lg" ? "min-h-14 text-[1.0625rem]" : "min-h-12",
        className,
      )}
    >
      <MessageCircle aria-hidden />
      <span>{to ? "Send on WhatsApp" : "Share on WhatsApp"}</span>
      <span className="sr-only">(opens WhatsApp)</span>
    </a>
  );
}
