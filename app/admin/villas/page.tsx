"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { AdminCard, AdminHeader, fmtDate, fmtStamp, relativeDay, TabBar, VillaStatusBadge } from "@/components/admin/ui";
import { AccessModal, CreateVillaSheet, EditVillaSheet } from "@/components/admin/villa-forms";
import { Button } from "@/components/ui/button";
import { useAdminData } from "@/lib/admin-store";
import { villaBadge, type AdminVilla, type VillaBadge } from "@/lib/admin-types";
import { money } from "@/lib/utils";

type Filter = "all" | VillaBadge;

export default function VillasPage() {
  const { villas, admins, today } = useAdminData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [plan, setPlan] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminVilla | null>(null);
  const [access, setAccess] = useState<AdminVilla | null>(null);

  const adminOf = (villaId: string) => admins.find((a) => a.villaId === villaId);
  const plans = [...new Set(villas.map((v) => v.plan))];

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return villas.filter((v) => {
      if (plan !== "all" && v.plan !== plan) return false;
      if (!q) return true;
      const own = admins.filter((a) => a.villaId === v.id);
      return [v.name, v.location, v.email, ...own.flatMap((a) => [a.name, a.email])].some((field) => field.toLowerCase().includes(q));
    });
  }, [villas, admins, query, plan]);

  const count = (f: Filter) => (f === "all" ? searched.length : searched.filter((v) => villaBadge(v) === f).length);
  const list = filter === "all" ? searched : searched.filter((v) => villaBadge(v) === filter);

  return (
    <div>
      <AdminHeader
        title="Villas"
        subtitle={`${villas.length} registered`}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Add villa
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-72">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search villas by name, admin, email or location"
            aria-label="Search villas"
            className="min-h-12 w-full rounded-xl border border-line-strong bg-card pr-4 pl-12 placeholder:text-muted/70 focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none"
          />
        </div>
        {plans.length > 1 ? (
          <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Filter by plan" className="min-h-12 rounded-xl border border-line-strong bg-card px-4 font-medium">
            <option value="all">All plans</option>
            {plans.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <TabBar
        label="Filter villas"
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "all", label: "All", count: count("all") },
          { id: "active", label: "Active", count: count("active") },
          { id: "payment_due", label: "Payment due", count: count("payment_due") },
          { id: "overdue", label: "Overdue", count: count("overdue") },
          { id: "awaiting_payment", label: "Awaiting first payment", count: count("awaiting_payment") },
          { id: "disabled", label: "Disabled", count: count("disabled") },
        ]}
      />

      {list.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-lg font-medium">No villas match</p>
          <p className="mt-1 text-muted">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((v) => {
            const admin = adminOf(v.id);
            return (
              <AdminCard key={v.id} className="p-5">
                <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link href={`/admin/villas/${v.id}`} className="truncate text-lg leading-tight font-semibold underline-offset-4 hover:underline">
                        {v.name}
                      </Link>
                      <VillaStatusBadge status={villaBadge(v)} />
                    </div>
                    <div className="truncate text-muted">{v.location || "No location"}</div>
                    <div className="text-sm text-muted">Created {fmtStamp(v.createdAt).split(",")[0]}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-muted">Admin</div>
                    <div className="truncate font-medium">{admin?.name ?? "No admin"}</div>
                    <div className="truncate text-[0.9375rem] text-muted">{admin?.email}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted">{v.plan} plan</div>
                    <div className="tnum font-medium">{money(v.monthlyAmount)}</div>
                    <div className="text-sm text-muted">a month</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted">Next payment</div>
                    <div className="tnum font-medium">{fmtDate(v.nextPaymentDate)}</div>
                    <div className="text-sm text-muted">{relativeDay(today, v.nextPaymentDate)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/villas/${v.id}`} className="inline-flex min-h-10 items-center rounded-[0.625rem] border border-line-strong bg-card px-3.5 text-[0.9375rem] font-medium hover:bg-well">
                      View
                    </Link>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(v)}>
                      Edit
                    </Button>
                    <Button variant={v.accountStatus === "active" ? "danger" : "secondary"} size="sm" onClick={() => setAccess(v)}>
                      {v.accountStatus === "active" ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}

      <CreateVillaSheet open={creating} onClose={() => setCreating(false)} />
      {editing ? <EditVillaSheet villa={editing} open onClose={() => setEditing(null)} /> : null}
      {access ? <AccessModal villa={access} open onClose={() => setAccess(null)} /> : null}
    </div>
  );
}
