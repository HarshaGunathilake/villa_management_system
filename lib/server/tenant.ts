import { checkAvailability } from "../availability";
import { DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT, normalizeTime } from "../times";
import {
  AMENITY_UNITS,
  EXPENSE_CATEGORIES,
  SOURCES,
  type Amenity,
  type AppData,
  type Booking,
  type BookingExtra,
  type Expense,
  type Guest,
  type Room,
  type VillaSubscription,
} from "../types";
import { extrasTotal } from "../utils";
import { loadBilling } from "./billing";
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
}

async function loadVillaRow(q: Db, villaId: string, lock = false) {
  const row = await q.one<VillaRow>(
    `SELECT name, location, phone, max_guests, price, check_in_time, check_out_time FROM villas WHERE id = ?${lock ? " FOR UPDATE" : ""}`,
    [villaId],
  );
  if (!row) throw notFound("Villa");
  return row;
}

/** The whole of one villa's data, in the shape the app's screens already use. */
export async function loadVillaData(villaId: string, userName: string): Promise<AppData> {
  const villa = await loadVillaRow(db, villaId);
  const [rooms, guests, bookings, expenses, amenities] = await Promise.all([
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
    },
    rooms,
    guests: guests.map((g) => ({ id: g.id, name: g.name, phone: g.phone, email: g.email ?? undefined, country: g.country ?? undefined })),
    bookings,
    expenses: expenses.map((e) => ({ id: e.id, name: e.name, category: e.category, amount: e.amount, date: e.date, note: e.note ?? undefined, receiptName: e.receipt_name ?? undefined })),
    amenities: amenities.map((a) => ({ id: a.id, name: a.name, price: a.price, unit: a.unit, enabled: !!a.enabled })),
  };
}

/**
 * The villa's own subscription and the payments recorded for it. Internal notes
 * and who recorded each payment stay with the Super Admin.
 */
export async function loadVillaSubscription(villaId: string): Promise<VillaSubscription> {
  const villa = await db.one<{ plan: string; monthly_subscription_amount: number; subscription_status: VillaSubscription["status"]; subscription_start_date: string; next_payment_date: string }>(
    "SELECT plan, monthly_subscription_amount, subscription_status, subscription_start_date, next_payment_date FROM villas WHERE id = ?",
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
      await mustAffect(db.run("DELETE FROM expenses WHERE villa_id = ? AND id = ?", [villaId, recordId(body.id, "Expense")]), "Expense");
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
      if (typeof patch.ownerName === "string" && patch.ownerName.trim().length >= 2) {
        await db.run("UPDATE users SET name = ?, updated_at = ? WHERE id = ? AND villa_id = ?", [text(patch.ownerName, "Your name", { max: 120 }), nowSql(), ctx.userId, villaId]);
      }
      return;
    }

    default:
      throw badRequest("Unknown action.");
  }
}
