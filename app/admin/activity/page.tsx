"use client";

import { useState } from "react";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminHeader } from "@/components/admin/ui";
import { useAdminData } from "@/lib/admin-store";

export default function ActivityPage() {
  const { activity, villas } = useAdminData();
  const [villaId, setVillaId] = useState("all");
  const name = (id: string | null) => villas.find((v) => v.id === id)?.name;
  const list = villaId === "all" ? activity : activity.filter((a) => a.villaId === villaId);

  return (
    <div>
      <AdminHeader
        title="Activity"
        subtitle="What Super Admins have done, newest first"
        action={
          <select value={villaId} onChange={(e) => setVillaId(e.target.value)} aria-label="Show activity for" className="min-h-12 rounded-xl border border-line-strong bg-card px-4 font-medium">
            <option value="all">All villas</option>
            {villas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        }
      />
      <ActivityList entries={list} showVilla={villaId === "all" ? name : undefined} />
    </div>
  );
}
