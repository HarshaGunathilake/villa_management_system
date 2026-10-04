export type BookingType = "villa" | "room";
export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled";

export const SOURCES = ["Direct", "Booking.com", "Airbnb", "WhatsApp", "Phone", "Other"] as const;
export type Source = (typeof SOURCES)[number];

export const EXPENSE_CATEGORIES = [
  "Electricity",
  "Water",
  "Cleaning",
  "Maintenance",
  "Groceries",
  "Staff",
  "Internet",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Villa {
  name: string;
  location: string;
  phone: string;
  maxGuests: number;
  /** Price per night for the entire villa, in LKR */
  price: number;
  ownerName: string;
  checkInTime: string;
  checkOutTime: string;
}

export interface Room {
  id: string;
  name: string;
  /** Short description shown on cards, e.g. "Ocean view" */
  view: string;
  capacity: number;
  /** Price per night in LKR */
  price: number;
  enabled: boolean;
  photo?: string;
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  country?: string;
}

export interface Booking {
  id: string;
  type: BookingType;
  /** Only set when type is "room" */
  roomId?: string;
  guestId: string;
  /** ISO dates (YYYY-MM-DD). The guest sleeps every night from checkIn up to, not including, checkOut. */
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  source: Source;
  total: number;
  paid: number;
  notes: string;
  status: BookingStatus;
  createdAt: string;
}

export interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  note?: string;
  receiptName?: string;
}

export interface AppData {
  villa: Villa;
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  expenses: Expense[];
}
