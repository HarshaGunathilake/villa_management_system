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
  /** Email last month's report to the owner on the 1st of every month */
  monthlyReport: boolean;
  /** Another address that gets the monthly report too, e.g. an accountant. Empty for none. */
  reportCc: string;
  /** The signed-in owner's email, where reports go. Read-only. */
  ownerEmail: string;
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

export const PAY_TYPES = ["monthly", "daily"] as const;
export type PayType = (typeof PAY_TYPES)[number];

/** Someone who works at the villa: a caretaker, cook, cleaner or gardener. */
export interface Staff {
  id: string;
  name: string;
  /** What they do, e.g. "Caretaker" */
  role: string;
  phone: string;
  /** Paid a monthly salary, or a daily wage for the days they worked */
  payType: PayType;
  /** The monthly salary, or the wage for one day, in LKR */
  rate: number;
  /** Registered for EPF and ETF */
  epf: boolean;
  epfNumber?: string;
  /** Still working at the villa. Past staff keep their payslips. */
  active: boolean;
}

/** One line on a payslip, such as overtime or a salary advance. */
export interface PayLine {
  name: string;
  amount: number;
}

/**
 * A month's pay for one person. Their name, role and rate are copied so a later
 * change to the staff member doesn't rewrite payslips already given.
 */
export interface Payslip {
  id: string;
  /** Shown as PS-0001 */
  number: number;
  staffId: string;
  staffName: string;
  staffRole: string;
  payType: PayType;
  rate: number;
  /** YYYY-MM */
  month: string;
  /** Days worked, for daily pay */
  days?: number;
  additions: PayLine[];
  deductions: PayLine[];
  epf: boolean;
  epfNumber?: string;
  note?: string;
  createdOn: string;
  /** Set once the pay was handed over; the payslip is then also an expense */
  paidOn?: string;
  expenseId?: string;
}

export interface AppData {
  villa: Villa;
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  expenses: Expense[];
  amenities: Amenity[];
  staff: Staff[];
  payslips: Payslip[];
  bills: Bill[];
  billPayments: BillPayment[];
}

export const BILL_REPEATS = ["monthly", "quarterly", "yearly"] as const;
export type BillRepeat = (typeof BILL_REPEATS)[number];

/** A bill that comes round again: electricity, water, internet, insurance and so on. */
export interface Bill {
  id: string;
  name: string;
  /** The expense category it is filed under when paid */
  category: ExpenseCategory;
  /** The usual amount, used when it is marked paid (can be changed then) */
  amount: number;
  repeat: BillRepeat;
  /** Day of the month it is due, 1 to 31. Shorter months use their last day. */
  dueDay: number;
  /** YYYY-MM of the first time it is due; later ones follow every 1, 3 or 12 months */
  startMonth: string;
  /** Off once the villa no longer pays it. Its past payments are kept. */
  active: boolean;
  note?: string;
}

/** One time a bill was dealt with: paid (and added to Expenses) or skipped. */
export interface BillPayment {
  billId: string;
  /** YYYY-MM of the due date this payment is for */
  period: string;
  paidOn: string;
  amount: number;
  /** The expense it became; none when skipped */
  expenseId?: string;
  skipped: boolean;
}

/** How the villa pays for its subscription: card payments through Dodo Payments. */
export interface VillaBilling {
  /** Card payments are set up on this server (Dodo keys present) */
  enabled: boolean;
  /**
   * none       no card subscription yet, or it ended: show "Pay by card"
   * active     paying automatically every month
   * attention  the last charge failed: the card needs updating
   * pending    a checkout was started but not finished
   */
  state: "none" | "active" | "attention" | "pending";
  /** Dodo's own word for the subscription, e.g. "active", "on_hold" */
  dodoStatus: string | null;
  /** There is a Dodo customer, so the billing portal (card, invoices, cancel) can be opened */
  canManage: boolean;
}

/** A villa's own subscription, as shown to its admin. Amounts and status are set by the platform and by Dodo. */
export interface VillaSubscription {
  plan: string;
  monthlyAmount: number;
  status: "active" | "payment_due" | "overdue";
  startDate: string;
  nextPaymentDate: string;
  payments: { id: string; amount: number; paymentDate: string; periodStart: string; periodEnd: string; note: string }[];
  billing: VillaBilling;
  /** Who to contact about payments */
  support: { email: string; phone: string };
}
