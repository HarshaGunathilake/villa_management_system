"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound, Pencil, Search } from "lucide-react";
import { AccessBadge, AdminCard, AdminHeader, fmtStamp } from "@/components/admin/ui";
import { AdminStatusModal, AdminUserModal, ResetPasswordModal } from "@/components/admin/villa-forms";
import { Button } from "@/components/ui/button";
import { useAdminData } from "@/lib/admin-store";
import type { AdminUser } from "@/lib/admin-types";

export default function AdminsPage() {
  const { admins, villas } = useAdminData();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState<AdminUser | null>(null);

  const villaOf = (id: string) => villas.find((v) => v.id === id);
  const q = query.trim().toLowerCase();
  const list = admins.filter((a) => !q || [a.name, a.email, villaOf(a.villaId)?.name ?? ""].some((f) => f.toLowerCase().includes(q)));

  return (
    <div>
      <AdminHeader title="Admins" subtitle={`${admins.filter((a) => a.status === "active").length} active of ${admins.length} villa admin accounts`} />

      <div className="relative mb-5 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or villa"
          aria-label="Search admins"
          className="min-h-12 w-full rounded-xl border border-line-strong bg-card pr-4 pl-12 placeholder:text-muted/70 focus:border-brass-deep focus:ring-2 focus:ring-brass/25 focus:outline-none"
        />
      </div>

      <div className="space-y-3">
        {list.map((u) => {
          const villa = villaOf(u.villaId);
          return (
            <AdminCard key={u.id} className="p-5">
              <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="truncate text-lg leading-tight font-semibold">{u.name}</span>
                    <AccessBadge status={u.status} />
                  </div>
                  <div className="truncate text-muted">{u.email}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-muted">Villa</div>
                  {villa ? (
                    <Link href={`/admin/villas/${villa.id}`} className="block truncate font-medium underline-offset-4 hover:underline">
                      {villa.name}
                    </Link>
                  ) : null}
                  {villa?.accountStatus === "disabled" ? <div className="text-sm text-muted">Villa access is off</div> : null}
                </div>
                <div>
                  <div className="text-sm text-muted">Last login</div>
                  <div className="text-[0.9375rem] font-medium">{fmtStamp(u.lastLoginAt)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setResetting(u)} aria-label={`Reset password for ${u.name}`}>
                    <KeyRound /> Reset
                  </Button>
                  <Button variant={u.status === "active" ? "danger" : "secondary"} size="sm" onClick={() => setToggling(u)}>
                    {u.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </AdminCard>
          );
        })}
        {list.length === 0 ? <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-muted">No admin matches that search.</p> : null}
      </div>

      {editing ? <AdminUserModal villaId={editing.villaId} user={editing} open onClose={() => setEditing(null)} /> : null}
      {resetting ? <ResetPasswordModal user={resetting} open onClose={() => setResetting(null)} /> : null}
      {toggling ? <AdminStatusModal user={toggling} open onClose={() => setToggling(null)} /> : null}
    </div>
  );
}
