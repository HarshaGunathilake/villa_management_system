"use client";

import { AdminCard, fmtStamp } from "@/components/admin/ui";
import type { ActivityEntry } from "@/lib/admin-types";

export function ActivityList({ entries, showVilla }: { entries: ActivityEntry[]; showVilla?: (villaId: string | null) => string | undefined }) {
  if (entries.length === 0) return <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-muted">Nothing recorded yet.</p>;
  return (
    <AdminCard>
      <ol className="divide-y divide-line">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-5 py-3.5">
            <span className="tnum w-44 shrink-0 text-sm text-muted">{fmtStamp(e.createdAt)}</span>
            <span className="min-w-0 flex-1 basis-60">
              <span className="font-medium">{e.detail}</span>
              {showVilla?.(e.villaId) ? <span className="text-muted">, {showVilla(e.villaId)}</span> : null}
            </span>
            {e.by ? <span className="text-sm text-muted">{e.by}</span> : null}
          </li>
        ))}
      </ol>
    </AdminCard>
  );
}
