// Run with: npm run check:rules
// Proves the booking rules and the five prototype scenarios against the demo data.
import assert from "node:assert/strict";
import { checkAvailability, roomNight } from "../lib/availability";
import { monthSummary } from "../lib/finance";
import { createSeed } from "../lib/seed";
import type { Booking } from "../lib/types";

const data = createSeed("2026-10-04");
const { rooms } = data;
let bookings = data.bookings;
let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const add = (b: Partial<Booking>) => {
  bookings = [...bookings, { id: `t_${bookings.length}`, guestId: "g", adults: 2, children: 0, source: "Direct", total: 0, paid: 0, notes: "", status: "confirmed", createdAt: "", type: "room", checkIn: "", checkOut: "", ...b }];
};

test("demo data has no conflicting bookings", () => {
  for (const b of data.bookings) {
    const r = checkAvailability(b, data.bookings, rooms, b.id);
    assert.equal(r.ok, true, `${b.id} conflicts`);
  }
});

test("demo bookings land on the brief's dates", () => {
  const sarah = data.bookings.find((b) => b.guestId === "g_sarah" && b.type === "villa")!;
  assert.deepEqual([sarah.checkIn, sarah.checkOut, sarah.total], ["2026-10-10", "2026-10-13", 135000]);
  const michael = data.bookings.find((b) => b.guestId === "g_michael" && b.checkIn === "2026-10-15")!;
  assert.deepEqual([michael.roomId, michael.checkOut, michael.total], ["ocean", "2026-10-18", 54000]);
  const kasun = data.bookings.find((b) => b.guestId === "g_kasun" && b.checkIn === "2026-10-16")!;
  assert.deepEqual([kasun.roomId, kasun.checkOut, kasun.total], ["garden", "2026-10-18", 28000]);
});

test("Rule 1 / Scenario A: an entire-villa booking blocks every room", () => {
  for (const room of rooms) {
    const r = checkAvailability({ type: "room", roomId: room.id, checkIn: "2026-10-11", checkOut: "2026-10-12" }, bookings, rooms);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, "villa_booked");
    assert.equal(roomNight(room.id, "2026-10-11", bookings).state, "villa");
  }
});

test("Rule 2 / Scenario C: a room booking blocks the entire villa", () => {
  const r = checkAvailability({ type: "villa", checkIn: "2026-10-14", checkOut: "2026-10-16" }, bookings, rooms);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.title, "Villa unavailable");
  assert.equal(!r.ok && r.message, "One or more rooms already have bookings during these dates.");
});

test("Rule 3 / Scenario B: other rooms stay available", () => {
  // Ocean View is booked Oct 15–18; Pool View is free for the same nights
  assert.equal(checkAvailability({ type: "room", roomId: "pool", checkIn: "2026-10-15", checkOut: "2026-10-18" }, bookings, rooms).ok, true);
  assert.equal(checkAvailability({ type: "room", roomId: "garden", checkIn: "2026-10-15", checkOut: "2026-10-16" }, bookings, rooms).ok, true);
});

test("Rule 4 / Scenario D: the same room cannot be double booked", () => {
  const r = checkAvailability({ type: "room", roomId: "ocean", checkIn: "2026-10-16", checkOut: "2026-10-19" }, bookings, rooms);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.title, "Room unavailable");
  assert.equal(!r.ok && r.message, "This room is already booked for the selected dates.");
});

test("Scenario E: free dates offer the villa and every room", () => {
  const dates = { checkIn: "2026-10-25", checkOut: "2026-10-28" };
  assert.equal(checkAvailability({ type: "villa", ...dates }, bookings, rooms).ok, true);
  for (const room of rooms) assert.equal(checkAvailability({ type: "room", roomId: room.id, ...dates }, bookings, rooms).ok, true);
});

test("a villa booking cannot overlap another villa booking", () => {
  const r = checkAvailability({ type: "villa", checkIn: "2026-10-12", checkOut: "2026-10-14" }, bookings, rooms);
  assert.equal(!r.ok && r.reason, "villa_booked");
});

test("same-day turnover is allowed (check-out morning, check-in afternoon)", () => {
  assert.equal(checkAvailability({ type: "villa", checkIn: "2026-10-13", checkOut: "2026-10-15" }, bookings, rooms).ok, true);
  assert.equal(checkAvailability({ type: "room", roomId: "ocean", checkIn: "2026-10-18", checkOut: "2026-10-20" }, bookings, rooms).ok, true);
});

test("new bookings immediately change availability", () => {
  add({ type: "room", roomId: "pool", checkIn: "2026-10-25", checkOut: "2026-10-27" });
  assert.equal(checkAvailability({ type: "villa", checkIn: "2026-10-26", checkOut: "2026-10-28" }, bookings, rooms).ok, false);
  assert.equal(checkAvailability({ type: "room", roomId: "ocean", checkIn: "2026-10-25", checkOut: "2026-10-27" }, bookings, rooms).ok, true);
});

test("cancelled bookings free their dates; edits ignore the booking itself", () => {
  const sarah = bookings.find((b) => b.guestId === "g_sarah" && b.type === "villa")!;
  assert.equal(checkAvailability({ type: "villa", checkIn: "2026-10-10", checkOut: "2026-10-14" }, bookings, rooms, sarah.id).ok, true);
  const without = bookings.map((b) => (b.id === sarah.id ? { ...b, status: "cancelled" as const } : b));
  assert.equal(checkAvailability({ type: "room", roomId: "ocean", checkIn: "2026-10-10", checkOut: "2026-10-12" }, without, rooms).ok, true);
});

test("check-out must be after check-in", () => {
  const r = checkAvailability({ type: "villa", checkIn: "2026-11-10", checkOut: "2026-11-10" }, bookings, rooms);
  assert.equal(!r.ok && r.reason, "invalid_dates");
});

const usual = { checkInTime: "14:00", checkOutTime: "11:00" };

test("Rule 5: a late check-out cannot run into the next guest's check-in", () => {
  // Villa Oct 13–15: Sarah leaves on the 13th (11:00), Michael arrives on the 15th (14:00)
  const stay = { type: "villa" as const, checkIn: "2026-10-13", checkOut: "2026-10-15" };
  assert.equal(checkAvailability(stay, data.bookings, rooms, undefined, usual).ok, true);
  assert.equal(checkAvailability({ ...stay, checkOutTime: "13:30" }, data.bookings, rooms, undefined, usual).ok, true);
  const late = checkAvailability({ ...stay, checkOutTime: "15:00" }, data.bookings, rooms, undefined, usual);
  assert.equal(!late.ok && late.reason, "late_check_out");
  assert.equal(!late.ok && late.conflicts[0].guestId, "g_michael");
});

test("Rule 5: an early check-in cannot start before the last guest has left", () => {
  const stay = { type: "villa" as const, checkIn: "2026-10-13", checkOut: "2026-10-15" };
  const early = checkAvailability({ ...stay, checkInTime: "09:00" }, data.bookings, rooms, undefined, usual);
  assert.equal(!early.ok && early.reason, "early_check_in");
  assert.equal(!early.ok && early.conflicts[0].guestId, "g_sarah");
  assert.equal(checkAvailability({ ...stay, checkInTime: "11:00" }, data.bookings, rooms, undefined, usual).ok, true);
});

test("Rule 5: only bookings sharing the same space count as neighbours", () => {
  // Pool View Oct 13–15: Michael arrives in Ocean View on the 15th, which does not matter here,
  // but Sarah's whole-villa stay ending on the 13th does.
  const stay = { type: "room" as const, roomId: "pool", checkIn: "2026-10-13", checkOut: "2026-10-15" };
  assert.equal(checkAvailability({ ...stay, checkOutTime: "18:00" }, data.bookings, rooms, undefined, usual).ok, true);
  const early = checkAvailability({ ...stay, checkInTime: "08:00" }, data.bookings, rooms, undefined, usual);
  assert.equal(!early.ok && early.reason, "early_check_in");
});

test("Rule 5: the other booking's own times are respected", () => {
  const withLateSarah = data.bookings.map((b) => (b.guestId === "g_sarah" && b.type === "villa" ? { ...b, checkOutTime: "16:00" } : b));
  const r = checkAvailability({ type: "villa", checkIn: "2026-10-13", checkOut: "2026-10-15" }, withLateSarah, rooms, undefined, usual);
  assert.equal(!r.ok && r.reason, "early_check_in");
});

test("monthly summary adds up", () => {
  const m = monthSummary(data, "2026-10");
  assert.equal(m.totalRoomNights, 93);
  assert.equal(m.occupiedNights + m.availableNights, m.totalRoomNights);
  assert.equal(m.profit, m.revenue - m.expenses);
  console.log(`      October: revenue ${m.revenue}, expenses ${m.expenses}, bookings ${m.bookings}, occupied ${m.occupiedNights}/${m.totalRoomNights}`);
});

console.log(`\n${passed} checks passed`);
