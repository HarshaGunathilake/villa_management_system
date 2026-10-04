"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { checkAvailability, type Availability } from "./availability";
import { checkLogin, clearSession, readSession, writeSession } from "./auth";
import { todayISO } from "./dates";
import { DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT, fmtTime, normalizeTime } from "./times";
import { createSeed, SEED_AMENITIES } from "./seed";
import type { Amenity, AppData, Booking, BookingExtra, Expense, Guest, Room, Villa } from "./types";
import { extrasTotal, uid } from "./utils";

const STORAGE_KEY = "villa-serenity:v1";

export interface BookingDraft {
  mode?: "villa" | "room" | "any";
  roomId?: string;
  checkIn?: string;
  guestId?: string;
}

type NewBooking = Omit<Booking, "id" | "createdAt" | "status">;
type SaveResult = { ok: true; booking: Booking } | Extract<Availability, { ok: false }>;

interface Store extends AppData {
  ready: boolean;
  today: string;

  signedIn: boolean;
  /** Returns false when the email or password is wrong. */
  signIn: (email: string, password: string, remember: boolean) => boolean;
  signOut: () => void;

  addBooking: (input: NewBooking) => SaveResult;
  updateBooking: (id: string, patch: Partial<Booking>) => SaveResult;
  checkIn: (id: string) => void;
  /** Refuses (returns false) while the guest still owes money. */
  checkOut: (id: string) => boolean;
  /** Replace the amenities and items on a booking; the total moves by the difference. */
  setBookingExtras: (id: string, extras: BookingExtra[]) => void;
  cancelBooking: (id: string) => void;
  recordPayment: (id: string, amount: number) => void;

  addGuest: (guest: Omit<Guest, "id">) => Guest;
  updateGuest: (id: string, patch: Partial<Guest>) => void;

  addExpense: (expense: Omit<Expense, "id">) => void;
  deleteExpense: (id: string) => void;

  addRoom: (room: Omit<Room, "id">) => void;
  updateRoom: (id: string, patch: Partial<Room>) => void;
  addAmenity: (amenity: Omit<Amenity, "id">) => void;
  updateAmenity: (id: string, patch: Partial<Amenity>) => void;
  removeAmenity: (id: string) => void;
  updateVilla: (patch: Partial<Villa>) => void;
  resetDemo: () => void;

  // Panels that can be opened from anywhere
  openBookingId: string | null;
  openBooking: (id: string | null) => void;
  /** Open a booking straight on its check-out screen. */
  openCheckout: (id: string) => void;
  checkoutIntent: boolean;
  openGuestId: string | null;
  openGuest: (id: string | null) => void;
  expenseFormOpen: boolean;
  setExpenseFormOpen: (open: boolean) => void;
  guestFormOpen: boolean;
  setGuestFormOpen: (open: boolean) => void;

  draft: BookingDraft | null;
  setDraft: (draft: BookingDraft | null) => void;

  toast: string | null;
  notify: (message: string) => void;
}

const StoreContext = createContext<Store | null>(null);

function load(today: string): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed?.villa && Array.isArray(parsed.bookings)) {
        // Older saves kept times as free text ("2:00 PM"); keep them as 24-hour "HH:MM".
        parsed.villa.checkInTime = normalizeTime(parsed.villa.checkInTime, DEFAULT_CHECK_IN);
        parsed.villa.checkOutTime = normalizeTime(parsed.villa.checkOutTime, DEFAULT_CHECK_OUT);
        // Saves from before amenities existed get the starter list.
        if (!Array.isArray(parsed.amenities)) parsed.amenities = SEED_AMENITIES.map((a) => ({ ...a }));
        return parsed;
      }
    }
  } catch {
    // Private windows can block storage. The app still works, it just won't remember changes.
  }
  return createSeed(today);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [today, setToday] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [checkoutIntent, setCheckoutIntent] = useState(false);
  const openBooking = useCallback((id: string | null) => {
    setCheckoutIntent(false);
    setOpenBookingId(id);
  }, []);
  const openCheckout = useCallback((id: string) => {
    setCheckoutIntent(true);
    setOpenBookingId(id);
  }, []);
  const [openGuestId, openGuest] = useState<string | null>(null);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [guestFormOpen, setGuestFormOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mock data lives in the browser, so it is loaded after the first render.
  useEffect(() => {
    const t = todayISO();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(t);
    setSignedIn(readSession());
    setData(load(t));
  }, []);

  useEffect(() => {
    if (!data) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [data]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const patch = useCallback((fn: (d: AppData) => AppData) => setData((d) => (d ? fn(d) : d)), []);
  const patchBooking = useCallback(
    (id: string, change: (b: Booking) => Booking) =>
      patch((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === id ? change(b) : b)) })),
    [patch],
  );

  const store = useMemo<Store>(() => {
    const d = data ?? createSeed(today || "2026-01-01");
    return {
      ...d,
      ready: data !== null,
      today,

      signedIn,
      signIn(email, password, remember) {
        if (!checkLogin(email, password)) return false;
        writeSession(remember);
        setSignedIn(true);
        return true;
      },
      signOut() {
        clearSession();
        setSignedIn(false);
        openBooking(null);
        openGuest(null);
      },

      addBooking(input) {
        const result = checkAvailability(input, d.bookings, d.rooms, undefined, d.villa);
        if (!result.ok) return result;
        const booking: Booking = { ...input, id: uid("b"), status: "confirmed", createdAt: today };
        patch((s) => ({ ...s, bookings: [...s.bookings, booking] }));
        return { ok: true, booking };
      },

      updateBooking(id, change) {
        const current = d.bookings.find((b) => b.id === id);
        if (!current) throw new Error("Booking not found");
        const next = { ...current, ...change };
        if (next.type === "villa") next.roomId = undefined;
        const result = checkAvailability(next, d.bookings, d.rooms, id, d.villa);
        if (!result.ok) return result;
        patchBooking(id, () => next);
        return { ok: true, booking: next };
      },

      checkIn: (id) => patchBooking(id, (b) => ({ ...b, status: "checked_in" })),
      checkOut(id) {
        const b = d.bookings.find((x) => x.id === id);
        if (!b || b.total - b.paid > 0) return false;
        patchBooking(id, (x) => ({ ...x, status: "checked_out", checkedOutOn: today }));
        return true;
      },
      setBookingExtras: (id, extras) =>
        patchBooking(id, (b) => ({
          ...b,
          extras: extras.length > 0 ? extras : undefined,
          total: Math.max(b.total - extrasTotal(b.extras) + extrasTotal(extras), 0),
        })),
      cancelBooking: (id) => patchBooking(id, (b) => ({ ...b, status: "cancelled" })),
      recordPayment: (id, amount) =>
        patchBooking(id, (b) => ({ ...b, paid: Math.min(b.total, Math.max(0, b.paid + amount)) })),

      addGuest(guest) {
        const created: Guest = { ...guest, id: uid("g") };
        patch((s) => ({ ...s, guests: [...s.guests, created] }));
        return created;
      },
      updateGuest: (id, change) =>
        patch((s) => ({ ...s, guests: s.guests.map((g) => (g.id === id ? { ...g, ...change } : g)) })),

      addExpense: (expense) => patch((s) => ({ ...s, expenses: [{ ...expense, id: uid("e") }, ...s.expenses] })),
      deleteExpense: (id) => patch((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) })),

      addRoom: (room) => patch((s) => ({ ...s, rooms: [...s.rooms, { ...room, id: uid("r") }] })),
      updateRoom: (id, change) =>
        patch((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...change } : r)) })),
      addAmenity: (amenity) => patch((s) => ({ ...s, amenities: [...s.amenities, { ...amenity, id: uid("a") }] })),
      updateAmenity: (id, change) =>
        patch((s) => ({ ...s, amenities: s.amenities.map((a) => (a.id === id ? { ...a, ...change } : a)) })),
      removeAmenity: (id) => patch((s) => ({ ...s, amenities: s.amenities.filter((a) => a.id !== id) })),
      updateVilla: (change) => patch((s) => ({ ...s, villa: { ...s.villa, ...change } })),
      resetDemo: () => setData(createSeed(todayISO())),

      openBookingId,
      openBooking,
      openCheckout,
      checkoutIntent,
      openGuestId,
      openGuest,
      expenseFormOpen,
      setExpenseFormOpen,
      guestFormOpen,
      setGuestFormOpen,
      draft,
      setDraft,
      toast,
      notify,
    };
  }, [data, today, signedIn, patch, patchBooking, openBookingId, openBooking, openCheckout, checkoutIntent, openGuestId, expenseFormOpen, guestFormOpen, draft, toast, notify]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

/** Small lookups used all over the UI. */
export function useLookups() {
  const { guests, rooms, villa } = useStore();
  return useMemo(() => {
    const guestById = new Map(guests.map((g) => [g.id, g]));
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    return {
      guestName: (id: string) => guestById.get(id)?.name ?? "Guest",
      guest: (id: string) => guestById.get(id),
      room: (id?: string) => (id ? roomById.get(id) : undefined),
      placeName: (b: Pick<Booking, "type" | "roomId">) =>
        b.type === "villa" ? "Entire Villa" : roomById.get(b.roomId ?? "")?.name ?? "Room",
      capacity: (b: Pick<Booking, "type" | "roomId">) =>
        b.type === "villa" ? villa.maxGuests : roomById.get(b.roomId ?? "")?.capacity ?? 2,
      rate: (b: Pick<Booking, "type" | "roomId">) =>
        b.type === "villa" ? villa.price : roomById.get(b.roomId ?? "")?.price ?? 0,
      /** This booking's own times if it has them, otherwise the villa's usual ones, ready to show. */
      checkInTime: (b: Pick<Booking, "checkInTime">) => fmtTime(b.checkInTime || villa.checkInTime),
      checkOutTime: (b: Pick<Booking, "checkOutTime">) => fmtTime(b.checkOutTime || villa.checkOutTime),
    };
  }, [guests, rooms, villa]);
}
