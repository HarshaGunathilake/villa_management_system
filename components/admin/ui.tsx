"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Ban, CheckCircle2, Clock3, CreditCard, Search } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BADGE_LABEL, SUBSCRIPTION_LABEL, type AccountStatus, type SubscriptionStatus, type VillaBadge } from "@/lib/admin-types";
import { fmtFull, nightsBetween } from "@/lib/dates";
import { cn } from "@/lib/utils";

/* Status is always shown with a label and an icon, never by colour alone. */
const BADGE: Record<VillaBadge, { tone: Tone; icon: React.ComponentType<{ className?: string }> }> = {
  active: { tone: "sage", icon: CheckCircle2 },
  payment_due: { tone: "amber", icon: Clock3 },
  overdue: { tone: "clay", icon: AlertTriangle },
  disabled: { tone: "stone", icon: Ban },
  awaiting_payment: { tone: "amber", icon: Clock3 },
};

export function VillaStatusBadge({ status }: { status: VillaBadge }) {
  return <Badge tone={BADGE[status].tone} icon={BADGE[status].icon}>{BADGE_LABEL[status]}</Badge>;
}

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge tone={BADGE[status].tone} icon={BADGE[status].icon}>{SUBSCRIPTION_LABEL[status]}</Badge>;
}

export function AccessBadge({ status, labels }: { status: AccountStatus; labels?: [string, string] }) {
  const [on, off] = labels ?? ["Active", "Disabled"];
  return status === "active" ? <Badge tone="sage" icon={CheckCircle2}>{on}</Badge> : <Badge tone="stone" icon={Ban}>{off}</Badge>;
}

/** A villa's access, saying why it is off when that is because of payment. */
export function VillaAccessBadge({ villa, labels }: { villa: { accountStatus: AccountStatus; disabledReason: "manual" | "subscription" | "unpaid" | null }; labels?: [string, string] }) {
  if (villa.accountStatus === "disabled" && villa.disabledReason === "unpaid") return <Badge tone="amber" icon={Ban}>Awaiting first payment</Badge>;
  if (villa.accountStatus === "disabled" && villa.disabledReason === "subscription") return <Badge tone="stone" icon={Ban}>Off, subscription ended</Badge>;
  return <AccessBadge status={villa.accountStatus} labels={labels} />;
}

const CARD: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Paying by card", tone: "sage" },
  pending: { label: "Checkout started", tone: "stone" },
  on_hold: { label: "Card payment failed", tone: "clay" },
  past_due: { label: "Retrying card payment", tone: "amber" },
  paused: { label: "Card payments paused", tone: "amber" },
  cancelled: { label: "Card subscription cancelled", tone: "stone" },
  expired: { label: "Card subscription expired", tone: "stone" },
  failed: { label: "Card setup failed", tone: "stone" },
};

/** The villa's card subscription with Dodo Payments. */
export function CardBadge({ status }: { status: string | null }) {
  const c = (status && CARD[status]) || { label: "Not paying by card yet", tone: "stone" as Tone };
  return <Badge tone={c.tone} icon={CreditCard}>{c.label}</Badge>;
}

/** "in 6 days", "today", "4 days ago" */
export function relativeDay(today: string, date: string) {
  const days = nightsBetween(today, date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** "4 Oct 2026, 10:32 AM" in the viewer's own time zone */
export function fmtStamp(iso: string | null) {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

export function fmtDate(iso: string) {
  return fmtFull(iso);
}

export function AdminCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-card shadow-card", className)} {...props} />;
}

export function AdminHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-[2rem]">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function StatTile({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: string; tone?: "warn" }) {
  return (
    <AdminCard className="p-5">
      <div className="text-[0.9375rem] text-muted">{label}</div>
      <div className={cn("tnum mt-2 font-display text-[1.75rem] leading-none font-bold tracking-[-0.02em] sm:text-[2rem]", tone === "warn" && "text-amber-deep")}>{value}</div>
      {note ? <div className="mt-1.5 text-sm text-muted">{note}</div> : null}
    </AdminCard>
  );
}

/** A centred confirmation or small form. */
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-[70] bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="anim-fade fixed top-1/2 left-1/2 z-[80] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-sand p-6 shadow-float outline-none"
        >
          <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
          <div className="mt-3 space-y-4">{children}</div>
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-clay/30 bg-clay-soft px-4 py-3 text-[0.9375rem] font-medium text-clay">
      {message}
    </p>
  );
}

export function TabBar<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-1 mb-5 flex gap-1 overflow-x-auto px-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "min-h-11 shrink-0 rounded-full border px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors",
            value === t.id ? "border-ink bg-ink text-white" : "border-line-strong bg-card text-ink hover:bg-well",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className={cn("tnum ml-1.5 text-sm font-normal", value === t.id ? "text-white/75" : "text-muted")}>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function ConfirmButtons({ onCancel, onConfirm, confirmLabel, danger, busy }: { onCancel: () => void; onConfirm: () => void; confirmLabel: string; danger?: boolean; busy?: boolean }) {
  return (
    <>
      <Button variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
        {confirmLabel}
      </Button>
    </>
  );
}

/** The search field used on the admin lists. */
export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative min-w-0 flex-1 basis-72">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-h-12 w-full rounded-xl border border-line-strong bg-card pr-4 pl-12 placeholder:text-muted/70 focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none"
      />
    </div>
  );
}

/** A plain dropdown for filters. */
export function FilterSelect({ value, onChange, label, options, className }: { value: string; onChange: (v: string) => void; label: string; options: { value: string; label: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn("min-h-12 max-w-full rounded-xl border border-line-strong bg-card px-4 font-medium focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export const CARD_LABEL = (status: string | null) => (status && CARD[status]?.label) || "Not paying by card yet";
