"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, KeyRound, Mail, MailCheck, MailWarning, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { ActivityList } from "@/components/admin/activity-list";
import { AccessBadge, AdminCard, CardBadge, fmtDate, fmtStamp, FormError, relativeDay, StatTile, SubscriptionBadge, TabBar, VillaAccessBadge, VillaStatusBadge } from "@/components/admin/ui";
import { AccessModal, AdminStatusModal, AdminUserModal, EditVillaSheet, ResetPasswordModal } from "@/components/admin/villa-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import { villaBadge, type AdminUser, type AdminVilla, type SubscriptionStatus } from "@/lib/admin-types";
import { currentPeriod } from "@/lib/admin-logic";
import { addDays } from "@/lib/dates";
import { money } from "@/lib/utils";

type Tab = "overview" | "admin" | "subscription" | "activity";

export default function VillaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useAdminData();
  const villa = data.villas.find((v) => v.id === id);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [access, setAccess] = useState(false);

  if (!villa) {
    return (
      <div className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
        <p className="text-lg font-medium">Villa not found</p>
        <Link href="/admin/villas" className="mt-2 inline-block font-medium text-brass-deep underline underline-offset-4">
          Back to villas
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/villas" className="mb-4 inline-flex min-h-10 items-center gap-2 font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-5" /> Villas
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-[2rem]">{villa.name}</h1>
            <VillaStatusBadge status={villaBadge(villa)} />
          </div>
          <p className="mt-1 text-lg text-muted">{villa.location || "No location set"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil /> Edit villa
          </Button>
          <Button variant={villa.accountStatus === "active" ? "danger" : "primary"} onClick={() => setAccess(true)}>
            {villa.accountStatus === "active" ? "Disable access" : "Enable access"}
          </Button>
        </div>
      </header>

      <TabBar
        label="Villa sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "admin", label: "Owner login" },
          { id: "subscription", label: "Subscription" },
          { id: "activity", label: "Activity" },
        ]}
      />

      {tab === "overview" ? <Overview villa={villa} /> : null}
      {tab === "admin" ? <Admins villa={villa} admins={data.admins.filter((a) => a.villaId === villa.id)} /> : null}
      {tab === "subscription" ? <Subscription villa={villa} onAccess={() => setAccess(true)} /> : null}
      {tab === "activity" ? <ActivityList entries={data.activity.filter((a) => a.villaId === villa.id)} /> : null}

      <EditVillaSheet villa={villa} open={editing} onClose={() => setEditing(false)} />
      <AccessModal villa={villa} open={access} onClose={() => setAccess(false)} />
    </div>
  );
}

/* ---------------------------------------------------------------- overview */

function Overview({ villa }: { villa: AdminVilla }) {
  const { act, notify } = useAdmin();
  const [notes, setNotes] = useState(villa.notes);
  const [error, setError] = useState<string | null>(null);

  const saveNotes = async () => {
    const result = await act({ type: "updateVilla", id: villa.id, patch: { notes } });
    if (!result.ok) return setError(result.error);
    setError(null);
    notify("Notes saved");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile label="Rooms" value={villa.stats.rooms} />
        <StatTile label="Upcoming bookings" value={villa.stats.upcomingBookings} />
        <StatTile label="Current guests" value={villa.stats.currentGuests} />
        <StatTile label="This month revenue" value={<span className="text-2xl">{money(villa.stats.monthRevenue)}</span>} />
        <StatTile label="This month expenses" value={<span className="text-2xl">{money(villa.stats.monthExpenses)}</span>} />
      </div>
      <p className="-mt-3 text-sm text-muted">Read-only figures from the villa&apos;s own records.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Villa details</h2>
          <dl className="space-y-2.5">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted" />
              <dd>{[villa.address, villa.location].filter(Boolean).join(", ") || "No address"}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="size-5 shrink-0 text-muted" />
              <dd>{villa.phone || "No phone"}</dd>
            </div>
            <div className="flex items-center gap-3 break-all">
              <Mail className="size-5 shrink-0 text-muted" />
              <dd>{villa.email || "No email"}</dd>
            </div>
          </dl>
          {villa.description ? <p className="mt-4 border-t border-line pt-4 text-muted">{villa.description}</p> : null}
          <p className="mt-4 border-t border-line pt-4 text-sm text-muted">Created {fmtStamp(villa.createdAt)}</p>
        </AdminCard>

        <AdminCard className="p-5">
          <h2 className="text-lg font-semibold">Internal notes</h2>
          <p className="mb-3 text-sm text-muted">Only Super Admins see these.</p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Internal notes" placeholder="e.g. Pays by bank transfer around the 5th" />
          <FormError message={error} />
          <Button variant="secondary" className="mt-3" disabled={notes === villa.notes} onClick={saveNotes}>
            Save notes
          </Button>
        </AdminCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ admins */

function Admins({ villa, admins }: { villa: AdminVilla; admins: AdminUser[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState<AdminUser | null>(null);
  const { act, notify } = useAdmin();
  // For an owner who can't receive the confirmation email: you vouch for the address instead.
  const markVerified = async (u: AdminUser) => {
    const result = await act({ type: "markEmailVerified", id: u.id });
    notify(result.ok ? `${u.email} marked as confirmed` : result.error);
  };

  return (
    <div className="space-y-4">
      {villa.accountStatus === "disabled" ? (
        <p className="rounded-xl border border-line bg-well px-4 py-3 text-[0.9375rem]">
          {villa.disabledReason === "unpaid"
            ? "This villa signed up itself and has not made its first payment yet. Its admin can only sign in to pay; it opens by itself once the payment goes through."
            : villa.disabledReason === "subscription"
              ? "The villa's card subscription ended, so its admins can only sign in to pay again."
              : "The villa itself is disabled, so no admin can log in even if their own account is active."}
        </p>
      ) : null}

      {admins.map((u) => (
        <AdminCard key={u.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-muted">Villa admin</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xl leading-tight font-semibold">{u.name}</span>
                <AccessBadge status={u.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="break-all">{u.email}</span>
                {u.emailVerified ? null : <Badge tone="amber" icon={MailWarning}>Email not confirmed</Badge>}
              </div>
              <div className="text-muted">{u.phone || "No phone"}</div>
              <div className="mt-2 text-sm text-muted">Last login: {fmtStamp(u.lastLoginAt)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(u)}>
                <Pencil /> Edit admin
              </Button>
              {u.emailVerified ? null : (
                <Button variant="secondary" size="sm" onClick={() => markVerified(u)}>
                  <MailCheck /> Mark email confirmed
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setResetting(u)}>
                <KeyRound /> Reset password
              </Button>
              <Button variant={u.status === "active" ? "danger" : "secondary"} size="sm" onClick={() => setToggling(u)}>
                {u.status === "active" ? "Disable admin" : "Enable admin"}
              </Button>
            </div>
          </div>
        </AdminCard>
      ))}
      {admins.length === 0 ? <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-muted">This villa has no admin yet.</p> : null}

      <Button variant="secondary" onClick={() => setAdding(true)}>
        <Plus /> Add another admin
      </Button>

      <AdminUserModal villaId={villa.id} open={adding} onClose={() => setAdding(false)} />
      {editing ? <AdminUserModal villaId={villa.id} user={editing} open onClose={() => setEditing(null)} /> : null}
      {resetting ? <ResetPasswordModal user={resetting} open onClose={() => setResetting(null)} /> : null}
      {toggling ? <AdminStatusModal user={toggling} open onClose={() => setToggling(null)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------ subscription */

function Subscription({ villa, onAccess }: { villa: AdminVilla; onAccess: () => void }) {
  const { act, notify } = useAdmin();
  const { today, payments } = useAdminData();
  const [error, setError] = useState<string | null>(null);
  const history = payments.filter((p) => p.villaId === villa.id);
  const period = currentPeriod(villa.nextPaymentDate, today);
  const late = villa.nextPaymentDate <= today;

  const setStatus = async (status: SubscriptionStatus, message: string) => {
    const result = await act({ type: "setSubscriptionStatus", id: villa.id, status });
    if (!result.ok) return setError(result.error);
    setError(null);
    notify(message);
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="tnum text-right font-medium">{value}</dd>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <AdminCard className="p-5">
        <h2 className="mb-1 text-lg font-semibold">Subscription</h2>
        <dl className="divide-y divide-line">
          {row("Plan", villa.plan)}
          {row("Monthly amount", money(villa.monthlyAmount))}
          {row("Started", fmtDate(villa.subscriptionStartDate))}
          {row("Current period", `${fmtDate(period.start)} to ${fmtDate(period.end)}`)}
          {row("Paid until", late ? <span className="text-amber-deep">{fmtDate(addDays(villa.nextPaymentDate, -1))}, this period is not paid yet</span> : fmtDate(addDays(villa.nextPaymentDate, -1)))}
          {row("Next payment due", <>{fmtDate(villa.nextPaymentDate)} <span className="font-normal text-muted">({relativeDay(today, villa.nextPaymentDate)})</span></>)}
          {row("Subscription status", <SubscriptionBadge status={villa.subscriptionStatus} />)}
          {row("Card payments", <CardBadge status={villa.card.status} />)}
          {row("Account access", <VillaAccessBadge villa={villa} />)}
          {villa.card.subscriptionId ? row("Dodo subscription", <span className="font-mono text-sm break-all">{villa.card.subscriptionId}</span>) : null}
        </dl>
        <p className="mt-3 text-sm text-muted">
          The villa pays by card through Dodo Payments and payments are recorded here by themselves. While the status is Payment due or Overdue (a failed renewal, or set by
          you), the villa admin can still see everything but cannot add or change anything until it is paid. When a card subscription is cancelled or expires, access
          switches off by itself and comes back when the villa pays again. A villa you disable stays off until you enable it.
        </p>

        <FormError message={error} />
        <div className="mt-4 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" disabled={villa.subscriptionStatus === "payment_due"} onClick={() => setStatus("payment_due", "Marked as payment due")}>
              Mark payment due
            </Button>
            <Button variant="secondary" disabled={villa.subscriptionStatus === "overdue"} onClick={() => setStatus("overdue", "Marked as overdue")}>
              Mark overdue
            </Button>
          </div>
          <Button variant={villa.accountStatus === "active" ? "danger" : "secondary"} onClick={onAccess}>
            {villa.accountStatus === "active" ? "Disable access" : "Enable access"}
          </Button>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="px-5 pt-5 pb-2 text-lg font-semibold">Payment history</h2>
        {history.length === 0 ? (
          <p className="px-5 pb-5 text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="font-medium">Paid {fmtDate(p.paymentDate)}</div>
                  <div className="text-sm text-muted">
                    For {fmtDate(p.periodStart)} to {fmtDate(p.periodEnd)}
                    {p.note ? `. ${p.note}` : ""}
                  </div>
                </div>
                <div className="tnum font-semibold">{money(p.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

          </div>
  );
}
