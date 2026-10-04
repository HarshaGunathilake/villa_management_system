"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { EmptyState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { guestCount } from "@/lib/availability";
import { fmtDayWeek, fmtFull, nightsBetween } from "@/lib/dates";
import { bookingNumber } from "@/lib/documents";
import { useLookups, useStore } from "@/lib/store";
import { extrasTotal, money, plural } from "@/lib/utils";

export default function DocumentPage() {
  return (
    <Suspense fallback={null}>
      <BookingDocument />
    </Suspense>
  );
}

/**
 * One printable page for both documents:
 *  - "confirmation": the receipt given when a booking is made
 *  - "invoice": the final bill given at check-out
 * "Print or save as PDF" uses the browser's own print dialog.
 */
function BookingDocument() {
  const router = useRouter();
  const params = useSearchParams();
  const { bookings, villa, today } = useStore();
  const { guest, placeName, checkInTime, checkOutTime } = useLookups();

  const index = bookings.findIndex((b) => b.id === params.get("b"));
  const booking = bookings[index];
  const isInvoice = params.get("kind") === "invoice";

  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title="Booking not found" action={<Button onClick={() => router.push("/bookings")}>Go to bookings</Button>}>
          This document belongs to a booking that is no longer here.
        </EmptyState>
      </div>
    );
  }

  const g = guest(booking.guestId);
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const extras = booking.extras ?? [];
  const stayAmount = booking.total - extrasTotal(extras);
  const balance = booking.total - booking.paid;
  const number = `${isInvoice ? "INV" : "BK"}-${bookingNumber(index)}`;
  const issued = isInvoice ? booking.checkedOutOn ?? today : booking.createdAt || today;
  const cancelled = booking.status === "cancelled";

  const lines = [
    { name: `${placeName(booking)}, ${plural(nights, "night")}`, qty: nights, price: nights > 0 ? Math.round(stayAmount / nights) : stayAmount, amount: stayAmount },
    ...extras.map((e) => ({ name: e.name, qty: e.qty, price: e.price, amount: e.price * e.qty })),
  ];

  return (
    <div className="min-h-dvh bg-well/60 px-4 py-6 sm:py-10 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-5 flex max-w-[50rem] flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => router.push("/bookings")}>
          <ArrowLeft /> Back to bookings
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Print or save as PDF
        </Button>
      </div>

      <article className="mx-auto max-w-[50rem] rounded-card border border-line bg-white p-6 shadow-card sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight sm:text-3xl">{villa.name}</div>
            <div className="mt-1 text-muted">{villa.location}</div>
            <div className="text-muted">{villa.phone}</div>
          </div>
          <div className="sm:text-right">
            <h1 className="text-2xl font-semibold sm:text-3xl">{isInvoice ? "Invoice" : "Booking confirmation"}</h1>
            <div className="tnum mt-1 font-medium">{number}</div>
            <div className="text-muted">{fmtFull(issued)}</div>
            {cancelled ? <div className="mt-1 font-semibold text-clay">This booking was cancelled</div> : null}
          </div>
        </header>

        <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-sm font-medium text-muted">{isInvoice ? "Billed to" : "Guest"}</h2>
            <div className="text-lg font-semibold">{g?.name}</div>
            <div>{g?.phone}</div>
            {g?.email ? <div className="break-all">{g.email}</div> : null}
            {g?.country ? <div>{g.country}</div> : null}
          </div>
          <div>
            <h2 className="mb-1 text-sm font-medium text-muted">Stay</h2>
            <div className="text-lg font-semibold">{placeName(booking)}</div>
            <div>
              Check-in {fmtDayWeek(booking.checkIn)}, from {checkInTime(booking)}
            </div>
            <div>
              Check-out {fmtDayWeek(booking.checkOut)}, by {checkOutTime(booking)}
            </div>
            <div>
              {plural(nights, "night")}, {plural(guestCount(booking), "guest")}
            </div>
          </div>
        </section>

        <section className="py-6">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="hidden pb-2 text-right font-medium sm:table-cell print:table-cell">Price</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-line/70 align-top">
                  <td className="py-3 pr-3 font-medium">{l.name}</td>
                  <td className="py-3 text-right">{l.qty}</td>
                  <td className="hidden py-3 text-right sm:table-cell print:table-cell">{money(l.price)}</td>
                  <td className="py-3 text-right font-medium whitespace-nowrap">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="tnum mt-5 ml-auto max-w-xs space-y-1.5">
            <div className="flex justify-between gap-6">
              <span className="text-muted">Total</span>
              <span className="font-semibold">{money(booking.total)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-muted">Paid</span>
              <span className="font-medium">{money(booking.paid)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-6 border-t border-line pt-2">
              <span className="font-medium">{balance > 0 ? (isInvoice ? "Balance due" : "Balance to pay") : "Balance"}</span>
              <span className="text-2xl font-semibold">{money(Math.max(balance, 0))}</span>
            </div>
            <div className={`pt-1 text-right font-semibold ${balance > 0 ? "text-amber-deep" : "text-sage-deep"}`}>
              {balance > 0 ? (booking.paid > 0 ? "Partially paid" : "Not paid yet") : "Paid in full"}
            </div>
          </div>
        </section>

        {booking.notes && !isInvoice ? (
          <section className="border-t border-line py-5">
            <h2 className="mb-1 text-sm font-medium text-muted">Special requests</h2>
            <p className="whitespace-pre-wrap">{booking.notes}</p>
          </section>
        ) : null}

        <footer className="border-t border-line pt-5 text-muted">
          {isInvoice ? (
            <p>Thank you for staying at {villa.name}. We hope to welcome you back.</p>
          ) : (
            <p>
              Your booking is confirmed. Check-in is from {checkInTime(booking)} and check-out is by {checkOutTime(booking)}. For any
              changes, call {villa.phone}.
            </p>
          )}
          <p className="mt-1 text-sm">Booked through {booking.source}</p>
        </footer>
      </article>
    </div>
  );
}
