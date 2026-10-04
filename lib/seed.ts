import { addDays } from "./dates";
import { PHOTOS } from "./photos";
import type { AppData, Booking, Expense, Source } from "./types";

/**
 * Demo data for Villa Serenity. Dates are written as offsets from "today" so the
 * dashboard always has something happening. Opened on 4 Oct 2026, the three
 * headline bookings land exactly on Oct 10–13, Oct 15–18 and Oct 16–18.
 */
export function createSeed(today: string): AppData {
  const day = (offset: number) => addDays(today, offset);

  const rooms = [
    { id: "ocean", name: "Ocean View Room", view: "Ocean view", capacity: 2, price: 18000, enabled: true, photo: PHOTOS.ocean },
    { id: "garden", name: "Garden Room", view: "Garden view", capacity: 2, price: 14000, enabled: true, photo: PHOTOS.garden },
    { id: "pool", name: "Pool View Room", view: "Pool view", capacity: 3, price: 16000, enabled: true, photo: PHOTOS.pool },
  ];

  const guests = [
    { id: "g_kasun", name: "Kasun Perera", phone: "+94 77 245 8810", email: "kasun.perera@example.com", country: "Sri Lanka" },
    { id: "g_sarah", name: "Sarah Fernando", phone: "+94 71 630 4421", email: "sarah.fernando@example.com", country: "Sri Lanka" },
    { id: "g_michael", name: "Michael Wilson", phone: "+44 7700 900152", email: "m.wilson@example.com", country: "United Kingdom" },
    { id: "g_nimal", name: "Nimal Silva", phone: "+94 76 518 2093", country: "Sri Lanka" },
    { id: "g_emma", name: "Emma Thompson", phone: "+61 491 570 156", email: "emma.t@example.com", country: "Australia" },
    { id: "g_dilani", name: "Dilani Jayawardena", phone: "+94 70 384 7765", country: "Sri Lanka" },
    { id: "g_lukas", name: "Lukas Becker", phone: "+49 1512 3456789", email: "lukas.becker@example.com", country: "Germany" },
  ];

  let n = 0;
  const b = (
    guestId: string,
    where: "villa" | "ocean" | "garden" | "pool",
    from: number,
    to: number,
    people: [number, number],
    source: Source,
    paid: number | "full",
    status: Booking["status"],
    notes = "",
  ): Booking => {
    const nights = to - from;
    const rate = where === "villa" ? 45000 : rooms.find((r) => r.id === where)!.price;
    const total = rate * nights;
    n += 1;
    return {
      id: `b_${String(n).padStart(3, "0")}`,
      type: where === "villa" ? "villa" : "room",
      roomId: where === "villa" ? undefined : where,
      guestId,
      checkIn: day(from),
      checkOut: day(to),
      adults: people[0],
      children: people[1],
      source,
      total,
      paid: paid === "full" ? total : paid,
      notes,
      status,
      createdAt: day(Math.min(from - 7, -1)),
    };
  };

  const bookings: Booking[] = [
    // Earlier stays, so guest history and last month have something to show
    b("g_sarah", "garden", -265, -261, [2, 0], "Direct", "full", "checked_out"),
    b("g_sarah", "ocean", -114, -111, [2, 0], "WhatsApp", "full", "checked_out"),
    b("g_kasun", "villa", -24, -21, [5, 2], "Direct", "full", "checked_out", "Family get-together."),
    b("g_emma", "pool", -18, -14, [2, 1], "Booking.com", "full", "checked_out"),
    b("g_michael", "garden", -16, -13, [2, 0], "Airbnb", "full", "checked_out"),
    b("g_nimal", "ocean", -10, -7, [2, 0], "Phone", "full", "checked_out"),
    b("g_lukas", "pool", -6, -2, [2, 0], "Booking.com", "full", "checked_out"),
    b("g_kasun", "ocean", -4, -1, [1, 0], "WhatsApp", "full", "checked_out"),

    // Today
    b("g_nimal", "garden", -2, 0, [2, 0], "Phone", "full", "checked_in"),
    b("g_emma", "ocean", 0, 3, [2, 0], "Airbnb", 20000, "confirmed", "Vegetarian breakfast."),
    b("g_dilani", "garden", 0, 2, [2, 0], "Direct", 0, "confirmed", "Will pay cash on arrival."),

    // Coming up
    b("g_sarah", "villa", 6, 9, [4, 0], "Booking.com", 50000, "confirmed", "Late arrival around 8 PM."),
    b("g_michael", "ocean", 11, 14, [2, 0], "Direct", "full", "confirmed"),
    b("g_kasun", "garden", 12, 14, [2, 0], "WhatsApp", 10000, "confirmed"),
    b("g_lukas", "pool", 16, 20, [2, 1], "Airbnb", 32000, "confirmed"),
    b("g_nimal", "villa", 26, 28, [6, 0], "Phone", 0, "confirmed", "Birthday weekend. Asked about a BBQ."),
  ];

  let e = 0;
  const x = (name: string, category: Expense["category"], amount: number, offset: number, note?: string): Expense => {
    e += 1;
    return { id: `e_${String(e).padStart(3, "0")}`, name, category, amount, date: day(offset), note };
  };

  const expenses: Expense[] = [
    x("Electricity bill", "Electricity", 18500, 0, "Last month's electricity bill"),
    x("Water bill", "Water", 4200, -1),
    x("Breakfast supplies", "Groceries", 9800, -1, "Fruit, eggs, bread, tea"),
    x("Room cleaning", "Cleaning", 6000, -2, "After check-outs"),
    x("Staff salaries", "Staff", 65000, -3),
    x("Fibre internet", "Internet", 6500, -3),
    x("Pool pump repair", "Maintenance", 15000, -9),
    x("Garden upkeep", "Maintenance", 8000, -15),
    x("Laundry service", "Cleaning", 7200, -19),
    x("Welcome drinks and fruit", "Groceries", 5400, -23),
  ];

  return {
    villa: {
      name: "Villa Serenity",
      location: "Unawatuna, Galle",
      phone: "+94 91 224 5560",
      maxGuests: 8,
      price: 45000,
      ownerName: "Harsha",
      checkInTime: "2:00 PM",
      checkOutTime: "11:00 AM",
    },
    rooms,
    guests,
    bookings,
    expenses,
  };
}
