"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, CalendarDays, Plus, Receipt, Settings, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * The first-time guide for a new villa owner: a welcome, six short stops that
 * point at the real buttons, and a last card with the next thing to do.
 * It shows once per owner; finishing or skipping it is saved on the server.
 */

interface Stop {
  /** data-tour values to point at, first one that is on screen wins (sidebar on computers, bottom bar on phones) */
  targets: string[];
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  /** Extra line when the stop points at the phone's More tab */
  onMore?: string;
}

const STOPS: Stop[] = [
  {
    targets: ["/rooms", "/more"],
    icon: BedDouble,
    title: "Start with your rooms",
    text: "Add each room with its name and price per night. Guests can book a single room or the entire villa.",
    onMore: "Rooms are under More.",
  },
  {
    targets: ["new-booking", "/bookings"],
    icon: Plus,
    title: "Add a booking",
    text: "Pick the dates and the rooms, then the guest. Nights that are already taken are blocked for you, so nothing gets booked twice.",
  },
  {
    targets: ["/calendar"],
    icon: CalendarDays,
    title: "Every night at a glance",
    text: "The calendar shows which rooms are free, booked, arriving or leaving. Tap a free night to book it.",
  },
  {
    targets: ["/guests"],
    icon: Users,
    title: "Your guests",
    text: "Guest details and every past stay are kept, so a returning guest takes seconds to book.",
  },
  {
    targets: ["/expenses", "/more"],
    icon: Receipt,
    title: "Expenses and money",
    text: "Write down what you spend. Money shows each month's income, expenses and profit.",
    onMore: "Expenses and Money are under More.",
  },
  {
    targets: ["/settings", "/more"],
    icon: Settings,
    title: "Villa settings",
    text: "Check-in and check-out times, the entire-villa price, and your password.",
    onMore: "Villa settings are under More.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const GAP = 14;
const GUTTER = 16;

function findTarget(keys: string[]): { el: HTMLElement; key: string } | null {
  for (const key of keys) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return { el, key };
    }
  }
  return null;
}

export function GuideTour() {
  const { tourPending, finishTour, villa, rooms } = useStore();
  const router = useRouter();
  // -1 is the welcome card, STOPS.length the last card.
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState<Rect | null>(null);
  const [onMore, setOnMore] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const stop = step >= 0 && step < STOPS.length ? STOPS[step] : null;

  // Where the highlighted button is right now.
  const measure = useCallback(() => {
    if (!stop) {
      setRect(null);
      return;
    }
    const found = findTarget(stop.targets);
    if (!found) {
      setRect(null);
      return;
    }
    const r = found.el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setOnMore(found.key === "/more");
  }, [stop]);

  useLayoutEffect(() => {
    if (!tourPending) return;
    // Reading the page layout is the external system here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", again);
      window.removeEventListener("scroll", again, true);
    };
  }, [tourPending, measure]);

  // Place the card beside the button (sidebar), above it (phone bar), or in the middle.
  useLayoutEffect(() => {
    if (!tourPending || !card.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(380, vw - GUTTER * 2);
    const height = card.current.offsetHeight;
    if (!rect) {
      setBox({ width, left: (vw - width) / 2, top: Math.max(GUTTER, (vh - height) / 2) });
      return;
    }
    const clampX = (x: number) => Math.min(Math.max(GUTTER, x), vw - width - GUTTER);
    const clampY = (y: number) => Math.min(Math.max(GUTTER, y), vh - height - GUTTER);
    if (rect.left + rect.width + GAP + width + GUTTER <= vw && rect.left < vw / 3) {
      // To the right of a sidebar item
      setBox({ width, left: rect.left + rect.width + GAP, top: clampY(rect.top + rect.height / 2 - height / 2) });
    } else if (rect.top - GAP - height >= GUTTER) {
      setBox({ width, left: clampX(rect.left + rect.width / 2 - width / 2), top: rect.top - GAP - height });
    } else {
      setBox({ width, left: clampX(rect.left + rect.width / 2 - width / 2), top: clampY(rect.top + rect.height + GAP) });
    }
  }, [tourPending, rect, step]);

  useEffect(() => {
    if (tourPending) primary.current?.focus({ preventScroll: true });
  }, [tourPending, step]);

  const done = useCallback(
    (goTo?: string) => {
      finishTour();
      if (goTo) router.push(goTo);
    },
    [finishTour, router],
  );

  useEffect(() => {
    if (!tourPending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") done();
      if (e.key === "ArrowRight" && step < STOPS.length) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > -1) setStep((s) => s - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tourPending, step, done]);

  if (!tourPending) return null;

  const first = (villa.ownerName || "").split(/\s+/)[0];
  const hasRooms = rooms.length > 0;
  const pad = 6;

  return (
    <div className="fixed inset-0 z-[70]" aria-hidden={false}>
      {/* Dim everything; the highlighted button shows through. Clicks outside the card do nothing. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-2xl ring-2 ring-white/90 transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(14, 22, 21, 0.58)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgba(14,22,21,0.58)]" />
      )}

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className="fixed rounded-card bg-card p-5 shadow-float transition-[top,left] duration-300 ease-out motion-reduce:transition-none sm:p-6"
        style={box ? { top: box.top, left: box.left, width: box.width } : { visibility: "hidden", width: 380 }}
      >
        <button
          type="button"
          onClick={() => done()}
          aria-label="Close the guide"
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-muted hover:bg-well hover:text-ink"
        >
          <X className="size-5" />
        </button>

        {step === -1 ? (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-sage-soft text-sage-deep">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <h2 id="tour-title" className="mt-4 pr-8 text-2xl leading-tight font-semibold">
              Welcome{first ? `, ${first}` : ""}!
            </h2>
            <p id="tour-text" className="mt-2 text-muted">
              {villa.name} is ready. Here&apos;s a one-minute look around, so you know where everything is.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button ref={primary} onClick={() => setStep(0)}>
                Show me around
              </Button>
              <Button variant="ghost" onClick={() => done()}>
                Skip for now
              </Button>
            </div>
          </>
        ) : stop ? (
          <>
            <div className="flex items-center gap-3 pr-8">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brass-soft text-brass-deep">
                <stop.icon className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-medium text-muted">
                {step + 1} of {STOPS.length}
              </span>
            </div>
            <h2 id="tour-title" className="mt-3 text-xl leading-tight font-semibold">
              {stop.title}
            </h2>
            <p id="tour-text" className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">
              {stop.text}
              {onMore && stop.onMore ? <span className="mt-1 block font-medium text-ink">{stop.onMore}</span> : null}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <div className="mr-auto flex gap-1.5" aria-hidden>
                {STOPS.map((_, i) => (
                  <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-ink" : "w-1.5 bg-line-strong")} />
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
              <Button ref={primary} size="sm" onClick={() => setStep(step + 1)}>
                {step === STOPS.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-sage-soft text-sage-deep">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <h2 id="tour-title" className="mt-4 pr-8 text-2xl leading-tight font-semibold">
              You&apos;re all set
            </h2>
            <p id="tour-text" className="mt-2 text-muted">
              {hasRooms ? "Your rooms are in. Make your first booking whenever you're ready." : "A good first step: add your rooms, then your first booking."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button ref={primary} onClick={() => done(hasRooms ? "/bookings/new" : "/rooms?add=1")}>
                {hasRooms ? "Make a booking" : "Add your rooms"}
              </Button>
              <Button variant="ghost" onClick={() => done()}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
