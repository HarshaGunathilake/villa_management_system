import { addDays } from "../dates";
import { createSeed, SEED_AMENITIES } from "../seed";
import type { Booking, Guest, Room } from "../types";
import { hashPassword } from "./auth";
import { config, nowSql, serverToday } from "./config";
import type { Db } from "./db";
import { insertAmenity, insertBooking, insertExpense, insertGuest, insertRoom } from "./tenant";

export const DEFAULT_SETTINGS = {
  platformName: "Villa Stay Manager",
  supportEmail: "support@villaplatform.lk",
  supportPhone: "+94 77 000 1122",
  defaultMonthlyAmount: "5000",
};

/** First run only: platform settings, the Super Admin, and (unless SEED_DEMO=false) sample villas. */
export async function seedDatabase(db: Db) {
  for (const [name, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.run("INSERT IGNORE INTO platform_settings (name, value) VALUES (?, ?)", [name, value]);
  }

  const existing = await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  if (Number(existing?.n ?? 0) > 0) return;

  const now = nowSql();
  const today = serverToday();
  await db.run("INSERT INTO users (id, villa_id, name, email, phone, password_hash, role, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    "u_super", null, config.superAdmin.name, config.superAdmin.email, "", await hashPassword(config.superAdmin.password), "super_admin", "active", now, now,
  ]);
  if (!config.seedDemo) return;

  const villa = async (v: {
    id: string; name: string; location: string; phone: string; email: string; address: string; maxGuests: number; price: number;
    monthly: number; subscription: "active" | "payment_due" | "overdue"; access: "active" | "disabled"; started: number; nextDue: number; notes?: string;
    admin: { id: string; name: string; email: string; phone: string; password: string; lastLogin?: number };
  }) => {
    await db.run(
      `INSERT INTO villas (id, name, location, phone, email, address, max_guests, price, plan, monthly_subscription_amount, subscription_status, account_status,
                           subscription_start_date, next_payment_date, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [v.id, v.name, v.location, v.phone, v.email, v.address, v.maxGuests, v.price, "Standard", v.monthly, v.subscription, v.access, addDays(today, v.started), addDays(today, v.nextDue), v.notes ?? null, nowSql(v.started * 86_400_000), now],
    );
    await db.run("INSERT INTO users (id, villa_id, name, email, phone, password_hash, role, status, last_login_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
      v.admin.id, v.id, v.admin.name, v.admin.email, v.admin.phone, await hashPassword(v.admin.password), "villa_admin", "active",
      v.admin.lastLogin === undefined ? null : nowSql(v.admin.lastLogin * 86_400_000), nowSql(v.started * 86_400_000), now,
    ]);
    await log(db, v.id, "villa_created", `${v.name} created`, v.started);
    await log(db, v.id, "admin_created", `Admin account created for ${v.admin.name}`, v.started);
  };

  const payment = async (id: string, villaId: string, amount: number, paidOn: number, from: number, note: string) => {
    await db.run("INSERT INTO subscription_payments (id, villa_id, amount, payment_date, period_start, period_end, status, note, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
      id, villaId, amount, addDays(today, paidOn), addDays(today, from), addDays(today, from + 29), "paid", note, "u_super", nowSql(paidOn * 86_400_000), now,
    ]);
    await log(db, villaId, "payment_recorded", `Subscription marked as paid (LKR ${amount.toLocaleString("en-US")})`, paidOn);
  };

  /* 1. Villa Serenity: the full demo villa */
  await villa({
    id: "v_serenity", name: "Villa Serenity", location: "Unawatuna, Galle", phone: "+94 91 224 5560", email: "hello@villaserenity.lk", address: "12 Beach Road, Unawatuna",
    maxGuests: 8, price: 45000, monthly: 5000, subscription: "active", access: "active", started: -54, nextDue: 6,
    admin: { id: "u_serenity", name: "Harsha Gunathilake", email: "owner@villaserenity.lk", phone: "+94 77 245 0011", password: "serenity2026", lastLogin: 0 },
  });
  const serenity = createSeed(today);
  for (const [i, r] of serenity.rooms.entries()) await insertRoom(db, "v_serenity", r, i);
  for (const g of serenity.guests) await insertGuest(db, "v_serenity", g);
  for (const b of serenity.bookings) await insertBooking(db, "v_serenity", b);
  for (const e of [...serenity.expenses].reverse()) await insertExpense(db, "v_serenity", e);
  for (const a of serenity.amenities) await insertAmenity(db, "v_serenity", a);
  await payment("p_ser_1", "v_serenity", 5000, -54, -54, "First month");
  await payment("p_ser_2", "v_serenity", 5000, -23, -24, "Paid by bank transfer");

  /* 2. Ocean Breeze Villa: a second active customer with its own data */
  await villa({
    id: "v_oceanbreeze", name: "Ocean Breeze Villa", location: "Mirissa, Matara", phone: "+94 41 225 7781", email: "stay@oceanbreeze.lk", address: "48 Harbour Lane, Mirissa",
    maxGuests: 6, price: 38000, monthly: 7500, subscription: "active", access: "active", started: -12, nextDue: 18,
    admin: { id: "u_ocean", name: "Nadeesha Wickramasinghe", email: "admin@oceanbreeze.lk", phone: "+94 71 884 2290", password: "oceanbreeze2026", lastLogin: -1 },
  });
  await smallVilla(db, "v_oceanbreeze", today, [
    { id: "r_ob_1", name: "Sunrise Room", view: "Sea view", capacity: 2, price: 16000, enabled: true },
    { id: "r_ob_2", name: "Coral Room", view: "Courtyard", capacity: 2, price: 13000, enabled: true },
  ], [
    { id: "g_ob_1", name: "Anika Sharma", phone: "+91 98200 55123", country: "India" },
    { id: "g_ob_2", name: "Pieter de Vries", phone: "+31 6 1234 5678", country: "Netherlands" },
  ], 38000);
  await payment("p_ob_1", "v_oceanbreeze", 7500, -12, -12, "First month");

  /* 3. Palm Garden Villa: payment is late, access still on */
  await villa({
    id: "v_palmgarden", name: "Palm Garden Villa", location: "Weligama, Matara", phone: "+94 41 225 0934", email: "info@palmgarden.lk", address: "5 Temple Road, Weligama",
    maxGuests: 10, price: 52000, monthly: 5000, subscription: "payment_due", access: "active", started: -65, nextDue: -4, notes: "Asked for a few more days to pay.",
    admin: { id: "u_palm", name: "Ruwan Jayasinghe", email: "admin@palmgarden.lk", phone: "+94 76 330 9917", password: "palmgarden2026", lastLogin: -3 },
  });
  await smallVilla(db, "v_palmgarden", today, [
    { id: "r_pg_1", name: "Palm Room", view: "Garden view", capacity: 3, price: 15000, enabled: true },
    { id: "r_pg_2", name: "Lotus Room", view: "Pond view", capacity: 2, price: 14000, enabled: true },
    { id: "r_pg_3", name: "Family Room", view: "Garden view", capacity: 5, price: 21000, enabled: true },
  ], [
    { id: "g_pg_1", name: "Tharushi Abeysekara", phone: "+94 77 612 4408", country: "Sri Lanka" },
    { id: "g_pg_2", name: "Oliver Grant", phone: "+44 7700 900861", country: "United Kingdom" },
  ], 52000);
  await payment("p_pg_1", "v_palmgarden", 5000, -65, -65, "First month");
  await payment("p_pg_2", "v_palmgarden", 5000, -33, -35, "Cash");
  await log(db, "v_palmgarden", "subscription_updated", "Subscription marked as payment due", -2);

  /* 4. Lagoon Edge Villa: overdue and switched off */
  await villa({
    id: "v_lagoon", name: "Lagoon Edge Villa", location: "Bentota, Galle", phone: "+94 34 227 5510", email: "desk@lagoonedge.lk", address: "110 River Side, Bentota",
    maxGuests: 6, price: 34000, monthly: 5000, subscription: "overdue", access: "disabled", started: -95, nextDue: -35, notes: "No reply to two reminders.",
    admin: { id: "u_lagoon", name: "Chamari Peiris", email: "admin@lagoonedge.lk", phone: "+94 70 451 2286", password: "lagoonedge2026", lastLogin: -41 },
  });
  await smallVilla(db, "v_lagoon", today, [{ id: "r_le_1", name: "River Room", view: "River view", capacity: 2, price: 12000, enabled: true }], [
    { id: "g_le_1", name: "Sanduni Karunaratne", phone: "+94 71 903 5562", country: "Sri Lanka" },
  ], 34000);
  await payment("p_le_1", "v_lagoon", 5000, -95, -95, "First month");
  await payment("p_le_2", "v_lagoon", 5000, -64, -65, "Second month");
  await log(db, "v_lagoon", "villa_disabled", "Villa access disabled", -5);
}

async function log(db: Db, villaId: string | null, action: string, detail: string, dayOffset = 0) {
  await db.run("INSERT INTO activity_log (villa_id, action, detail, created_by, created_at) VALUES (?,?,?,?,?)", [villaId, action, detail, "u_super", nowSql(dayOffset * 86_400_000)]);
}

/** A light set of rooms, guests and bookings so every sample villa has its own separate data. */
async function smallVilla(db: Db, villaId: string, today: string, rooms: Room[], guests: Guest[], villaPrice: number) {
  for (const [i, r] of rooms.entries()) await insertRoom(db, villaId, r, i);
  for (const g of guests) await insertGuest(db, villaId, g);
  for (const a of SEED_AMENITIES.slice(0, 3)) await insertAmenity(db, villaId, { ...a, id: `${a.id}_${villaId.slice(2, 6)}` });

  const day = (n: number) => addDays(today, n);
  const base = { adults: 2, children: 0, notes: "", paid: 0 } as const;
  const bookings: Booking[] = [
    { ...base, id: `b_${villaId.slice(2, 6)}_1`, type: "room", roomId: rooms[0].id, guestId: guests[0].id, checkIn: day(-1), checkOut: day(2), source: "Booking.com", total: rooms[0].price * 3, paid: rooms[0].price * 3, status: "checked_in", createdAt: day(-9) },
    { ...base, id: `b_${villaId.slice(2, 6)}_2`, type: "villa", guestId: guests[guests.length - 1].id, checkIn: day(9), checkOut: day(11), adults: 4, source: "Direct", total: villaPrice * 2, paid: villaPrice, status: "confirmed", createdAt: day(-2) },
  ];
  for (const b of bookings) await insertBooking(db, villaId, b);
  await insertExpense(db, villaId, { id: `e_${villaId.slice(2, 6)}_1`, name: "Electricity bill", category: "Electricity", amount: 14200, date: day(-2) });
  await insertExpense(db, villaId, { id: `e_${villaId.slice(2, 6)}_2`, name: "Cleaning", category: "Cleaning", amount: 5500, date: day(-1) });
}
