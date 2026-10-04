/** Booking numbers follow the order bookings were made: BK-0001, BK-0002 ... (INV- for the invoice). */
export const bookingNumber = (index: number) => String(index + 1).padStart(4, "0");

export function documentHref(bookingId: string, kind: "invoice" | "confirmation") {
  return `/document?b=${encodeURIComponent(bookingId)}&kind=${kind}`;
}
