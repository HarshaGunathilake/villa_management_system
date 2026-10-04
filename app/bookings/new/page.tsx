"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, BedDouble, CalendarSearch, Check, CheckCircle2, FileText, Home, Lock, Users, X } from "lucide-react";
import { documentHref } from "@/lib/documents";
import { Avatar, PlaceIcon } from "@/components/booking-bits";
import { ExtrasPicker } from "@/components/extras";
import { emptyGuest, GuestFields, guestIsValid } from "@/components/guest-sheets";
import { Photo } from "@/components/photo";
import { RangeCalendar } from "@/components/range-calendar";
import { StayTimes, type StayTimesValue } from "@/components/stay-times";
import { Badge, PaymentBadge, StateIcons } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip, Field, MoneyInput, Stepper, Textarea } from "@/components/ui/field";
import { checkAvailability, checkTimes, nightIsTaken, paymentStatus, type Availability } from "@/lib/availability";
import { fmtTime } from "@/lib/times";
import { addDays, fmtDayWeek, fmtFull, fmtRange, nightsBetween } from "@/lib/dates";
import { PHOTOS } from "@/lib/photos";
import { useLookups, useStore } from "@/lib/store";
import { SOURCES, type Booking, type BookingExtra, type Guest, type Source } from "@/lib/types";
import { cn, extrasTotal, money, plural } from "@/lib/utils";

type Step = "type" | "dates" | "guest" | "done";
type Mode = "villa" | "room" | "any";
type Choice = { type: "villa" } | { type: "room"; roomId: string } | null;

const STEP_ORDER: Step[] = ["type", "dates", "guest"];
const STEP_TITLES: Record<Step, string> = {
  type: "What would you like to book?",
  dates: "When is the stay?",
  guest: "Who is staying?",
  done: "",
};

export default function NewBookingPage() {
  const router = useRouter();
  const store = useStore();
  const { today, villa, rooms, bookings, guests, draft, setDraft, addBooking, addGuest, openBooking } = store;
  const { guestName } = useLookups();

  // A draft is handed over when the owner starts from a room, a date or a guest.
  const [initial] = useState(draft);
  useEffect(() => {
    if (draft) setDraft(null);
  }, [draft, setDraft]);

  const [step, setStep] = useState<Step>(initial?.mode ? "dates" : "type");
  const [mode, setMode] = useState<Mode>(initial?.mode ?? "any");
  const [choice, setChoice] = useState<Choice>(
    initial?.mode === "villa" ? { type: "villa" } : initial?.roomId ? { type: "room", roomId: initial.roomId } : null,
  );
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkIn ? addDays(initial.checkIn, 1) : "");

  const [guestId, setGuestId] = useState<string | null>(initial?.guestId ?? null);
  const [newGuest, setNewGuest] = useState(emptyGuest);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [source, setSource] = useState<Source>("Direct");
  const [customTotal, setCustomTotal] = useState<number | null>(null);
  // A nightly price agreed for this one villa booking. The villa's usual price in settings is not touched.
  const [villaRate, setVillaRate] = useState<number | null>(null);
  // Amenities added to this booking (BBQ, meals...). Their cost is part of the total.
  const [extras, setExtras] = useState<BookingExtra[]>([]);
  const [paid, setPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState<Booking | null>(null);
  const [saveError, setSaveError] = useState<Extract<Availability, { ok: false }> | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const usableRooms = rooms.filter((r) => r.enabled);
  const hasDates = !!checkIn && !!checkOut;
  const nights = hasDates ? nightsBetween(checkIn, checkOut) : 0;

  const villaCheck = useMemo(
    () => (hasDates ? checkAvailability({ type: "villa", checkIn, checkOut }, bookings, rooms) : null),
    [hasDates, checkIn, checkOut, bookings, rooms],
  );
  const roomChecks = useMemo(
    () =>
      new Map(
        usableRooms.map((r) => [
          r.id,
          hasDates ? checkAvailability({ type: "room", roomId: r.id, checkIn, checkOut }, bookings, rooms) : null,
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasDates, checkIn, checkOut, bookings, rooms],
  );

  const chosenCheck = choice ? (choice.type === "villa" ? villaCheck : roomChecks.get(choice.roomId)) : null;
  const chosenOk = !!choice && !!chosenCheck && chosenCheck.ok;
  const usualRate = choice ? (choice.type === "villa" ? villa.price : rooms.find((r) => r.id === choice.roomId)?.price ?? 0) : 0;
  const specialRate = choice?.type === "villa" && villaRate !== null && villaRate !== villa.price;
  const rate = choice?.type === "villa" && villaRate !== null ? villaRate : usualRate;
  const capacity = choice ? (choice.type === "villa" ? villa.maxGuests : rooms.find((r) => r.id === choice.roomId)?.capacity ?? 2) : villa.maxGuests;
  const placeName = choice ? (choice.type === "villa" ? "Entire Villa" : rooms.find((r) => r.id === choice.roomId)?.name ?? "Room") : "";
  const extrasCost = extrasTotal(extras);
  const total = customTotal ?? rate * nights + extrasCost;
  const balance = Math.max(total - paid, 0);

  const selectedGuest = guestId ? guests.find((g) => g.id === guestId) : undefined;
  const guestReady = !!selectedGuest || guestIsValid(newGuest);

  // Times for this booking only; empty means the villa's usual times.
  const [times, setTimes] = useState<StayTimesValue>({});
  const stay = choice && hasDates ? { type: choice.type, roomId: choice.type === "room" ? choice.roomId : undefined, checkIn, checkOut, ...times } : null;
  const timesOk = !stay || checkTimes(stay, bookings, villa).ok;

  const scope = choice?.type === "villa" || mode === "villa" ? ({ type: "villa" } as const) : ({ type: "room", roomId: choice?.type === "room" ? choice.roomId : undefined } as const);

  const setDates = (a: string, b: string) => {
    setCheckIn(a);
    setCheckOut(b);
    setCustomTotal(null);
    setSaveError(null);
  };

  const choose = (c: Choice) => {
    setChoice(c);
    setCustomTotal(null);
    if (c?.type !== "villa") setVillaRate(null);
    setPaid(0);
  };

  const startWith = (m: Mode) => {
    setMode(m);
    choose(m === "villa" ? { type: "villa" } : null);
    setStep("dates");
  };

  const back = () => {
    const i = STEP_ORDER.indexOf(step);
    if (i <= 0) router.push("/");
    else setStep(STEP_ORDER[i - 1]);
  };

  const confirm = () => {
    if (!choice) return;
    let guest: Guest | undefined = selectedGuest;
    if (!guest && guestIsValid(newGuest)) {
      // A phone number that is already on file means a returning guest, so their history stays together.
      const digits = (v: string) => v.replace(/\D/g, "");
      guest =
        guests.find((g) => digits(g.phone).length > 5 && digits(g.phone) === digits(newGuest.phone)) ??
        addGuest({
          name: newGuest.name.trim(),
          phone: newGuest.phone.trim(),
          email: newGuest.email?.trim() || undefined,
          country: newGuest.country?.trim() || undefined,
        });
      setGuestId(guest.id);
    }
    if (!guest) return;

    const result = addBooking({
      type: choice.type,
      roomId: choice.type === "room" ? choice.roomId : undefined,
      guestId: guest.id,
      checkIn,
      checkOut,
      checkInTime: times.checkInTime,
      checkOutTime: times.checkOutTime,
      adults,
      children,
      source,
      extras: extras.length > 0 ? extras : undefined,
      total,
      paid: Math.min(paid, total),
      notes: notes.trim(),
    });
    if (!result.ok) {
      setSaveError(result);
      setStep("dates");
      return;
    }
    setSaved(result.booking);
    setStep("done");
  };

  /* ------------------------------------------------------------------ done */
  if (step === "done" && saved) {
    const others = usableRooms.filter((r) => r.id !== saved.roomId);
    return (
      <div className="mx-auto max-w-xl pt-6 text-center sm:pt-12">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-sage-soft text-sage-deep">
          <Check className="size-10" strokeWidth={2.5} />
        </span>
        <h1 className="mt-6 text-4xl font-semibold">Booking confirmed</h1>
        <p className="mt-2 text-lg text-muted">
          {guestName(saved.guestId)}, {saved.type === "villa" ? "Entire Villa" : placeName}
          <br />
          {fmtRange(saved.checkIn, saved.checkOut)}, {plural(nightsBetween(saved.checkIn, saved.checkOut), "night")}
        </p>

        <div className="mt-8 rounded-card border border-line bg-card p-5 text-left shadow-card">
          <div className="mb-2 font-semibold">The calendar is up to date</div>
          {saved.type === "villa" ? (
            <ul className="space-y-2 text-muted">
              <li className="flex gap-2">
                <Lock className="mt-0.5 size-5 shrink-0 text-clay" />
                <span>
                  {usableRooms.map((r) => r.name).join(", ")} can no longer be booked for {fmtRange(saved.checkIn, saved.checkOut)}.
                </span>
              </li>
            </ul>
          ) : (
            <ul className="space-y-2 text-muted">
              {others.length > 0 ? (
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sage" />
                  <span>{others.map((r) => r.name).join(" and ")} can still be booked for these dates.</span>
                </li>
              ) : null}
              <li className="flex gap-2">
                <Lock className="mt-0.5 size-5 shrink-0 text-clay" />
                <span>The entire villa can no longer be booked for these dates.</span>
              </li>
            </ul>
          )}
        </div>

        <div className="mt-6 grid gap-3">
          <Button size="lg" block onClick={() => router.push(documentHref(saved.id, "confirmation"))}>
            <FileText /> View confirmation receipt
          </Button>
          <Button variant="secondary" size="lg" block onClick={() => router.push("/calendar")}>
            See it on the calendar
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                router.push("/bookings");
                openBooking(saved.id);
              }}
            >
              View booking
            </Button>
            <Button variant="secondary" size="lg" onClick={() => router.push("/")}>
              Back to home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------------- steps */
  const stepIndex = STEP_ORDER.indexOf(step);
  const title =
    step === "dates" && mode === "villa" ? "When is the villa needed?" : step === "dates" && mode === "room" ? "Which room, and when?" : STEP_TITLES[step];

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <div className="mb-6 flex items-center gap-2">
        <button type="button" onClick={back} className="-ml-2 grid size-12 place-items-center rounded-full hover:bg-well" aria-label={stepIndex === 0 ? "Close" : "Back"}>
          {stepIndex === 0 ? <X className="size-6" /> : <ArrowLeft className="size-6" />}
        </button>
        <div className="flex-1">
          <div className="text-sm text-muted" aria-live="polite">
            New booking, step {stepIndex + 1} of {STEP_ORDER.length}
          </div>
          <div className="mt-1.5 flex gap-1.5" aria-hidden>
            {STEP_ORDER.map((s, i) => (
              <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= stepIndex ? "bg-brass" : "bg-line")} />
            ))}
          </div>
        </div>
        {stepIndex > 0 ? (
          <button type="button" onClick={() => router.push("/")} className="-mr-2 grid size-12 place-items-center rounded-full text-muted hover:bg-well" aria-label="Close without saving">
            <X className="size-6" />
          </button>
        ) : null}
      </div>

      <h1 className="mb-6 text-[1.875rem] leading-tight font-semibold sm:text-4xl">{title}</h1>

      {/* Step 1 ------------------------------------------------------------ */}
      {step === "type" ? (
        <div className="space-y-4">
          <button type="button" onClick={() => startWith("villa")} className="group block w-full overflow-hidden rounded-card border border-line bg-card text-left shadow-card transition-colors hover:border-ink">
            <Photo src={PHOTOS.villa} alt="" className="h-36 sm:h-44" />
            <div className="flex items-center gap-4 p-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <Home className="size-6 text-brass-deep" /> Entire Villa
                </div>
                <p className="mt-1 text-muted">Private access to the whole villa</p>
                <p className="mt-2 font-medium">
                  {plural(usableRooms.length, "room")}, up to {villa.maxGuests} guests, {money(villa.price)} a night
                </p>
              </div>
              <span className="hidden rounded-xl bg-ink px-5 py-3 font-medium text-white sm:block">Select</span>
            </div>
          </button>

          <button type="button" onClick={() => startWith("room")} className="group block w-full overflow-hidden rounded-card border border-line bg-card text-left shadow-card transition-colors hover:border-ink">
            <div className="grid h-36 grid-cols-3 gap-0.5 sm:h-44">
              {usableRooms.slice(0, 3).map((r) => (
                <Photo key={r.id} src={r.photo} alt="" />
              ))}
            </div>
            <div className="flex items-center gap-4 p-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <BedDouble className="size-6 text-brass-deep" /> Individual Room
                </div>
                <p className="mt-1 text-muted">Book one room. Choose from the rooms that are free.</p>
                {usableRooms.length > 0 ? (
                  <p className="mt-2 font-medium">From {money(Math.min(...usableRooms.map((r) => r.price)))} a night</p>
                ) : null}
              </div>
              <span className="hidden rounded-xl bg-ink px-5 py-3 font-medium text-white sm:block">Select</span>
            </div>
          </button>

          <button type="button" onClick={() => startWith("any")} className="flex min-h-14 w-full items-center gap-3 rounded-card border border-dashed border-line-strong px-5 py-4 text-left hover:bg-well">
            <CalendarSearch className="size-6 shrink-0 text-brass-deep" />
            <span>
              <span className="block font-medium">Not sure yet? Start with the dates</span>
              <span className="block text-sm text-muted">Pick the days and see what is free.</span>
            </span>
          </button>
        </div>
      ) : null}

      {/* Step 2 ------------------------------------------------------------ */}
      {step === "dates" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Check-in", value: checkIn, empty: "Tap a day" },
              { label: "Check-out", value: checkOut, empty: checkIn ? "Tap the leaving day" : "Then the leaving day" },
            ].map((f) => (
              <div key={f.label} className={cn("rounded-xl border bg-card px-4 py-3", f.value ? "border-line" : "border-dashed border-line-strong")}>
                <div className="text-sm text-muted">{f.label}</div>
                <div className={cn("text-lg font-semibold", !f.value && "font-normal text-muted")}>{f.value ? fmtFull(f.value) : f.empty}</div>
              </div>
            ))}
          </div>

          <RangeCalendar checkIn={checkIn} checkOut={checkOut} onChange={setDates} today={today} isTaken={(d) => nightIsTaken(d, bookings, rooms, scope)} />

          {saveError ? <Unavailable result={saveError} /> : null}

          {/* Entire villa only */}
          {mode === "villa" && hasDates && villaCheck ? (
            villaCheck.ok ? (
              <VillaPriceCard
                nights={nights}
                usual={villa.price}
                rate={villaRate}
                onChange={(v) => { setVillaRate(v); setCustomTotal(null); setPaid(0); }}
              />
            ) : (
              <Unavailable
                result={villaCheck}
                action={
                  villaCheck.reason === "rooms_booked" ? (
                    <Button variant="secondary" onClick={() => { setMode("any"); choose(null); }}>
                      See which rooms are free
                    </Button>
                  ) : null
                }
              />
            )
          ) : null}

          {/* A room (or the villa) picked first that turns out to be taken */}
          {mode !== "villa" && choice && chosenCheck && !chosenCheck.ok && !saveError ? <Unavailable result={chosenCheck} /> : null}

          {/* Rooms, or everything */}
          {mode !== "villa" ? (
            <div>
              <h2 className="mb-3 text-xl font-semibold">
                {hasDates ? `What would you like to book for ${fmtRange(checkIn, checkOut)}?` : mode === "room" ? "Choose a room" : "What would you like to book?"}
              </h2>
              <div role="radiogroup" className="space-y-3">
                {mode === "any" ? (
                  <OptionCard
                    icon={<Home className="size-7 text-brass-deep" />}
                    photo={PHOTOS.villa}
                    name="Entire Villa"
                    detail={`${plural(usableRooms.length, "room")}, up to ${villa.maxGuests} guests`}
                    price={villa.price}
                    check={villaCheck}
                    selected={choice?.type === "villa"}
                    onSelect={() => choose({ type: "villa" })}
                  />
                ) : null}
                {mode === "any" && hasDates && villaCheck?.ok ? <div className="py-1 text-center text-muted">or choose an individual room</div> : null}
                {usableRooms.map((r) => (
                  <OptionCard
                    key={r.id}
                    photo={r.photo}
                    name={r.name}
                    detail={`${r.view}, ${plural(r.capacity, "guest")}`}
                    price={r.price}
                    check={roomChecks.get(r.id) ?? null}
                    selected={choice?.type === "room" && choice.roomId === r.id}
                    onSelect={() => choose({ type: "room", roomId: r.id })}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {mode === "any" && choice?.type === "villa" && hasDates && villaCheck?.ok ? (
            <VillaPriceCard
              nights={nights}
              usual={villa.price}
              rate={villaRate}
              onChange={(v) => { setVillaRate(v); setCustomTotal(null); setPaid(0); }}
            />
          ) : null}

          {stay && chosenOk ? <StayTimes request={stay} value={times} onChange={setTimes} /> : null}
        </div>
      ) : null}

      {/* Step 3 ------------------------------------------------------------ */}
      {step === "guest" && choice ? (
        <div className="space-y-8">
          <div className="flex items-center gap-4 rounded-card border border-line bg-card p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-well">
              <PlaceIcon type={choice.type} />
            </span>
            <div className="min-w-0">
              <div className="text-lg leading-tight font-semibold">{placeName}</div>
              <div className="text-muted">
                {fmtDayWeek(checkIn)} to {fmtDayWeek(checkOut)}, {plural(nights, "night")}
              </div>
              <div className="text-muted">
                Check-in from {fmtTime(times.checkInTime || villa.checkInTime)}, check-out by {fmtTime(times.checkOutTime || villa.checkOutTime)}
              </div>
            </div>
          </div>

          {selectedGuest ? (
            <div className="flex items-center gap-4 rounded-card border border-ink bg-card p-5">
              <Avatar name={selectedGuest.name} />
              <div className="min-w-0 flex-1">
                <div className="text-xl leading-tight font-semibold">{selectedGuest.name}</div>
                <div className="text-muted">{selectedGuest.phone}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setGuestId(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="rounded-card border border-line bg-card p-5 shadow-card">
              <GuestFields value={newGuest} onChange={setNewGuest} />
            </div>
          )}

          <div>
            <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold">
              <Users className="size-5 text-muted" /> How many guests?
            </h2>
            <p className="mb-2 text-muted">
              {placeName} usually sleeps up to {capacity}.
            </p>
            <div className="divide-y divide-line rounded-card border border-line bg-card px-5">
              <Stepper label="Adults" value={adults} min={1} onChange={setAdults} />
              <Stepper label="Children" value={children} min={0} onChange={setChildren} />
            </div>
            {adults + children > capacity ? (
              <p className="mt-2 text-[0.9375rem] text-amber-deep">
                That is more than the usual {capacity}. You can still continue.
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-1 text-xl font-semibold">Amenities</h2>
            <p className="mb-2 text-muted">Add anything extra the guest asked for. Leave at 0 if nothing.</p>
            <ExtrasPicker
              value={extras}
              onChange={(next) => {
                setExtras(next);
                setCustomTotal(null);
                setPaid(Math.min(paid, rate * nights + extrasTotal(next)));
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Step 3, continued: where it came from, payment and notes on the same screen */}
      {step === "guest" && choice ? (
        <div className="mt-8 space-y-8">
          <div>
            <h2 className="mb-3 text-xl font-semibold">Where did the booking come from?</h2>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <Chip key={s} selected={source === s} onClick={() => setSource(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xl font-semibold">Payment</h2>
            <div className="rounded-card border border-line bg-card p-5">
              {customTotal === null ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-muted">Total</div>
                    <div className="text-sm text-muted">
                      {money(rate)} × {plural(nights, "night")}
                    </div>
                    {extrasCost > 0 ? <div className="text-sm text-muted">Amenities {money(extrasCost)}</div> : null}
                    {specialRate ? (
                      <div className="text-sm text-brass-deep">Special price for this booking. Usual price {money(usualRate)} a night.</div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="tnum text-2xl font-semibold">{money(total)}</div>
                    <button type="button" className="text-sm font-medium text-brass-deep underline underline-offset-4" onClick={() => setCustomTotal(total)}>
                      Change price
                    </button>
                  </div>
                </div>
              ) : (
                <Field label="Total" hint={`The usual price is ${money(usualRate * nights + extrasCost)}.`}>
                  {(id) => <MoneyInput id={id} value={customTotal} onChange={(v) => { setCustomTotal(v); setPaid(Math.min(paid, v)); }} />}
                </Field>
              )}

              <div className="mt-5 border-t border-line pt-5">
                <Field label="How much has the guest paid?">
                  {(id) => <MoneyInput id={id} value={paid} onChange={(v) => setPaid(Math.min(v, total))} />}
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip selected={paid === 0} onClick={() => setPaid(0)}>
                    Nothing yet
                  </Chip>
                  <Chip selected={paid === Math.round(total / 2) && total > 0} onClick={() => setPaid(Math.round(total / 2))}>
                    Half
                  </Chip>
                  <Chip selected={paid === total && total > 0} onClick={() => setPaid(total)}>
                    Full amount
                  </Chip>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                <span className="font-medium">Balance</span>
                <span className="flex items-center gap-3">
                  <PaymentBadge status={paymentStatus(total, paid)} />
                  <span className="tnum text-xl font-semibold">{money(balance)}</span>
                </span>
              </div>
            </div>
          </div>

          <Field label="Special requests" optional>
            {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Late arrival around 8 PM" />}
          </Field>
        </div>
      ) : null}

      {/* Footer ------------------------------------------------------------ */}
      {step !== "type" ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-sand/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
            <div className="min-w-0 flex-1">
              {choice && nights > 0 && chosenOk ? (
                <>
                  <div className="truncate text-sm text-muted">
                    {placeName}, {plural(nights, "night")}
                  </div>
                  <div className="tnum text-xl leading-tight font-semibold">{money(total)}</div>
                </>
              ) : (
                <div className="text-muted">{!hasDates ? "Choose the dates" : !choice ? "Choose what to book" : "Not available"}</div>
              )}
            </div>
            {step === "dates" ? (
              <Button size="lg" disabled={!chosenOk || total <= 0 || !timesOk} onClick={() => setStep("guest")}>
                Continue
              </Button>
            ) : (
              <Button size="lg" disabled={!guestReady || !chosenOk || total <= 0 || !timesOk} onClick={confirm}>
                Confirm booking
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "The villa is free", with the option to agree a different nightly price for this one booking. */
function VillaPriceCard({
  nights,
  usual,
  rate,
  onChange,
}: {
  nights: number;
  usual: number;
  /** null means the usual price */
  rate: number | null;
  onChange: (rate: number | null) => void;
}) {
  const [editing, setEditing] = useState(rate !== null);
  const effective = rate ?? usual;
  const special = rate !== null && rate !== usual;

  return (
    <div className="rounded-card border border-sage/40 bg-sage-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-lg font-semibold text-sage-deep">
          <CheckCircle2 className="size-6" /> The villa is free
        </div>
        {special ? <Badge tone="brass" className="bg-white">Special price</Badge> : null}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span>
          {plural(nights, "night")} at {money(effective)}
        </span>
        <span className="tnum text-2xl font-semibold">{money(effective * nights)}</span>
      </div>

      {editing ? (
        <div className="mt-4 rounded-xl bg-white/70 p-4">
          <Field
            label="Price per night for this booking"
            hint={`The usual price is ${money(usual)} a night. Only this booking changes.`}
          >
            {(id) => <MoneyInput id={id} value={effective} onChange={(v) => onChange(v)} autoFocus />}
          </Field>
          {effective <= 0 ? <p className="mt-2 text-[0.9375rem] font-medium text-clay">Enter a price to continue.</p> : null}
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              onChange(null);
              setEditing(false);
            }}
          >
            Use the usual price
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 min-h-11 font-medium text-sage-deep underline underline-offset-4"
        >
          Change the price for this booking
        </button>
      )}
    </div>
  );
}

function Unavailable({ result, action }: { result: Extract<Availability, { ok: false }>; action?: React.ReactNode }) {
  const { openBooking } = useStore();
  const { guestName, placeName } = useLookups();
  return (
    <div role="alert" className="rounded-card border border-clay/30 bg-clay-soft p-5">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-6 shrink-0 text-clay" />
        <div>
          <p className="text-lg font-semibold">{result.title}</p>
          <p>{result.message}</p>
        </div>
      </div>
      {result.conflicts.length > 0 ? (
        <ul className="mt-4 divide-y divide-clay/15 overflow-hidden rounded-xl bg-white/70">
          {result.conflicts.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => openBooking(b.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white">
                <PlaceIcon type={b.type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{guestName(b.guestId)}</span>
                  <span className="block text-sm text-muted">
                    {placeName(b)}, {fmtRange(b.checkIn, b.checkOut)}
                  </span>
                </span>
                <span className="text-sm font-medium text-brass-deep">View</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function OptionCard({
  photo,
  icon,
  name,
  detail,
  price,
  check,
  selected,
  onSelect,
}: {
  photo?: string;
  icon?: React.ReactNode;
  name: string;
  detail: string;
  price: number;
  check: Availability | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const { openBooking } = useStore();
  const { guestName } = useLookups();
  const blocked = check && !check.ok ? check : null;
  const conflict = blocked?.conflicts[0];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border bg-card shadow-card transition-colors",
        selected && !blocked ? "border-ink ring-1 ring-ink" : "border-line",
        blocked && "bg-card/60",
      )}
    >
      <div className="flex items-stretch">
        <Photo src={photo} alt="" className={cn("w-24 shrink-0 sm:w-36", blocked && "opacity-55 grayscale")} />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2 text-xl leading-tight font-semibold">
              {icon}
              {name}
            </div>
            {check ? (
              check.ok ? (
                <Badge tone="sage" icon={StateIcons.available}>Available</Badge>
              ) : blocked?.reason === "room_booked" ? (
                <Badge tone="clay" icon={StateIcons.booked}>Booked</Badge>
              ) : (
                <Badge tone="clay" icon={Lock}>Not available</Badge>
              )
            ) : null}
          </div>
          <div className="mt-0.5 text-muted">{detail}</div>
          <div className="tnum mt-1 font-medium">{money(price)} a night</div>

          {blocked ? (
            <div className="mt-3">
              <p className="text-[0.9375rem] text-clay">
                {blocked.reason === "room_booked" && conflict
                  ? `${guestName(conflict.guestId)} has this room, ${fmtRange(conflict.checkIn, conflict.checkOut)}.`
                  : blocked.message}
              </p>
              {conflict ? (
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => openBooking(conflict.id)}>
                  View booking
                </Button>
              ) : null}
            </div>
          ) : (
            <Button
              role="radio"
              aria-checked={selected}
              variant={selected ? "primary" : "secondary"}
              size="sm"
              className="mt-3"
              onClick={onSelect}
            >
              {selected ? (
                <>
                  <Check /> Selected
                </>
              ) : (
                `Select ${name.replace(/ Room$/, "")}`
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
