"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { AdminCard, AdminHeader, StatTile, VillaStatusBadge } from "@/components/admin/ui";
import { CreateVillaSheet } from "@/components/admin/villa-forms";
import { Button } from "@/components/ui/button";
import { paymentNeedsAttention, villaAlerts } from "@/lib/admin-logic";
import { useAdminData } from "@/lib/admin-store";
import { villaBadge } from "@/lib/admin-types";
import { fmtLong } from "@/lib/dates";
import { money } from "@/lib/utils";

export default function AdminDashboard() {
  const { villas, admins, today } = useAdminData();
  const [creating, setCreating] = useState(false);

  const active = villas.filter((v) => v.accountStatus === "active");
  const due = villas.filter((v) => paymentNeedsAttention(v, today));
  const alerts = villaAlerts(villas, admins, today);
  const recent = villas.slice(0, 5);
  const monthly = active.reduce((sum, v) => sum + v.monthlyAmount, 0);

  return (
    <div>
      <AdminHeader
        title="Dashboard"
        subtitle={fmtLong(today)}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Add villa
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile label="Total villas" value={villas.length} />
        <StatTile label="Active villas" value={active.length} />
        <StatTile label="Inactive villas" value={villas.length - active.length} />
        <StatTile label="Active admins" value={admins.filter((a) => a.status === "active").length} />
        <StatTile label="Subscriptions due" value={due.length} tone={due.length > 0 ? "warn" : undefined} note={`${money(monthly)} a month from active villas`} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent villas</h2>
            <Link href="/admin/villas" className="font-medium text-brass-deep underline-offset-4 hover:underline">
              All villas
            </Link>
          </div>
          <AdminCard className="divide-y divide-line overflow-hidden">
            {recent.map((v) => (
              <Link key={v.id} href={`/admin/villas/${v.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-sand/70">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg leading-tight font-semibold">{v.name}</span>
                  <span className="block truncate text-muted">{v.location}</span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="tnum block font-medium">{money(v.monthlyAmount)}</span>
                  <span className="block text-sm text-muted">a month</span>
                </span>
                <VillaStatusBadge status={villaBadge(v)} />
                <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />
              </Link>
            ))}
            {recent.length === 0 ? <p className="p-5 text-muted">No villas yet. Add the first one to get started.</p> : null}
          </AdminCard>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Subscription alerts</h2>
          <AdminCard className="divide-y divide-line overflow-hidden">
            {alerts.length === 0 ? (
              <p className="p-5 text-muted">Nothing needs attention. Every subscription is up to date.</p>
            ) : (
              alerts.map((a, i) => (
                <Link key={`${a.villaId}-${a.kind}-${i}`} href={`/admin/villas/${a.villaId}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-sand/70">
                  <span
                    aria-hidden
                    className={`size-2.5 shrink-0 rounded-full ${a.kind === "overdue" ? "bg-clay" : a.kind === "disabled" || a.kind === "never_signed_in" ? "bg-stone" : "bg-amber"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.villaName}</span>
                    <span className="block text-[0.9375rem] text-muted">{a.text}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />
                </Link>
              ))
            )}
          </AdminCard>
        </section>
      </div>

      <CreateVillaSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
