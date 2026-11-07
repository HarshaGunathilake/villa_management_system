"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, type ApiFailure, type Renewal, type SupportContact } from "./api";
import { checkAvailability, type Availability } from "./availability";
import { todayISO } from "./dates";
import { fmtTime } from "./times";
import { billExpense } from "./bills";
import { payslipExpense } from "./payroll";
import type { Amenity, AppData, Bill, Booking, BookingExtra, Expense, Guest, Payslip, Room, Staff, Villa, VillaSubscription } from "./types";
import { extrasTotal, uid } from "./utils";

export interface BookingDraft {
  mode?: "villa" | "room" | "any";
  roomId?: string;
  checkIn?: string;
  guestId?: string;
}

type NewBooking = Omit<Booking, "id" | "createdAt" | "status">;
export type NewPayslip = Pick<Payslip, "staffId" | "payType" | "rate" | "month" | "days" | "additions" | "deductions" | "epf" | "note">;
type SaveResult = { ok: true; booking: Booking } | Extract<Availability, { ok: false }>;

/** Shown when a change is tried while the subscription payment is due. The server refuses these too. */
export const READ_ONLY_MESSAGE = "Changes are paused until your subscription payment goes through.";

/**
 * Where the signed-in admin stands:
 *  loading     still asking the server
 *  signed_out  no session
 *  ok          signed in, villa and user both active
 *  disabled    the villa or the user has been switched off by the Super Admin
 *  lapsed      the card subscription ended, so access is off until the villa pays again
 *  unverified  a new sign-up that has not confirmed its email yet
 *  error       the server or database could not be reached
 */
export type Access = "loading" | "signed_out" | "ok" | "disabled" | "lapsed" | "unverified" | "error";
export type SignInResult = { ok: true } | { ok: false; code: string; message: string };

interface Store extends AppData {
  ready: boolean;
  today: string;
  /** This villa's subscription with the platform. Shown for information; only the Super Admin can change it. */
  subscription: VillaSubscription | null;
  /**
   * The subscription payment is due or overdue: everything can still be seen,
   * but nothing can be added or changed until it is paid.
   */
  readOnly: boolean;
  /**
   * A new sign-up that has not made its first payment: the villa can be seen,
   * but nothing works until they subscribe. Holds what subscribing costs.
   */
  awaitingPayment: Renewal | null;
  /** The "Start your subscription" popup */
  subscribeOpen: boolean;
  setSubscribeOpen: (open: boolean) => void;
  /** A new owner's first visit: show the guide */
  tourPending: boolean;
  /** The guide was finished or skipped; it won't show again */
  finishTour: () => void;

  access: Access;
  signedIn: boolean;
  /** Who to contact when access is switched off */
  support: SupportContact | null;
  /** When the subscription ended: what paying again costs */
  renewal: Renewal | null;
  /** The address waiting to be confirmed, when access is "unverified" */
  unverifiedEmail: string | null;
  accessError: string | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<SignInResult>;
  signOut: () => void;
  /** Ask the server again (after an error, or to pick up changes made elsewhere). */
  reload: () => Promise<void>;

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

  addStaff: (staff: Omit<Staff, "id">) => Staff | null;
  updateStaff: (id: string, patch: Partial<Staff>) => void;
  removeStaff: (id: string) => void;
  /** Makes a payslip; with `paidOn` it is also marked paid and added to Expenses. */
  addPayslip: (input: NewPayslip, paidOn?: string) => Payslip | null;
  payPayslip: (id: string, paidOn: string) => void;
  /** Removes the payslip and, if it was paid, its expense. */
  deletePayslip: (id: string) => void;

  addBill: (bill: Omit<Bill, "id">) => Bill | null;
  updateBill: (id: string, patch: Partial<Bill>) => void;
  /** Removes the bill and its payment records. The expenses it became stay. */
  removeBill: (id: string) => void;
  /** Marks one due date paid and adds it to Expenses. */
  payBill: (billId: string, period: string, paidOn: string, amount: number) => void;
  /** Marks one due date as dealt with, without an expense. */
  skipBill: (billId: string, period: string) => void;
  /** Undoes a payment or skip; a paid one's expense is removed too. */
  undoBillPayment: (billId: string, period: string) => void;

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

/** Stands in until the villa's data has arrived. Nothing from it is shown. */
const EMPTY: AppData = {
  villa: { name: "", location: "", phone: "", maxGuests: 1, price: 0, ownerName: "", checkInTime: "14:00", checkOutTime: "11:00", monthlyReport: false, reportCc: "", ownerEmail: "" },
  rooms: [],
  guests: [],
  bookings: [],
  expenses: [],
  amenities: [],
  staff: [],
  payslips: [],
  bills: [],
  billPayments: [],
};

type VillaAction = { type: string } & Record<string, unknown>;

/**
 * Holds the signed-in admin's villa data.
 *
 * The data comes from the server (/api/villa/data), which only ever returns the
 * villa that belongs to the session. Changes show on screen at once and are
 * sent to /api/villa/actions in order; the server checks every one again
 * (access, booking rules, amounts). If the server refuses a change, the screen
 * reloads the true data and says so.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [subscription, setSubscription] = useState<VillaSubscription | null>(null);
  const [today, setToday] = useState("");
  const [access, setAccess] = useState<Access>("loading");
  const [support, setSupport] = useState<SupportContact | null>(null);
  const [renewal, setRenewal] = useState<Renewal | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState<Renewal | null>(null);
  // Opens by itself the first time a new sign-up lands in the app, but not over
  // the Subscription page, where they are paying or just came back from paying.
  const [subscribeOpen, setSubscribeOpen] = useState(() => typeof window === "undefined" || !window.location.pathname.startsWith("/subscription"));
  const [accessError, setAccessError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [serverTour, setServerTour] = useState(false);
  const [tourDone, setTourDone] = useState(false);
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

  // A change refused while payment is due must not be followed by "Saved".
  const pausedAt = useRef(0);
  const notify = useCallback((message: string) => {
    if (message !== READ_ONLY_MESSAGE && Date.now() - pausedAt.current < 1500) return;
    if (message === READ_ONLY_MESSAGE) pausedAt.current = Date.now();
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /** A refused request tells us where the admin now stands. Returns true when it was an access problem. */
  const applyFailure = useCallback((failure: ApiFailure) => {
    if (failure.status === 401) {
      setAccess("signed_out");
      setData(null);
      return true;
    }
    if (failure.code === "access_disabled") {
      setSupport(failure.support ?? null);
      setAccess("disabled");
      setData(null);
      return true;
    }
    if (failure.code === "email_unverified") {
      setSupport(failure.support ?? null);
      setUnverifiedEmail(failure.email ?? null);
      setAccess("unverified");
      setData(null);
      return true;
    }
    if (failure.code === "subscription_ended") {
      setSupport(failure.support ?? null);
      setRenewal(failure.renewal ?? null);
      setAccess("lapsed");
      setData(null);
      return true;
    }
    return false;
  }, []);

  const reload = useCallback(async () => {
    const result = await api<{ data: AppData; subscription?: VillaSubscription; tour?: boolean; firstPayment?: Renewal | null }>("/api/villa/data");
    if (result.ok) {
      setServerTour(result.tour === true);
      setAwaitingPayment(result.firstPayment ?? null);
      setData(result.data);
      setSubscription(result.subscription ?? null);
      setAccessError(null);
      setAccess("ok");
    } else if (!applyFailure(result)) {
      setAccessError(result.error);
      setAccess((current) => (current === "ok" ? "ok" : "error"));
    }
  }, [applyFailure]);

  // Changes are sent one after another, in the order they were made.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const epoch = useRef(0);

  const send = useCallback(
    (action: VillaAction) => {
      const startedIn = epoch.current;
      pending.current += 1;
      queue.current = queue.current.then(async () => {
        try {
          // After a refusal, later changes built on top of it are dropped; the screen has reloaded the truth.
          if (startedIn !== epoch.current) return;
          const result = await api("/api/villa/actions", action);
          if (result.ok) return;
          epoch.current += 1;
          if (applyFailure(result)) return;
          notify(result.status === 409 || result.code === "payment_due" ? result.error : "That change could not be saved. Showing the latest saved data.");
          await reload();
        } finally {
          pending.current -= 1;
        }
      });
    },
    [applyFailure, notify, reload],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(todayISO());
    void reload();
    // Coming back to the tab picks up anything changed elsewhere, including access being switched off.
    const onVisible = () => {
      if (document.visibilityState === "visible" && pending.current === 0) void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const patch = useCallback((fn: (d: AppData) => AppData) => setData((d) => (d ? fn(d) : d)), []);
  const patchBooking = useCallback(
    (id: string, change: (b: Booking) => Booking) =>
      patch((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === id ? change(b) : b)) })),
    [patch],
  );

  const store = useMemo<Store>(() => {
    const d = data ?? EMPTY;
    const readOnly = access === "ok" && ((!!subscription && subscription.status !== "active") || !!awaitingPayment);
    /** True (and says so) when the villa is read-only, so the change is not made. Before the first payment, it asks them to subscribe. */
    const paused = () => {
      if (readOnly && awaitingPayment) {
        // No "Saved" message may follow a change that was not made.
        pausedAt.current = Date.now();
        setSubscribeOpen(true);
      } else if (readOnly) notify(READ_ONLY_MESSAGE);
      return readOnly;
    };
    const pausedResult: SaveResult = { ok: false, reason: "payment_due", title: "Payment due", message: READ_ONLY_MESSAGE, conflicts: [] };
    return {
      ...d,
      ready: access !== "loading",
      today,
      subscription: access === "ok" ? subscription : null,
      readOnly,

      access,
      signedIn: access === "ok" && data !== null,
      support,
      renewal,
      unverifiedEmail,
      awaitingPayment: access === "ok" ? awaitingPayment : null,
      subscribeOpen: access === "ok" && !!awaitingPayment && subscribeOpen,
      setSubscribeOpen,
      // The guide waits until they have subscribed and can actually use it.
      tourPending: access === "ok" && serverTour && !tourDone && !awaitingPayment,
      finishTour() {
        setTourDone(true);
        void api("/api/villa/tour", {});
      },
      accessError,
      reload,
      async signIn(email, password, remember) {
        const result = await api("/api/auth/login", { portal: "villa", email, password, remember });
        if (result.ok) {
          await reload();
          return { ok: true };
        }
        if (result.code === "access_disabled") {
          setSupport(result.support ?? null);
          setAccess("disabled");
        }
        return { ok: false, code: result.code, message: result.error };
      },
      signOut() {
        void queue.current.then(() => api("/api/auth/logout", { portal: "villa" }));
        setAccess("signed_out");
        setData(null);
        openBooking(null);
        openGuest(null);
      },

      addBooking(input) {
        if (paused()) return pausedResult;
        const result = checkAvailability(input, d.bookings, d.rooms, undefined, d.villa);
        if (!result.ok) return result;
        const booking: Booking = { ...input, id: uid("b"), status: "confirmed", createdAt: today };
        patch((s) => ({ ...s, bookings: [...s.bookings, booking] }));
        send({ type: "addBooking", booking });
        return { ok: true, booking };
      },

      updateBooking(id, change) {
        if (paused()) return pausedResult;
        const current = d.bookings.find((b) => b.id === id);
        if (!current) throw new Error("Booking not found");
        const next = { ...current, ...change };
        if (next.type === "villa") next.roomId = undefined;
        const result = checkAvailability(next, d.bookings, d.rooms, id, d.villa);
        if (!result.ok) return result;
        patchBooking(id, () => next);
        send({ type: "updateBooking", id, patch: next });
        return { ok: true, booking: next };
      },

      checkIn(id) {
        if (paused()) return;
        patchBooking(id, (b) => ({ ...b, status: "checked_in" }));
        send({ type: "checkIn", id });
      },
      checkOut(id) {
        if (paused()) return false;
        const b = d.bookings.find((x) => x.id === id);
        if (!b || b.total - b.paid > 0) return false;
        patchBooking(id, (x) => ({ ...x, status: "checked_out", checkedOutOn: today }));
        send({ type: "checkOut", id });
        return true;
      },
      setBookingExtras(id, extras) {
        if (paused()) return;
        patchBooking(id, (b) => ({
          ...b,
          extras: extras.length > 0 ? extras : undefined,
          total: Math.max(b.total - extrasTotal(b.extras) + extrasTotal(extras), 0),
        }));
        send({ type: "setBookingExtras", id, extras });
      },
      cancelBooking(id) {
        if (paused()) return;
        patchBooking(id, (b) => ({ ...b, status: "cancelled" }));
        send({ type: "cancelBooking", id });
      },
      recordPayment(id, amount) {
        if (paused()) return;
        patchBooking(id, (b) => ({ ...b, paid: Math.min(b.total, Math.max(0, b.paid + amount)) }));
        send({ type: "recordPayment", id, amount });
      },

      addGuest(guest) {
        const created: Guest = { ...guest, id: uid("g") };
        if (paused()) return created; // not saved anywhere
        patch((s) => ({ ...s, guests: [...s.guests, created] }));
        send({ type: "addGuest", guest: created });
        return created;
      },
      updateGuest(id, change) {
        if (paused()) return;
        patch((s) => ({ ...s, guests: s.guests.map((g) => (g.id === id ? { ...g, ...change } : g)) }));
        send({ type: "updateGuest", id, patch: change });
      },

      addExpense(expense) {
        if (paused()) return;
        const created = { ...expense, id: uid("e") };
        patch((s) => ({ ...s, expenses: [created, ...s.expenses] }));
        send({ type: "addExpense", expense: created });
      },
      deleteExpense(id) {
        if (paused()) return;
        patch((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id), billPayments: s.billPayments.filter((p) => p.expenseId !== id) }));
        send({ type: "deleteExpense", id });
      },

      addRoom(room) {
        if (paused()) return;
        const created = { ...room, id: uid("r") };
        patch((s) => ({ ...s, rooms: [...s.rooms, created] }));
        send({ type: "addRoom", room: created });
      },
      updateRoom(id, change) {
        if (paused()) return;
        patch((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...change } : r)) }));
        send({ type: "updateRoom", id, patch: change });
      },
      addAmenity(amenity) {
        if (paused()) return;
        const created = { ...amenity, id: uid("a") };
        patch((s) => ({ ...s, amenities: [...s.amenities, created] }));
        send({ type: "addAmenity", amenity: created });
      },
      updateAmenity(id, change) {
        if (paused()) return;
        patch((s) => ({ ...s, amenities: s.amenities.map((a) => (a.id === id ? { ...a, ...change } : a)) }));
        send({ type: "updateAmenity", id, patch: change });
      },
      removeAmenity(id) {
        if (paused()) return;
        patch((s) => ({ ...s, amenities: s.amenities.filter((a) => a.id !== id) }));
        send({ type: "removeAmenity", id });
      },
      updateVilla(change) {
        if (paused()) return;
        patch((s) => ({ ...s, villa: { ...s.villa, ...change } }));
        send({ type: "updateVilla", patch: change });
      },

      addStaff(input) {
        if (paused()) return null;
        const created: Staff = { ...input, id: uid("s") };
        patch((s) => ({ ...s, staff: [...s.staff, created] }));
        send({ type: "addStaff", staff: created });
        return created;
      },
      updateStaff(id, change) {
        if (paused()) return;
        patch((s) => ({ ...s, staff: s.staff.map((x) => (x.id === id ? { ...x, ...change } : x)) }));
        send({ type: "updateStaff", id, patch: change });
      },
      removeStaff(id) {
        if (paused()) return;
        patch((s) => ({ ...s, staff: s.staff.filter((x) => x.id !== id) }));
        send({ type: "removeStaff", id });
      },
      addPayslip(input, paidOn) {
        if (paused()) return null;
        const person = d.staff.find((x) => x.id === input.staffId);
        if (!person) return null;
        const number = d.payslips.reduce((n, p) => Math.max(n, p.number), 0) + 1;
        const expenseId = paidOn ? uid("e") : undefined;
        const slip: Payslip = { ...input, id: uid("p"), number, staffName: person.name, staffRole: person.role, epfNumber: person.epfNumber, createdOn: today, paidOn, expenseId };
        patch((s) => ({
          ...s,
          payslips: [slip, ...s.payslips],
          expenses: paidOn && expenseId ? [{ id: expenseId, category: "Staff", date: paidOn, ...payslipExpense(slip) }, ...s.expenses] : s.expenses,
        }));
        send({ type: "addPayslip", payslip: slip, paidOn, expenseId });
        return slip;
      },
      payPayslip(id, paidOn) {
        if (paused()) return;
        const slip = d.payslips.find((p) => p.id === id);
        if (!slip || slip.paidOn) return;
        const expenseId = uid("e");
        const paid = { ...slip, paidOn, expenseId };
        patch((s) => ({
          ...s,
          payslips: s.payslips.map((p) => (p.id === id ? paid : p)),
          expenses: [{ id: expenseId, category: "Staff", date: paidOn, ...payslipExpense(paid) }, ...s.expenses],
        }));
        send({ type: "payPayslip", id, paidOn, expenseId });
      },
      deletePayslip(id) {
        if (paused()) return;
        const slip = d.payslips.find((p) => p.id === id);
        patch((s) => ({ ...s, payslips: s.payslips.filter((p) => p.id !== id), expenses: s.expenses.filter((e) => !slip?.expenseId || e.id !== slip.expenseId) }));
        send({ type: "deletePayslip", id });
      },

      addBill(bill) {
        if (paused()) return null;
        const created: Bill = { ...bill, id: uid("bill") };
        patch((s) => ({ ...s, bills: [...s.bills, created] }));
        send({ type: "addBill", bill: created });
        return created;
      },
      updateBill(id, change) {
        if (paused()) return;
        patch((s) => ({ ...s, bills: s.bills.map((b) => (b.id === id ? { ...b, ...change } : b)) }));
        send({ type: "updateBill", id, patch: change });
      },
      removeBill(id) {
        if (paused()) return;
        patch((s) => ({ ...s, bills: s.bills.filter((b) => b.id !== id), billPayments: s.billPayments.filter((p) => p.billId !== id) }));
        send({ type: "deleteBill", id });
      },
      payBill(billId, period, paidOn, amount) {
        if (paused()) return;
        const bill = d.bills.find((b) => b.id === billId);
        if (!bill || d.billPayments.some((p) => p.billId === billId && p.period === period)) return;
        const expenseId = uid("e");
        patch((s) => ({
          ...s,
          billPayments: [{ billId, period, paidOn, amount, expenseId, skipped: false }, ...s.billPayments],
          expenses: [{ id: expenseId, date: paidOn, amount, ...billExpense(bill, period) }, ...s.expenses],
        }));
        send({ type: "payBill", billId, period, paidOn, amount, expenseId });
      },
      skipBill(billId, period) {
        if (paused()) return;
        if (d.billPayments.some((p) => p.billId === billId && p.period === period)) return;
        patch((s) => ({ ...s, billPayments: [{ billId, period, paidOn: today, amount: 0, skipped: true }, ...s.billPayments] }));
        send({ type: "skipBill", billId, period, paidOn: today });
      },
      undoBillPayment(billId, period) {
        if (paused()) return;
        const done = d.billPayments.find((p) => p.billId === billId && p.period === period);
        if (!done) return;
        patch((s) => ({
          ...s,
          billPayments: s.billPayments.filter((p) => !(p.billId === billId && p.period === period)),
          expenses: s.expenses.filter((e) => !done.expenseId || e.id !== done.expenseId),
        }));
        send({ type: "undoBillPayment", billId, period });
      },

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
  }, [data, subscription, today, access, support, renewal, awaitingPayment, subscribeOpen, unverifiedEmail, serverTour, tourDone, accessError, reload, send, patch, patchBooking, openBookingId, openBooking, openCheckout, checkoutIntent, openGuestId, expenseFormOpen, guestFormOpen, draft, toast, notify]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** True while the villa is read-only because its payment is due. False outside the villa app (the Super Admin area). */
export function useReadOnly() {
  return useContext(StoreContext)?.readOnly ?? false;
}

/** Before the first payment: opens the subscribe popup. Null once subscribed. */
export function useSubscribePrompt() {
  const store = useContext(StoreContext);
  const awaiting = !!store?.awaitingPayment;
  const setOpen = store?.setSubscribeOpen;
  return useMemo(() => (awaiting && setOpen ? () => setOpen(true) : null), [awaiting, setOpen]);
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
