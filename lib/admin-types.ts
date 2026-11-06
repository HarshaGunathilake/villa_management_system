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
  /** Why access is off: switched off by hand, or because the card subscription ended */
  disabledReason: "manual" | "subscription" | null;
  /** The villa's card subscription with Dodo Payments, if any */
  card: { status: string | null; subscriptionId: string | null; customerId: string | null };
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
  defaultMonthlyAmount: number;
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
export type VillaBadge = "active" | "payment_due" | "overdue" | "disabled";
export const villaBadge = (v: Pick<AdminVilla, "accountStatus" | "subscriptionStatus">): VillaBadge =>
  v.accountStatus === "disabled" ? "disabled" : v.subscriptionStatus;

export const BADGE_LABEL: Record<VillaBadge, string> = { active: "Active", payment_due: "Payment due", overdue: "Overdue", disabled: "Disabled" };
export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = { active: "Active", payment_due: "Payment due", overdue: "Overdue" };
