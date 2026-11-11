import { checkAvailability } from "../availability";
import { DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT, normalizeTime } from "../times";
import {
  AMENITY_UNITS,
  BILL_REPEATS,
  EXPENSE_CATEGORIES,
  SOURCES,
  type Amenity,
  type AppData,
  type Booking,
  type BookingExtra,
  type Bill,
  type BillPayment,
  type Expense,
  type Guest,
  type PayLine,
  type Payslip,
  type Room,
  type Staff,
  type VillaSubscription,
  PAY_TYPES,
} from "../types";
import { billExpense, isBillPeriod } from "../bills";
import { payslipExpense } from "../payroll";
import { extrasTotal } from "../utils";
import { loadBilling, trialOffer } from "./billing";
import { nowSql, serverToday } from "./config";
import { db, transaction, type Db } from "./db";
import { ApiError, badRequest, clockTime, integer, isoDate, notFound, oneOf, recordId, text } from "./http";

/**
 * Everything a villa admin can read or change. Every query here is filtered by
 * the villa id that the route took from the signed-in session.
 */

/* ------------------------------------------------------------------ reading */

interface BookingRow {
  id: string;
  type: "villa" | "room";
  room_id: string | null;
  guest_id: string;
  check_in: string;
  check_out: string;
  check_in_time: string | null;
  check_out_time: string | null;
  adults: number;
  children: number;
  source: Booking["source"];
  extras: string | null;
  total: number;
  paid: number;
  notes: string | null;
  status: Booking["status"];
  created_on: string;
  checked_out_on: string | null;
}

function toBooking(r: BookingRow): Booking {
  let extras: BookingExtra[] | undefined;
  try {
    extras = r.extras ? (JSON.parse(r.extras) as BookingExtra[]) : undefined;
  } catch {
    extras = undefined;
  }
  return {
    id: r.id,
    type: r.type,
    roomId: r.room_id ?? undefined,
    guestId: r.guest_id,
    checkIn: r.check_in,
    checkOut: r.check_out,
    checkInTime: r.check_in_time ?? undefined,
    checkOutTime: r.check_out_time ?? undefined,
    adults: r.adults,
    children: r.children,
    source: r.source,
    extras: extras?.length ? extras : undefined,
    total: r.total,
    paid: r.paid,
    notes: r.notes ?? "",
    status: r.status,
    createdAt: r.created_on,
    checkedOutOn: r.checked_out_on ?? undefined,
  };
}

export async function loadBookings(q: Db, villaId: string) {
  const rows = await q.query<BookingRow>("SELECT * FROM bookings WHERE villa_id = ? ORDER BY seq", [villaId]);
  return rows.map(toBooking);
}

export async function loadRooms(q: Db, villaId: string): Promise<Room[]> {
  const rows = await q.query<{ id: string; name: string; view: string; capacity: number; price: number; enabled: number; photo: string | null }>(
    "SELECT id, name, view, capacity, price, enabled, photo FROM rooms WHERE villa_id = ? ORDER BY position, id",
    [villaId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, view: r.view, capacity: r.capacity, price: r.price, enabled: !!r.enabled, photo: r.photo ?? undefined }));
}

interface VillaRow {
  name: string;
  location: string;
  phone: string;
  max_guests: number;
  price: number;
  check_in_time: string;
  check_out_time: string;
  monthly_report: number;
  report_cc: string | null;
}

async function loadVillaRow(q: Db, villaId: string, lock = false) {
  const row = await q.one<VillaRow>(
    `SELECT name, location, phone, max_guests, price, check_in_time, check_out_time, monthly_report, report_cc FROM villas WHERE id = ?${lock ? " FOR UPDATE" : ""}`,
    [villaId],
  );
  if (!row) throw notFound("Villa");
  return row;
}

/** The whole of one villa's data, in the shape the app's screens already use. */
interface StaffRow { id: string; name: string; role: string; phone: string; pay_type: Staff["payType"]; rate: number; epf: number; epf_number: string | null; active: number }
interface PayslipRow {
  id: string; number: number; staff_id: string; staff_name: string; staff_role: string; pay_type: Staff["payType"]; rate: number; month: string; days: number | null;
  additions: string | null; deductions: string | null; epf: number; epf_number: string | null; note: string | null; created_on: string; paid_on: string | null; expense_id: string | null;
}
const lines = (raw: string | null): PayLine[] => {
  try {
    return raw ? (JSON.parse(raw) as PayLine[]) : [];
  } catch {
    return [];
  }
};
const toStaff = (r: StaffRow): Staff => ({ id: r.id, name: r.name, role: r.role, phone: r.phone, payType: r.pay_type, rate: r.rate, epf: !!r.epf, epfNumber: r.epf_number ?? undefined, active: !!r.active });
const toPayslip = (r: PayslipRow): Payslip => ({
  id: r.id, number: r.number, staffId: r.staff_id, staffName: r.staff_name, staffRole: r.staff_role, payType: r.pay_type, rate: r.rate, month: r.month,
  days: r.days ?? undefined, additions: lines(r.additions), deductions: lines(r.deductions), epf: !!r.epf, epfNumber: r.epf_number ?? undefined,
  note: r.note ?? undefined, createdOn: r.created_on, paidOn: r.paid_on ?? undefined, expenseId: r.expense_id ?? undefined,
});

export async function loadStaff(q: Db, villaId: string) {
  return (await q.query<StaffRow>("SELECT * FROM staff WHERE villa_id = ? ORDER BY position", [villaId])).map(toStaff);
}
interface BillRow { id: string; name: string; category: Bill["category"]; amount: number; repeat_every: Bill["repeat"]; due_day: number; start_month: string; active: number; note: string | null }
interface BillPaymentRow { bill_id: string; period: string; paid_on: string; amount: number; expense_id: string | null; skipped: number }
const toBill = (r: BillRow): Bill => ({
  id: r.id, name: r.name, category: r.category, amount: r.amount, repeat: r.repeat_every, dueDay: r.due_day, startMonth: r.start_month, active: !!r.active, note: r.note ?? undefined,
});
const toBillPayment = (r: BillPaymentRow): BillPayment => ({
  billId: r.bill_id, period: r.period, paidOn: r.paid_on, amount: r.amount, expenseId: r.expense_id ?? undefined, skipped: !!r.skipped,
});
export async function loadBills(q: Db, villaId: string) {
  return (await q.query<BillRow>("SELECT * FROM bills WHERE villa_id = ? ORDER BY position", [villaId])).map(toBill);
}
export async function loadBillPayments(q: Db, villaId: string) {
  return (await q.query<BillPaymentRow>("SELECT * FROM bill_payments WHERE villa_id = ? ORDER BY paid_on DESC, period DESC", [villaId])).map(toBillPayment);
}
export async function loadPayslips(q: Db, villaId: string) {
  return (await q.query<PayslipRow>("SELECT * FROM payslips WHERE villa_id = ? ORDER BY number DESC", [villaId])).map(toPayslip);
}

export async function loadVillaData(villaId: string, userName: string, userEmail = ""): Promise<AppData> {
  const villa = await loadVillaRow(db, villaId);
  const [rooms, guests, bookings, expenses, amenities, staff, payslips, bills, billPayments] = await Promise.all([
    loadRooms(db, villaId),
    db.query<{ id: string; name: string; phone: string; email: string | null; country: string | null }>(
      "SELECT id, name, phone, email, country FROM guests WHERE villa_id = ? ORDER BY position",
      [villaId],
    ),
    loadBookings(db, villaId),
    db.query<{ id: string; name: string; category: Expense["category"]; amount: number; date: string; note: string | null; receipt_name: string | null }>(
      "SELECT id, name, category, amount, date, note, receipt_name FROM expenses WHERE villa_id = ? ORDER BY position DESC",
      [villaId],
    ),
    db.query<{ id: string; name: string; price: number; unit: Amenity["unit"]; enabled: number }>(
      "SELECT id, name, price, unit, enabled FROM amenities WHERE villa_id = ? ORDER BY position",
      [villaId],
    ),
    loadStaff(db, villaId),
    loadPayslips(db, villaId),
    loadBills(db, villaId),
    loadBillPayments(db, villaId),
  ]);

  return {
    villa: {
      name: villa.name,
      location: villa.location,
      phone: villa.phone,
      maxGuests: villa.max_guests,
      price: villa.price,
      ownerName: userName,
      checkInTime: normalizeTime(villa.check_in_time, DEFAULT_CHECK_IN),
      checkOutTime: normalizeTime(villa.check_out_time, DEFAULT_CHECK_OUT),
      monthlyReport: !!villa.monthly_report,
      reportCc: villa.report_cc ?? "",
      ownerEmail: userEmail,
    },
    rooms,
    guests: guests.map((g) => ({ id: g.id, name: g.name, phone: g.phone, email: g.email ?? undefined, country: g.country ?? undefined })),
    bookings,
    expenses: expenses.map((e) => ({ id: e.id, name: e.name, category: e.category, amount: e.amount, date: e.date, note: e.note ?? undefined, receiptName: e.receipt_name ?? undefined })),
    amenities: amenities.map((a) => ({ id: a.id, name: a.name, price: a.price, unit: a.unit, enabled: !!a.enabled })),
    staff,
    payslips,
    bills,
    billPayments,
  };
}

/**
 * The villa's own subscription and the payments recorded for it. Internal notes
 * and who recorded each payment stay with the Super Admin.
 */
export async function loadVillaSubscription(villaId: string): Promise<VillaSubscription> {
  const villa = await db.one<{
    plan: string; monthly_subscription_amount: number; subscription_status: VillaSubscription["status"]; subscription_start_date: string; next_payment_date: string;
    disabled_reason: string | null; dodo_subscription_id: string | null; dodo_status: string | null; trial_days: number | null; trial_ends_on: string | null;
    free_until: string | null; cancel_at_period_end: number;
  }>(
    `SELECT plan, monthly_subscription_amount, subscription_status, subscription_start_date, next_payment_date,
            disabled_reason, dodo_subscription_id, dodo_status, trial_days, trial_ends_on, free_until, cancel_at_period_end FROM villas WHERE id = ?`,
    [villaId],
  );
  if (!villa) throw notFound("Villa");
  const [payments, settings] = await Promise.all([
    db.query<{ id: string; amount: number; payment_date: string; period_start: string; period_end: string; note: string }>(
      "SELECT id, amount, payment_date, period_start, period_end, note FROM subscription_payments WHERE villa_id = ? ORDER BY payment_date DESC, created_at DESC LIMIT 24",
      [villaId],
    ),
    db.query<{ name: string; value: string }>("SELECT name, value FROM platform_settings WHERE name IN ('supportEmail','supportPhone')"),
  ]);
  const setting = (name: string) => settings.find((s) => s.name === name)?.value ?? "";
  return {
    plan: villa.plan,
    monthlyAmount: villa.monthly_subscription_amount,
    status: villa.subscription_status,
    startDate: villa.subscription_start_date,
    nextPaymentDate: villa.next_payment_date,
    payments: payments.map((p) => ({ id: p.id, amount: p.amount, paymentDate: p.payment_date, periodStart: p.period_start, periodEnd: p.period_end, note: p.note })),
    billing: await loadBilling(villaId),
    support: { email: setting("supportEmail"), phone: setting("supportPhone") },
    trialEndsOn: villa.trial_ends_on && villa.trial_ends_on > serverToday() && villa.dodo_status === "active" ? villa.trial_ends_on : null,
    trialOffer: await trialOffer(villa),
    freeUntil: villa.free_until,
    endsAtPeriodEnd: !!villa.cancel_at_period_end && villa.dodo_status !== null && ["active", "on_hold", "past_due", "paused"].includes(villa.dodo_status),
  };
}

/* ------------------------------------------------------------------ writing */

export async function insertRoom(q: Db, villaId: string, r: Room, position = 0) {
  await q.run("INSERT INTO rooms (villa_id, id, name, view, capacity, price, enabled, photo, position) VALUES (?,?,?,?,?,?,?,?,?)", [
    villaId, r.id, r.name, r.view, r.capacity, r.price, r.enabled ? 1 : 0, r.photo ?? null, position,
  ]);
}

export async function insertGuest(q: Db, villaId: string, g: Guest) {
  await q.run("INSERT INTO guests (villa_id, id, name, phone, email, country) VALUES (?,?,?,?,?,?)", [villaId, g.id, g.name, g.phone, g.email ?? null, g.country ?? null]);
}

export async function insertBooking(q: Db, villaId: string, b: Booking) {
  await q.run(
    `INSERT INTO bookings (villa_id, id, type, room_id, guest_id, check_in, check_out, check_in_time, check_out_time, adults, children, source, extras, total, paid, notes, status, created_on, checked_out_on)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      villaId, b.id, b.type, b.type === "room" ? b.roomId ?? null : null, b.guestId, b.checkIn, b.checkOut, b.checkInTime ?? null, b.checkOutTime ?? null,
      b.adults, b.children, b.source, b.extras?.length ? JSON.stringify(b.extras) : null, b.total, b.paid, b.notes ?? "", b.status, b.createdAt, b.checkedOutOn ?? null,
    ],
  );
}

export async function insertExpense(q: Db, villaId: string, e: Expense) {
  await q.run("INSERT INTO expenses (villa_id, id, name, category, amount, date, note, receipt_name) VALUES (?,?,?,?,?,?,?,?)", [
    villaId, e.id, e.name, e.category, e.amount, e.date, e.note ?? null, e.receiptName ?? null,
  ]);
}

export async function insertAmenity(q: Db, villaId: string, a: Amenity) {
  await q.run("INSERT INTO amenities (villa_id, id, name, price, unit, enabled) VALUES (?,?,?,?,?,?)", [villaId, a.id, a.name, a.price, a.unit, a.enabled ? 1 : 0]);
}

/* ----------------------------------------------------------- input cleaning */

type Body = Record<string, unknown>;
const obj = (value: unknown, label: string): Body => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest(`${label} is missing.`);
  return value as Body;
};
const optional = (value: unknown) => (value === undefined || value === null || value === "" ? undefined : value);

function cleanExtras(value: unknown): BookingExtra[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 60) throw badRequest("Items are not valid.");
  return value.map((raw) => {
    const e = obj(raw, "Item");
    return {
      amenityId: recordId(e.amenityId, "Item"),
      name: text(e.name, "Item name", { min: 1, max: 120 }),
      price: integer(e.price, "Item price"),
      unit: oneOf(e.unit, [...AMENITY_UNITS, "each"] as const, "Item unit"),
      qty: integer(e.qty, "Quantity", { min: 1, max: 999 }),
    };
  });
}

/** The parts of a booking an admin may set. Status and dates of record are decided by the server. */
function cleanBookingFields(input: Body) {
  const type = oneOf(input.type, ["villa", "room"] as const, "Booking type");
  const total = integer(input.total, "Total");
  return {
    type,
    roomId: type === "room" ? recordId(input.roomId, "Room") : undefined,
    guestId: recordId(input.guestId, "Guest"),
    checkIn: isoDate(input.checkIn, "Check-in"),
    checkOut: isoDate(input.checkOut, "Check-out"),
    checkInTime: clockTime(input.checkInTime, "Check-in time") ?? undefined,
    checkOutTime: clockTime(input.checkOutTime, "Check-out time") ?? undefined,
    adults: integer(input.adults, "Adults", { min: 1, max: 500 }),
    children: integer(input.children, "Children", { min: 0, max: 500 }),
    source: oneOf(input.source, SOURCES, "Source"),
    extras: cleanExtras(input.extras),
    total,
    paid: Math.min(integer(input.paid ?? 0, "Paid"), total),
    notes: text(input.notes, "Notes", { max: 2000, optional: true }),
  };
}

function cleanGuest(input: Body) {
  return {
    name: text(input.name, "Guest name", { min: 2, max: 120 }),
    phone: text(input.phone, "Phone", { max: 40 }),
    email: (optional(input.email) && text(input.email, "Email", { max: 190 })) || undefined,
    country: (optional(input.country) && text(input.country, "Country", { max: 80 })) || undefined,
  };
}

function cleanStaff(input: Body) {
  return {
    name: text(input.name, "Name", { min: 2, max: 120 }),
    role: text(input.role, "Job", { max: 80, optional: true }),
    phone: text(input.phone, "Phone", { max: 40, optional: true }),
    payType: oneOf(input.payType, PAY_TYPES, "Pay type"),
    rate: integer(input.rate, "Pay", { min: 1, max: 10_000_000 }),
    epf: input.epf === true,
    epfNumber: text(input.epfNumber, "EPF number", { max: 40, optional: true }) || undefined,
    active: input.active !== false,
  };
}

function cleanBill(input: Body): Omit<Bill, "id"> {
  const startMonth = text(input.startMonth, "First due month", { min: 7, max: 7 });
  if (!MONTH.test(startMonth)) throw badRequest("First due month is not valid.");
  return {
    name: text(input.name, "Bill name", { min: 2, max: 120 }),
    category: oneOf(input.category, EXPENSE_CATEGORIES, "Category"),
    amount: integer(input.amount, "Amount", { min: 0, max: 100_000_000 }),
    repeat: oneOf(input.repeat, BILL_REPEATS, "Repeats"),
    dueDay: integer(input.dueDay, "Due day", { min: 1, max: 31 }),
    startMonth,
    active: input.active !== false,
    note: text(input.note, "Note", { max: 500, optional: true }) || undefined,
  };
}

function cleanLines(value: unknown, label: string): PayLine[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 12) throw badRequest(`${label} are not valid.`);
  return value.map((raw) => {
    const l = obj(raw, label);
    return { name: text(l.name, `${label} name`, { min: 1, max: 80 }), amount: integer(l.amount, `${label} amount`, { min: 1, max: 10_000_000 }) };
  });
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Records that a payslip was paid and adds it to the villa's expenses, in one go. */
async function payPayslip(q: Db, villaId: string, p: Payslip, paidOn: string, expenseId: string) {
  const e = payslipExpense(p);
  await insertExpense(q, villaId, { id: expenseId, name: e.name.slice(0, 160), category: "Staff", amount: Math.max(e.amount, 1), date: paidOn, note: e.note.slice(0, 500) });
  await q.run("UPDATE payslips SET paid_on = ?, expense_id = ? WHERE villa_id = ? AND id = ?", [paidOn, expenseId, villaId, p.id]);
}

function cleanPhoto(value: unknown) {
  const photo = text(value, "Photo", { max: 500, optional: true });
  if (photo && !/^(https:\/\/|\/)/.test(photo)) throw badRequest("Photo must be a web address.");
  return photo || undefined;
}

/* ------------------------------------------------------------------ actions */

export interface VillaContext {
  villaId: string;
  userId: string;
}

async function bookingOrThrow(q: Db, villaId: string, id: string) {
  const row = await q.one<BookingRow>("SELECT * FROM bookings WHERE villa_id = ? AND id = ?", [villaId, id]);
  if (!row) throw notFound("Booking");
  return toBooking(row);
}

async function mustAffect(result: Promise<{ affectedRows: number }>, what: string) {
  if ((await result).affectedRows === 0) throw notFound(what);
}

const conflict = (title: string, message: string) => new ApiError(409, "conflict", `${title}. ${message}`);

/** Apply one change for one villa. The same booking rules the screens use are checked again here. */
export async function runVillaAction(ctx: VillaContext, body: Body): Promise<void> {
  const { villaId } = ctx;
  const type = text(body.type, "Action", { min: 1, max: 40 });

  switch (type) {
    /* ---- bookings: serialised per villa so two requests can never both take the same nights */
    case "addBooking":
    case "updateBooking": {
      await transaction(async (tx) => {
        const villa = await loadVillaRow(tx, villaId, true);
        const usual = { checkInTime: normalizeTime(villa.check_in_time, DEFAULT_CHECK_IN), checkOutTime: normalizeTime(villa.check_out_time, DEFAULT_CHECK_OUT) };
        const [rooms, bookings] = [await loadRooms(tx, villaId), await loadBookings(tx, villaId)];

        if (type === "addBooking") {
          const input = obj(body.booking, "Booking");
          const id = recordId(input.id, "Booking id");
          const fields = cleanBookingFields(input);
          if (!(await tx.one("SELECT id FROM guests WHERE villa_id = ? AND id = ?", [villaId, fields.guestId]))) throw notFound("Guest");
          if (bookings.some((b) => b.id === id)) throw new ApiError(409, "conflict", "This booking already exists.");
          const check = checkAvailability(fields, bookings, rooms, undefined, usual);
          if (!check.ok) throw conflict(check.title, check.message);
          await insertBooking(tx, villaId, { ...fields, extras: fields.extras, id, status: "confirmed", createdAt: serverToday() });
          return;
        }

        const id = recordId(body.id, "Booking");
        const current = bookings.find((b) => b.id === id);
        if (!current) throw notFound("Booking");
        const fields = cleanBookingFields({ ...current, ...obj(body.patch, "Changes") });
        if (!(await tx.one("SELECT id FROM guests WHERE villa_id = ? AND id = ?", [villaId, fields.guestId]))) throw notFound("Guest");
        const check = checkAvailability(fields, bookings, rooms, id, usual);
        if (!check.ok) throw conflict(check.title, check.message);
        await tx.run(
          `UPDATE bookings SET type=?, room_id=?, guest_id=?, check_in=?, check_out=?, check_in_time=?, check_out_time=?, adults=?, children=?, source=?, extras=?, total=?, paid=?, notes=?
            WHERE villa_id = ? AND id = ?`,
          [
            fields.type, fields.roomId ?? null, fields.guestId, fields.checkIn, fields.checkOut, fields.checkInTime ?? null, fields.checkOutTime ?? null, fields.adults, fields.children,
            fields.source, fields.extras.length ? JSON.stringify(fields.extras) : null, fields.total, fields.paid, fields.notes, villaId, id,
          ],
        );
      });
      return;
    }

    case "checkIn": {
      const id = recordId(body.id, "Booking");
      const b = await bookingOrThrow(db, villaId, id);
      if (b.status !== "confirmed") throw badRequest("Only a confirmed booking can be checked in.");
      await db.run("UPDATE bookings SET status = 'checked_in' WHERE villa_id = ? AND id = ?", [villaId, id]);
      return;
    }

    case "checkOut": {
      const id = recordId(body.id, "Booking");
      const b = await bookingOrThrow(db, villaId, id);
      if (b.status !== "checked_in") throw badRequest("Only a guest who is checked in can be checked out.");
      if (b.total - b.paid > 0) throw new ApiError(409, "balance_due", "Full payment is needed before check-out.");
      await db.run("UPDATE bookings SET status = 'checked_out', checked_out_on = ? WHERE villa_id = ? AND id = ?", [serverToday(), villaId, id]);
      return;
    }

    case "cancelBooking": {
      const id = recordId(body.id, "Booking");
      await mustAffect(db.run("UPDATE bookings SET status = 'cancelled' WHERE villa_id = ? AND id = ? AND status <> 'checked_out'", [villaId, id]), "Booking");
      return;
    }

    case "recordPayment": {
      const id = recordId(body.id, "Booking");
      const amount = integer(body.amount, "Amount", { min: 1 });
      await mustAffect(db.run("UPDATE bookings SET paid = LEAST(total, paid + ?) WHERE villa_id = ? AND id = ?", [amount, villaId, id]), "Booking");
      return;
    }

    case "setBookingExtras": {
      const id = recordId(body.id, "Booking");
      const extras = cleanExtras(body.extras);
      const b = await bookingOrThrow(db, villaId, id);
      const total = Math.max(b.total - extrasTotal(b.extras) + extrasTotal(extras), 0);
      await db.run("UPDATE bookings SET extras = ?, total = ? WHERE villa_id = ? AND id = ?", [extras.length ? JSON.stringify(extras) : null, total, villaId, id]);
      return;
    }

    /* ---- guests */
    case "addGuest": {
      const input = obj(body.guest, "Guest");
      await insertGuest(db, villaId, { id: recordId(input.id, "Guest id"), ...cleanGuest(input) });
      return;
    }
    case "updateGuest": {
      const id = recordId(body.id, "Guest");
      const current = await db.one<Body>("SELECT name, phone, email, country FROM guests WHERE villa_id = ? AND id = ?", [villaId, id]);
      if (!current) throw notFound("Guest");
      const g = cleanGuest({ ...current, ...obj(body.patch, "Changes") });
      await db.run("UPDATE guests SET name=?, phone=?, email=?, country=? WHERE villa_id = ? AND id = ?", [g.name, g.phone, g.email ?? null, g.country ?? null, villaId, id]);
      return;
    }

    /* ---- expenses */
    case "addExpense": {
      const input = obj(body.expense, "Expense");
      await insertExpense(db, villaId, {
        id: recordId(input.id, "Expense id"),
        name: text(input.name, "Expense name", { min: 1, max: 160 }),
        category: oneOf(input.category, EXPENSE_CATEGORIES, "Category"),
        amount: integer(input.amount, "Amount", { min: 1 }),
        date: isoDate(input.date, "Date"),
        note: text(input.note, "Note", { max: 500, optional: true }) || undefined,
        receiptName: text(input.receiptName, "Receipt", { max: 255, optional: true }) || undefined,
      });
      return;
    }
    case "deleteExpense": {
      const id = recordId(body.id, "Expense");
      await transaction(async (tx) => {
        await mustAffect(tx.run("DELETE FROM expenses WHERE villa_id = ? AND id = ?", [villaId, id]), "Expense");
        // A paid bill whose expense is deleted goes back to unpaid.
        await tx.run("DELETE FROM bill_payments WHERE villa_id = ? AND expense_id = ?", [villaId, id]);
      });
      return;
    }

    /* ---- rooms */
    case "addRoom": {
      const input = obj(body.room, "Room");
      const position = (await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM rooms WHERE villa_id = ?", [villaId]))?.n ?? 0;
      await insertRoom(
        db,
        villaId,
        {
          id: recordId(input.id, "Room id"),
          name: text(input.name, "Room name", { min: 2, max: 120 }),
          view: text(input.view, "Description", { max: 160, optional: true }),
          capacity: integer(input.capacity, "Guests", { min: 1, max: 100 }),
          price: integer(input.price, "Price"),
          enabled: input.enabled !== false,
          photo: cleanPhoto(input.photo),
        },
        Number(position),
      );
      return;
    }
    case "updateRoom": {
      const id = recordId(body.id, "Room");
      const current = (await loadRooms(db, villaId)).find((r) => r.id === id);
      if (!current) throw notFound("Room");
      const next = { ...current, ...obj(body.patch, "Changes") } as Body;
      await db.run("UPDATE rooms SET name=?, view=?, capacity=?, price=?, enabled=?, photo=? WHERE villa_id = ? AND id = ?", [
        text(next.name, "Room name", { min: 2, max: 120 }),
        text(next.view, "Description", { max: 160, optional: true }),
        integer(next.capacity, "Guests", { min: 1, max: 100 }),
        integer(next.price, "Price"),
        next.enabled === false ? 0 : 1,
        cleanPhoto(next.photo) ?? null,
        villaId,
        id,
      ]);
      return;
    }

    /* ---- amenities */
    case "addAmenity": {
      const input = obj(body.amenity, "Amenity");
      await insertAmenity(db, villaId, {
        id: recordId(input.id, "Amenity id"),
        name: text(input.name, "Amenity name", { min: 2, max: 120 }),
        price: integer(input.price, "Price"),
        unit: oneOf(input.unit, AMENITY_UNITS, "Unit"),
        enabled: input.enabled !== false,
      });
      return;
    }
    case "updateAmenity": {
      const id = recordId(body.id, "Amenity");
      const current = await db.one<Body>("SELECT name, price, unit, enabled FROM amenities WHERE villa_id = ? AND id = ?", [villaId, id]);
      if (!current) throw notFound("Amenity");
      const next = { ...current, ...obj(body.patch, "Changes") } as Body;
      await db.run("UPDATE amenities SET name=?, price=?, unit=?, enabled=? WHERE villa_id = ? AND id = ?", [
        text(next.name, "Amenity name", { min: 2, max: 120 }),
        integer(next.price, "Price"),
        oneOf(next.unit, AMENITY_UNITS, "Unit"),
        next.enabled === false || next.enabled === 0 ? 0 : 1,
        villaId,
        id,
      ]);
      return;
    }
    case "removeAmenity": {
      await mustAffect(db.run("DELETE FROM amenities WHERE villa_id = ? AND id = ?", [villaId, recordId(body.id, "Amenity")]), "Amenity");
      return;
    }

    /* ---- staff and payslips */
    case "addStaff": {
      const input = obj(body.staff, "Staff");
      const s = cleanStaff(input);
      await db.run("INSERT INTO staff (villa_id, id, name, role, phone, pay_type, rate, epf, epf_number, active) VALUES (?,?,?,?,?,?,?,?,?,?)", [
        villaId, recordId(input.id, "Staff id"), s.name, s.role, s.phone, s.payType, s.rate, s.epf ? 1 : 0, s.epfNumber ?? null, s.active ? 1 : 0,
      ]);
      return;
    }
    case "updateStaff": {
      const id = recordId(body.id, "Staff");
      const current = (await loadStaff(db, villaId)).find((s) => s.id === id);
      if (!current) throw notFound("Staff member");
      const s = cleanStaff({ ...current, ...obj(body.patch, "Changes") });
      await db.run("UPDATE staff SET name=?, role=?, phone=?, pay_type=?, rate=?, epf=?, epf_number=?, active=? WHERE villa_id = ? AND id = ?", [
        s.name, s.role, s.phone, s.payType, s.rate, s.epf ? 1 : 0, s.epfNumber ?? null, s.active ? 1 : 0, villaId, id,
      ]);
      return;
    }
    case "removeStaff": {
      const id = recordId(body.id, "Staff");
      if (await db.one("SELECT 1 FROM payslips WHERE villa_id = ? AND staff_id = ? LIMIT 1", [villaId, id])) {
        throw new ApiError(409, "conflict", "This person has payslips, so they can't be removed. Mark them as no longer working here instead.");
      }
      await mustAffect(db.run("DELETE FROM staff WHERE villa_id = ? AND id = ?", [villaId, id]), "Staff member");
      return;
    }
    case "addPayslip": {
      const input = obj(body.payslip, "Payslip");
      await transaction(async (tx) => {
        await loadVillaRow(tx, villaId, true); // one payslip number at a time per villa
        const staffId = recordId(input.staffId, "Staff");
        const person = (await loadStaff(tx, villaId)).find((s) => s.id === staffId);
        if (!person) throw notFound("Staff member");
        const month = text(input.month, "Month", { min: 7, max: 7 });
        if (!MONTH.test(month)) throw badRequest("Month is not valid.");
        const payType = oneOf(input.payType ?? person.payType, PAY_TYPES, "Pay type");
        const days = payType === "daily" ? integer(input.days, "Days worked", { min: 1, max: 31 }) : undefined;
        const n = Number((await tx.one<{ n: number | null }>("SELECT MAX(number) AS n FROM payslips WHERE villa_id = ?", [villaId]))?.n ?? 0) + 1;
        const p: Payslip = {
          id: recordId(input.id, "Payslip id"),
          number: n,
          staffId,
          staffName: person.name,
          staffRole: person.role,
          payType,
          rate: integer(input.rate ?? person.rate, "Pay", { min: 1, max: 10_000_000 }),
          month,
          days,
          additions: cleanLines(input.additions, "Additions"),
          deductions: cleanLines(input.deductions, "Deductions"),
          epf: input.epf === undefined ? person.epf : input.epf === true,
          epfNumber: person.epfNumber,
          note: text(input.note, "Note", { max: 500, optional: true }) || undefined,
          createdOn: serverToday(),
        };
        await tx.run(
          `INSERT INTO payslips (villa_id, id, number, staff_id, staff_name, staff_role, pay_type, rate, month, days, additions, deductions, epf, epf_number, note, created_on)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [villaId, p.id, p.number, p.staffId, p.staffName, p.staffRole, p.payType, p.rate, p.month, p.days ?? null, JSON.stringify(p.additions), JSON.stringify(p.deductions), p.epf ? 1 : 0, p.epfNumber ?? null, p.note ?? null, p.createdOn],
        );
        if (body.paidOn) await payPayslip(tx, villaId, p, isoDate(body.paidOn, "Paid on"), recordId(body.expenseId, "Expense id"));
      });
      return;
    }
    case "payPayslip": {
      const id = recordId(body.id, "Payslip");
      await transaction(async (tx) => {
        const row = await tx.one<PayslipRow>("SELECT * FROM payslips WHERE villa_id = ? AND id = ? FOR UPDATE", [villaId, id]);
        if (!row) throw notFound("Payslip");
        if (row.paid_on) throw new ApiError(409, "conflict", "This payslip is already marked as paid.");
        await payPayslip(tx, villaId, toPayslip(row), isoDate(body.paidOn, "Paid on"), recordId(body.expenseId, "Expense id"));
      });
      return;
    }
    case "deletePayslip": {
      const id = recordId(body.id, "Payslip");
      await transaction(async (tx) => {
        const row = await tx.one<PayslipRow>("SELECT * FROM payslips WHERE villa_id = ? AND id = ? FOR UPDATE", [villaId, id]);
        if (!row) throw notFound("Payslip");
        if (row.expense_id) await tx.run("DELETE FROM expenses WHERE villa_id = ? AND id = ?", [villaId, row.expense_id]);
        await tx.run("DELETE FROM payslips WHERE villa_id = ? AND id = ?", [villaId, id]);
      });
      return;
    }

    /* ---- bills that come round again */
    case "addBill": {
      const b = cleanBill(obj(body.bill, "Bill"));
      await db.run("INSERT INTO bills (villa_id, id, name, category, amount, repeat_every, due_day, start_month, active, note) VALUES (?,?,?,?,?,?,?,?,?,?)", [
        villaId, recordId(obj(body.bill, "Bill").id, "Bill id"), b.name, b.category, b.amount, b.repeat, b.dueDay, b.startMonth, b.active ? 1 : 0, b.note ?? null,
      ]);
      return;
    }
    case "updateBill": {
      const id = recordId(body.id, "Bill");
      const current = (await loadBills(db, villaId)).find((b) => b.id === id);
      if (!current) throw notFound("Bill");
      const b = cleanBill({ ...current, ...obj(body.patch, "Changes") });
      await db.run("UPDATE bills SET name=?, category=?, amount=?, repeat_every=?, due_day=?, start_month=?, active=?, note=? WHERE villa_id = ? AND id = ?", [
        b.name, b.category, b.amount, b.repeat, b.dueDay, b.startMonth, b.active ? 1 : 0, b.note ?? null, villaId, id,
      ]);
      return;
    }
    case "deleteBill": {
      // Its payment records go with it; the expenses it became stay in Expenses.
      await mustAffect(db.run("DELETE FROM bills WHERE villa_id = ? AND id = ?", [villaId, recordId(body.id, "Bill")]), "Bill");
      return;
    }
    case "payBill":
    case "skipBill": {
      const billId = recordId(body.billId, "Bill");
      const period = text(body.period, "Month", { min: 7, max: 7 });
      if (!MONTH.test(period)) throw badRequest("Month is not valid.");
      const paidOn = isoDate(body.paidOn ?? serverToday(), "Paid on");
      await transaction(async (tx) => {
        const row = await tx.one<BillRow>("SELECT * FROM bills WHERE villa_id = ? AND id = ? FOR UPDATE", [villaId, billId]);
        if (!row) throw notFound("Bill");
        const bill = toBill(row);
        if (!isBillPeriod(bill, period)) throw badRequest(`${bill.name} is not due in that month.`);
        if (await tx.one("SELECT 1 AS x FROM bill_payments WHERE villa_id = ? AND bill_id = ? AND period = ?", [villaId, billId, period])) {
          throw new ApiError(409, "conflict", "This bill is already marked as paid for that month.");
        }
        if (body.type === "skipBill") {
          await tx.run("INSERT INTO bill_payments (villa_id, bill_id, period, paid_on, amount, expense_id, skipped) VALUES (?,?,?,?,0,NULL,1)", [villaId, billId, period, paidOn]);
          return;
        }
        const amount = integer(body.amount, "Amount", { min: 1, max: 100_000_000 });
        const expenseId = recordId(body.expenseId, "Expense id");
        const e = billExpense(bill, period);
        await insertExpense(tx, villaId, { id: expenseId, name: e.name.slice(0, 160), category: e.category, amount, date: paidOn, note: e.note });
        await tx.run("INSERT INTO bill_payments (villa_id, bill_id, period, paid_on, amount, expense_id, skipped) VALUES (?,?,?,?,?,?,0)", [villaId, billId, period, paidOn, amount, expenseId]);
      });
      return;
    }
    case "undoBillPayment": {
      const billId = recordId(body.billId, "Bill");
      const period = text(body.period, "Month", { min: 7, max: 7 });
      await transaction(async (tx) => {
        const row = await tx.one<BillPaymentRow>("SELECT * FROM bill_payments WHERE villa_id = ? AND bill_id = ? AND period = ? FOR UPDATE", [villaId, billId, period]);
        if (!row) throw notFound("Bill payment");
        if (row.expense_id) await tx.run("DELETE FROM expenses WHERE villa_id = ? AND id = ?", [villaId, row.expense_id]);
        await tx.run("DELETE FROM bill_payments WHERE villa_id = ? AND bill_id = ? AND period = ?", [villaId, billId, period]);
      });
      return;
    }

    /* ---- the villa's own settings (never its subscription or access) */
    case "updateVilla": {
      const patch = obj(body.patch, "Changes");
      const current = await loadVillaRow(db, villaId);
      const pick = <T,>(value: unknown, fallback: T) => (value === undefined ? fallback : value);
      await db.run("UPDATE villas SET name=?, location=?, phone=?, max_guests=?, price=?, check_in_time=?, check_out_time=?, updated_at=? WHERE id = ?", [
        text(pick(patch.name, current.name), "Villa name", { min: 2, max: 160 }),
        text(pick(patch.location, current.location), "Location", { max: 160, optional: true }),
        text(pick(patch.phone, current.phone), "Phone", { max: 40, optional: true }),
        integer(pick(patch.maxGuests, current.max_guests), "Maximum guests", { min: 1, max: 500 }),
        integer(pick(patch.price, current.price), "Price"),
        clockTime(pick(patch.checkInTime, current.check_in_time), "Check-in time") ?? DEFAULT_CHECK_IN,
        clockTime(pick(patch.checkOutTime, current.check_out_time), "Check-out time") ?? DEFAULT_CHECK_OUT,
        nowSql(),
        villaId,
      ]);
      if (patch.monthlyReport !== undefined || patch.reportCc !== undefined) {
        const cc = text(pick(patch.reportCc, current.report_cc ?? ""), "Also send to", { max: 190, optional: true }).toLowerCase();
        if (cc && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cc)) throw badRequest("Enter a valid email address for the report, or leave it empty.");
        await db.run("UPDATE villas SET monthly_report = ?, report_cc = ? WHERE id = ?", [pick(patch.monthlyReport, !!current.monthly_report) === true ? 1 : 0, cc || null, villaId]);
      }
      if (typeof patch.ownerName === "string" && patch.ownerName.trim().length >= 2) {
        await db.run("UPDATE users SET name = ?, updated_at = ? WHERE id = ? AND villa_id = ?", [text(patch.ownerName, "Your name", { max: 120 }), nowSql(), ctx.userId, villaId]);
      }
      return;
    }

    default:
      throw badRequest("Unknown action.");
  }
}
