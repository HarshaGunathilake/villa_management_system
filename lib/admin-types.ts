// Shapes shared by the Super Admin screens and the /api/admin routes.

export type SubscriptionStatus = "active" | "payment_due" | "overdue";
export type AccountStatus = "active" | "disabled";

export interface AdminVilla {
  id: string;
  name: string;
  location: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  plan: string;
  monthlyAmount: number;
  subscriptionStatus: SubscriptionStatus;
  accountStatus: AccountStatus;
  subscriptionStartDate: string;
  nextPaymentDate: string;
  notes: string;
  createdAt: string;
  /** Why access is off: switched off by you, the card subscription ended, or a sign-up that has not paid yet */
  disabledReason: "manual" | "subscription" | "unpaid" | null;
  /** The villa's card subscription with Dodo Payments, if any */
  card: { status: string | null; subscriptionId: string | null; customerId: string | null };
  /** Created its own account on the Register page, rather than being added by the Super Admin */
  signedUp: boolean;
  /** Read-only figures from the villa's own data */
  stats: { rooms: number; upcomingBookings: number; currentGuests: number; monthRevenue: number; monthExpenses: number };
}

export interface AdminUser {
  id: string;
  villaId: string;
  name: string;
  email: string;
  phone: string;
  status: AccountStatus;
  lastLoginAt: string | null;
  createdAt: string;
  /** False while a self sign-up has not confirmed its email */
  emailVerified: boolean;
}

export interface SubscriptionPayment {
  id: string;
  villaId: string;
  amount: number;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: number;
  villaId: string | null;
  action: string;
  detail: string;
  by: string;
  createdAt: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  /** The one subscription price every villa pays */
  defaultMonthlyAmount: number;
  /** Anyone can create a villa account from the Register page */
  signupsOpen: boolean;
  /** Search engines may index the public website */
  searchIndexing: boolean;
  /** The public website shows a Coming soon page (the app and sign-in still work) */
  comingSoon: boolean;
  /** The Coming soon page shows the "Tell me when it opens" email form */
  waitlistForm: boolean;
  /** New sign-ups confirm their email before they can do anything */
  requireEmailVerification: boolean;
}

export interface AdminData {
  me: { id: string; name: string; email: string };
  today: string;
  settings: PlatformSettings;
  villas: AdminVilla[];
  admins: AdminUser[];
  payments: SubscriptionPayment[];
  activity: ActivityEntry[];
}

/** What to show as a villa's single status badge. Access being off wins over payment status. */
export type VillaBadge = "active" | "payment_due" | "overdue" | "disabled" | "awaiting_payment";
export const villaBadge = (v: Pick<AdminVilla, "accountStatus" | "subscriptionStatus" | "disabledReason">): VillaBadge =>
  v.accountStatus === "disabled" ? (v.disabledReason === "unpaid" ? "awaiting_payment" : "disabled") : v.subscriptionStatus;

export const BADGE_LABEL: Record<VillaBadge, string> = { active: "Active", payment_due: "Payment due", overdue: "Overdue", disabled: "Disabled", awaiting_payment: "Awaiting first payment" };
export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = { active: "Active", payment_due: "Payment due", overdue: "Overdue" };

/* ------------------------------------------------------------------ email */

export type SmtpSecurity = "tls" | "starttls" | "none";

export interface MailSettings {
  host: string;
  port: number;
  security: SmtpSecurity;
  user: string;
  /** True when a password is saved (it is never sent back to the screen) */
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  /** Which automatic emails go out */
  emails: { welcome: boolean; paymentReceived: boolean; paymentFailed: boolean; subscriptionEnded: boolean };
}

export type EmailKind = "test" | "contact" | "password_reset" | "verify_email" | "welcome" | "payment_received" | "payment_failed" | "subscription_ended";

export interface EmailLogEntry {
  id: number;
  kind: EmailKind;
  to: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  villaId: string | null;
  createdAt: string;
}


/* ---------------------------------------------------------------- reports */

export interface ReportMonth {
  /** YYYY-MM */
  month: string;
  /** Card payments received in the month */
  income: number;
  payments: number;
  /** Villas that registered themselves, and how many of those have paid since */
  signups: number;
  signupsPaid: number;
  /** Villas added by the Super Admin */
  added: number;
  /** Villas whose first ever payment was in this month */
  firstPayments: number;
  /** Card subscriptions that were cancelled or expired, switching the villa off */
  cancellations: number;
}

export interface Reports {
  today: string;
  months: ReportMonth[];
  now: { payingVillas: number; monthlyIncome: number; totalVillas: number; awaiting: number; ended: number; lifetimeIncome: number; signups: number; signupsPaid: number };
}

/** The groups the Activity page filters by. */
export type ActivityType = "villas" | "payments" | "subscriptions" | "logins" | "settings";
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  villas: "Villas and sign-ups",
  payments: "Card payments (Dodo)",
  subscriptions: "Subscription changes",
  logins: "Owner logins and passwords",
  settings: "Platform settings",
};
