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
  /** Usual check-in and check-out times, 24-hour "HH:MM" */
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

export const AMENITY_UNITS = ["per booking", "per person", "per day"] as const;
export type AmenityUnit = (typeof AMENITY_UNITS)[number];

/** Something extra the villa offers for a charge: a BBQ, meals, an airport pickup. */
export interface Amenity {
  id: string;
  name: string;
  /** Price in LKR for one unit */
  price: number;
  unit: AmenityUnit;
  enabled: boolean;
}

/** An amenity added to a booking. Name and price are copied so later changes don't rewrite old bookings. */
export interface BookingExtra {
  amenityId: string;
  name: string;
  price: number;
  /** "each" is used for one-off items typed in by hand, such as a minibar bill */
  unit: AmenityUnit | "each";
  qty: number;
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
  /** Times agreed for this booking only ("HH:MM"). Left empty, the villa's usual times apply. */
  checkInTime?: string;
  checkOutTime?: string;
  adults: number;
  children: number;
  source: Source;
  /** Amenities added to this booking. Their cost is included in `total`. */
  extras?: BookingExtra[];
  total: number;
  paid: number;
  notes: string;
  status: BookingStatus;
  createdAt: string;
  /** The day the guest was checked out; used as the invoice date */
  checkedOutOn?: string;
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
  amenities: Amenity[];
}
