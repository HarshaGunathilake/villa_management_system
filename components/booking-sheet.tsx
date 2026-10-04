"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { documentHref } from "@/lib/documents";
import { AlertCircle, ArrowRight, CheckCircle2, FileText, LogIn, LogOut, Pencil, Phone, Plus, Wallet } from "lucide-react";
import { Avatar, PlaceIcon, StatusBadge } from "@/components/booking-bits";
import { PaymentBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip, Field, Input, MoneyInput, Stepper, Textarea } from "@/components/ui/field";
import { ExtrasPicker } from "@/components/extras";
import { StayTimes, type StayTimesValue } from "@/components/stay-times";
import { Sheet } from "@/components/ui/sheet";
import { bookingPhase, guestCount, paymentStatus, type Availability } from "@/lib/availability";
import { fmtDayWeek, fmtRange, nightsBetween } from "@/lib/dates";
import { useLookups, useStore } from "@/lib/store";
import { SOURCES, type Booking, type BookingExtra } from "@/lib/types";
import { extrasTotal, money, plural, uid } from "@/lib/utils";

type View = "details" | "edit" | "checkout";

export function BookingSheet() {
  const { openBookingId, openBooking, bookings, checkoutIntent } = useStore();
  const booking = bookings.find((b) => b.id === openBookingId);
  const [chosen, setChosen] = useState<View | null>(null);
  // Opened from a "Check out" button elsewhere, the sheet starts on the check-out screen.
  const view: View = chosen ?? (checkoutIntent && booking?.status === "checked_in" ? "checkout" : "details");

  const close = (open: boolean) => {
    if (!open) {
      openBooking(null);
      setChosen(null);
    }
  };

  return (
    <Sheet open={!!booking} onOpenChange={close} title={view === "edit" ? "Edit booking" : view === "checkout" ? "Check out" : "Booking"}>
      {booking ? (
        view === "edit" ? (
          <EditBooking key={booking.id} booking={booking} onDone={() => setChosen("details")} />
        ) : view === "checkout" ? (
          <CheckOut key={booking.id} booking={booking} onDone={() => setChosen("details")} />
        ) : (
          <BookingDetails key={booking.id} booking={booking} onEdit={() => setChosen("edit")} onCheckOut={() => setChosen("checkout")} />
        )
      ) : null}
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-muted">{label}</span>
      <span className="tnum text-right font-medium">{children}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-5">
      <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

function BookingDetails({ booking, onEdit, onCheckOut }: { booking: Booking; onEdit: () => void; onCheckOut: () => void }) {
  const { today, rooms, checkIn, cancelBooking, recordPayment, openGuest, openBooking, notify } = useStore();
  const { guest, placeName, checkInTime: inTime, checkOutTime: outTime } = useLookups();
  const router = useRouter();
  const openDocument = (kind: "invoice" | "confirmation") => {
    openBooking(null);
    router.push(documentHref(booking.id, kind));
  };
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState(0);

  const g = guest(booking.guestId);
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const balance = booking.total - booking.paid;
  const phase = bookingPhase(booking, today);
  const canCheckIn = booking.status === "confirmed" && phase !== "completed";
  const canCheckOut = booking.status === "checked_in";
  const closed = phase === "cancelled" || booking.status === "checked_out";
  const otherRooms = rooms.filter((r) => r.enabled && r.id !== booking.roomId).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge booking={booking} />
        <span className="text-sm text-muted">Booked through {booking.source}</span>
      </div>

      <Block title="Guest">
        <div className="flex items-center gap-3">
          <Avatar name={g?.name ?? "Guest"} />
          <div className="min-w-0 flex-1">
            <div className="text-xl leading-tight font-semibold">{g?.name}</div>
            {g?.phone ? (
              <a href={`tel:${g.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-muted underline-offset-4 hover:underline">
                <Phone className="size-4" /> {g.phone}
              </a>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              openBooking(null);
              openGuest(booking.guestId);
            }}
          >
            Guest details
          </Button>
        </div>
      </Block>

      <Block title="Stay">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <PlaceIcon type={booking.type} className="size-6" />
          {placeName(booking)}
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <div className="text-sm text-muted">Check-in</div>
            <div className="font-medium">{fmtDayWeek(booking.checkIn)}</div>
            <div className="text-sm text-muted">from {inTime(booking)}</div>
          </div>
          <ArrowRight className="size-5 text-line-strong" aria-hidden />
          <div className="text-right">
            <div className="text-sm text-muted">Check-out</div>
            <div className="font-medium">{fmtDayWeek(booking.checkOut)}</div>
            <div className="text-sm text-muted">by {outTime(booking)}</div>
          </div>
        </div>
        <div className="mt-3 border-t border-line pt-3 text-muted">
          {plural(nights, "night")}, {plural(guestCount(booking), "guest")}
          {booking.children > 0 ? ` (${plural(booking.adults, "adult")}, ${plural(booking.children, "child", "children")})` : ""}
        </div>
        {phase !== "cancelled" && phase !== "completed" ? (
          <p className="mt-2 text-sm text-muted">
            {booking.type === "villa"
              ? `All ${rooms.filter((r) => r.enabled).length} rooms are kept for this guest on these dates.`
              : `Only this room is taken. ${otherRooms > 0 ? "The other rooms can still be booked, but not the entire villa." : ""}`}
          </p>
        ) : null}
      </Block>

      <Block title="Payment">
        {booking.extras?.length ? (
          <div className="mb-1 border-b border-line pb-1">
            <Row label={`Stay, ${plural(nights, "night")}`}>{money(booking.total - extrasTotal(booking.extras))}</Row>
            {booking.extras.map((e) => (
              <Row key={e.amenityId} label={`${e.name} × ${e.qty}`}>
                {money(e.price * e.qty)}
              </Row>
            ))}
          </div>
        ) : null}
        <Row label="Total">{money(booking.total)}</Row>
        <Row label="Paid">{money(booking.paid)}</Row>
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-3">
          <span className="font-medium">Balance</span>
          <span className="flex items-center gap-3">
            <PaymentBadge status={paymentStatus(booking.total, booking.paid)} />
            <span className="tnum text-xl font-semibold">{money(Math.max(balance, 0))}</span>
          </span>
        </div>
        {balance > 0 && phase !== "cancelled" ? (
          paying ? (
            <div className="mt-4 space-y-3 rounded-xl bg-sand p-4">
              <Field label="Amount received">
                {(id) => <MoneyInput id={id} value={amount} onChange={(v) => setAmount(Math.min(v, balance))} autoFocus />}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Chip onClick={() => setAmount(balance)} selected={amount === balance}>
                  Full balance
                </Chip>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPaying(false)}>
                  Not now
                </Button>
                <Button
                  className="flex-1"
                  disabled={amount <= 0}
                  onClick={() => {
                    recordPayment(booking.id, amount);
                    notify("Payment recorded");
                    setPaying(false);
                    setAmount(0);
                  }}
                >
                  Save payment
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="accent" block className="mt-4" onClick={() => setPaying(true)}>
              <Wallet /> Record a payment
            </Button>
          )
        ) : null}
      </Block>

      {booking.notes ? (
        <Block title="Notes">
          <p className="whitespace-pre-wrap">{booking.notes}</p>
        </Block>
      ) : null}

      <div className={booking.status === "checked_out" ? "grid gap-2 sm:grid-cols-2" : ""}>
        {booking.status === "checked_out" ? (
          <Button size="lg" block onClick={() => openDocument("invoice")}>
            <FileText /> Invoice
          </Button>
        ) : null}
        <Button variant="secondary" size="lg" block onClick={() => openDocument("confirmation")}>
          <FileText /> Confirmation receipt
        </Button>
      </div>

      {!closed ? (
        <div className="space-y-2 pt-2">
          {canCheckIn ? (
            <Button
              size="lg"
              block
              onClick={() => {
                checkIn(booking.id);
                notify(`${g?.name ?? "Guest"} checked in`);
              }}
            >
              <LogIn /> Check in
            </Button>
          ) : null}
          {canCheckOut ? (
            <Button size="lg" block onClick={onCheckOut}>
              <LogOut /> Check out
            </Button>
          ) : null}
          <Button variant="secondary" size="lg" block onClick={onEdit}>
            <Pencil /> Edit booking
          </Button>
          {confirmCancel ? (
            <div className="rounded-card border border-clay/30 bg-clay-soft p-4">
              <p className="font-medium">Cancel this booking?</p>
              <p className="text-sm text-muted">The dates will open up again for other guests.</p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmCancel(false)}>
                  Keep booking
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    cancelBooking(booking.id);
                    notify("Booking cancelled");
                    setConfirmCancel(false);
                  }}
                >
                  Cancel booking
                </Button>
              </div>
            </div>
          ) : booking.status === "confirmed" ? (
            <Button variant="ghost" size="lg" block className="text-clay" onClick={() => setConfirmCancel(true)}>
              Cancel booking
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Check-out in one screen: add anything the guest had during the stay, see the
 * final bill, take the payment. The guest cannot be checked out while a balance remains.
 */
function CheckOut({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const router = useRouter();
  const { checkOut, setBookingExtras, recordPayment, notify, openBooking } = useStore();
  const { guestName, placeName } = useLookups();
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState(0);
  const [amount, setAmount] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const name = guestName(booking.guestId);
  const extras = booking.extras ?? [];
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const balance = booking.total - booking.paid;
  const paying = Math.min(amount ?? Math.max(balance, 0), Math.max(balance, 0));

  const addItem = () => {
    setBookingExtras(booking.id, [...extras, { amenityId: uid("x"), name: itemName.trim(), price: itemPrice, unit: "each", qty: 1 }]);
    setItemName("");
    setItemPrice(0);
    setAmount(null);
  };

  const tryCheckOut = () => {
    if (!checkOut(booking.id)) {
      setBlocked(true);
      requestAnimationFrame(() => alertRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    // Checked out: close the panel and show the invoice, ready to print or send.
    notify(`${name} checked out`);
    onDone();
    openBooking(null);
    router.push(documentHref(booking.id, "invoice"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0">
          <div className="text-xl leading-tight font-semibold">{name}</div>
          <div className="text-muted">
            {placeName(booking)}, {fmtRange(booking.checkIn, booking.checkOut)}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Anything to add?</h3>
        <p className="mb-2 text-[0.9375rem] text-muted">Add what the guest asked for during the stay. The bill updates as you go.</p>
        <ExtrasPicker
          value={extras}
          onChange={(next) => {
            setBookingExtras(booking.id, next);
            setAmount(null);
          }}
        />
        <div className="mt-3 rounded-card border border-line bg-card p-4">
          <div className="mb-2 font-medium">Something else</div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Drinks, laundry" aria-label="Item name" />
            <MoneyInput value={itemPrice} onChange={setItemPrice} aria-label="Item price" />
          </div>
          <Button variant="secondary" block className="mt-2" disabled={itemName.trim().length < 2 || itemPrice <= 0} onClick={addItem}>
            <Plus /> Add to the bill
          </Button>
        </div>
      </div>

      <Block title="Final bill">
        <Row label={`Stay, ${plural(nights, "night")}`}>{money(booking.total - extrasTotal(extras))}</Row>
        {extras.map((e) => (
          <Row key={e.amenityId} label={e.qty > 1 ? `${e.name} × ${e.qty}` : e.name}>
            {money(e.price * e.qty)}
          </Row>
        ))}
        <div className="mt-1 border-t border-line pt-1">
          <Row label="Total">{money(booking.total)}</Row>
          <Row label="Already paid">{money(booking.paid)}</Row>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-3">
          <span className="font-medium">{balance < 0 ? "To give back" : "Still to pay"}</span>
          <span className="flex items-center gap-3">
            <PaymentBadge status={paymentStatus(booking.total, booking.paid)} />
            <span className={`tnum text-2xl font-semibold ${balance > 0 ? "text-clay" : ""}`}>{money(Math.abs(balance))}</span>
          </span>
        </div>
      </Block>

      {balance > 0 ? (
        <div ref={alertRef} className={`rounded-card border p-5 ${blocked ? "border-clay/40 bg-clay-soft" : "border-line bg-card"}`}>
          {blocked ? (
            <div role="alert" className="mb-4 flex gap-3">
              <AlertCircle className="mt-0.5 size-6 shrink-0 text-clay" />
              <div>
                <p className="text-lg font-semibold">Payment needed before check-out</p>
                <p>
                  {name} still has {money(balance)} to pay. Record the full payment, then check out.
                </p>
              </div>
            </div>
          ) : null}
          <Field label="Payment received now">
            {(id) => <MoneyInput id={id} value={paying} onChange={(v) => setAmount(Math.min(v, balance))} />}
          </Field>
          <Button
            variant={blocked ? "primary" : "accent"}
            block
            className="mt-3"
            disabled={paying <= 0}
            onClick={() => {
              recordPayment(booking.id, paying);
              setAmount(null);
              if (paying >= balance) setBlocked(false);
              notify("Payment recorded");
            }}
          >
            <Wallet /> Record {money(paying)}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-card border border-sage/40 bg-sage-soft p-4 font-medium text-sage-deep">
          <CheckCircle2 className="size-6 shrink-0" /> Fully paid. Ready to check out.
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={onDone}>
          Back
        </Button>
        <Button size="lg" className="flex-1" onClick={tryCheckOut}>
          <LogOut /> Check out
        </Button>
      </div>
    </div>
  );
}

function EditBooking({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const { rooms, villa, updateBooking, notify } = useStore();
  const [place, setPlace] = useState(booking.type === "villa" ? "villa" : booking.roomId ?? "");
  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [adults, setAdults] = useState(booking.adults);
  const [children, setChildren] = useState(booking.children);
  const [source, setSource] = useState(booking.source);
  const [total, setTotal] = useState(booking.total);
  const [notes, setNotes] = useState(booking.notes);
  const [times, setTimes] = useState<StayTimesValue>({ checkInTime: booking.checkInTime, checkOutTime: booking.checkOutTime });
  const [extras, setExtras] = useState<BookingExtra[]>(booking.extras ?? []);
  const [error, setError] = useState<Extract<Availability, { ok: false }> | null>(null);

  // A booking keeps its own nightly price (it may have been agreed specially) unless it moves to a different room.
  const originalPlace = booking.type === "villa" ? "villa" : booking.roomId ?? "";
  const originalNights = nightsBetween(booking.checkIn, booking.checkOut);
  const rateFor = (p: string) =>
    p === originalPlace && originalNights > 0
      ? Math.round((booking.total - extrasTotal(booking.extras)) / originalNights)
      : p === "villa"
        ? villa.price
        : rooms.find((r) => r.id === p)?.price ?? 0;
  const rate = rateFor(place);
  const capacity = place === "villa" ? villa.maxGuests : rooms.find((r) => r.id === place)?.capacity ?? 2;
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  // Keep the total in step with the nightly price whenever the room or dates change.
  const reprice = (nextPlace: string, a: string, b: string) => {
    const r = rateFor(nextPlace);
    const n = a && b ? nightsBetween(a, b) : 0;
    if (n > 0) setTotal(r * n + extrasTotal(extras));
    setError(null);
  };

  const save = () => {
    const result = updateBooking(booking.id, {
      type: place === "villa" ? "villa" : "room",
      roomId: place === "villa" ? undefined : place,
      checkIn,
      checkOut,
      checkInTime: times.checkInTime,
      checkOutTime: times.checkOutTime,
      adults,
      children,
      source,
      extras: extras.length > 0 ? extras : undefined,
      total,
      paid: Math.min(booking.paid, total),
      notes,
    });
    if (!result.ok) return setError(result);
    notify("Booking updated");
    onDone();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 font-medium">What is booked</div>
        <div className="flex flex-wrap gap-2">
          <Chip selected={place === "villa"} onClick={() => { setPlace("villa"); reprice("villa", checkIn, checkOut); }}>
            Entire Villa
          </Chip>
          {rooms.filter((r) => r.enabled || r.id === booking.roomId).map((r) => (
            <Chip key={r.id} selected={place === r.id} onClick={() => { setPlace(r.id); reprice(r.id, checkIn, checkOut); }}>
              {r.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in">
          {(id) => <Input id={id} type="date" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); reprice(place, e.target.value, checkOut); }} />}
        </Field>
        <Field label="Check-out">
          {(id) => <Input id={id} type="date" value={checkOut} min={checkIn} onChange={(e) => { setCheckOut(e.target.value); reprice(place, checkIn, e.target.value); }} />}
        </Field>
      </div>

      {error ? (
        <div role="alert" className="flex gap-3 rounded-card border border-clay/30 bg-clay-soft p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-clay" />
          <div>
            <p className="font-semibold">{error.title}</p>
            <p className="text-[0.9375rem]">{error.message}</p>
          </div>
        </div>
      ) : null}

      {nights > 0 ? (
        <StayTimes
          request={{ type: place === "villa" ? "villa" : "room", roomId: place === "villa" ? undefined : place, checkIn, checkOut }}
          ignoreId={booking.id}
          value={times}
          onChange={(t) => { setTimes(t); setError(null); }}
        />
      ) : null}

      <div className="divide-y divide-line rounded-card border border-line bg-card px-5">
        <Stepper label="Adults" value={adults} min={1} onChange={setAdults} />
        <Stepper label="Children" value={children} min={0} onChange={setChildren} />
      </div>
      {adults + children > capacity ? (
        <p className="-mt-3 text-[0.9375rem] text-amber-deep">
          That is more than the usual {capacity}. You can still save it.
        </p>
      ) : null}

      <div>
        <div className="mb-2 font-medium">Where the booking came from</div>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <Chip key={s} selected={source === s} onClick={() => setSource(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 font-medium">Amenities</div>
        <ExtrasPicker
          value={extras}
          onChange={(next) => {
            // Adding or removing an amenity moves the total by exactly its cost.
            setTotal(Math.max(total - extrasTotal(extras) + extrasTotal(next), 0));
            setExtras(next);
          }}
        />
      </div>

      <Field
        label="Total"
        hint={
          nights > 0
            ? `${plural(nights, "night")} at ${money(rate)}${extras.length > 0 ? ` plus ${money(extrasTotal(extras))} of amenities` : ""} is ${money(rate * nights + extrasTotal(extras))}. Change it if you agreed a different price.`
            : undefined
        }
      >
        {(id) => <MoneyInput id={id} value={total} onChange={setTotal} />}
      </Field>

      <Field label="Notes" optional>
        {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special requests" />}
      </Field>

      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={onDone}>
          Back
        </Button>
        <Button size="lg" className="flex-1" onClick={save} disabled={nights <= 0 || total <= 0}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
