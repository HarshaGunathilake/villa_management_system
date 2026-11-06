"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { ActivityList } from "@/components/admin/activity-list";
import { AdminHeader, FilterSelect, fmtStamp, SearchInput } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useAdminData } from "@/lib/admin-store";
import { ACTIVITY_TYPE_LABEL, type ActivityEntry, type ActivityType } from "@/lib/admin-types";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";

/** Everything that happened on the platform, searched and filtered on the server. */
export default function ActivityPage() {
  const { villas, today } = useAdminData();
  const [query, setQuery] = useState("");
  const [villaId, setVillaId] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const name = (id: string | null) => (id ? villas.find((v) => v.id === id)?.name ?? "Removed villa" : "Platform");

  const params = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (villaId !== "all") p.set("villa", villaId);
    if (type !== "all") p.set("type", type);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  };
  const key = params();

  // Search as you type, a moment after the last key.
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void api<{ entries: ActivityEntry[]; more: boolean }>(`/api/admin/activity?${key}`).then((r) => {
        if (!live) return;
        if (!r.ok) return setError(r.error);
        setError(null);
        setEntries(r.entries);
        setMore(r.more);
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);

  const loadMore = async () => {
    if (!entries?.length) return;
    const r = await api<{ entries: ActivityEntry[]; more: boolean }>(`/api/admin/activity?${params({ before: String(entries[entries.length - 1].id) })}`);
    if (!r.ok) return setError(r.error);
    setEntries([...entries, ...r.entries]);
    setMore(r.more);
  };

  const exportCsv = async () => {
    setExporting(true);
    const r = await api<{ entries: ActivityEntry[] }>(`/api/admin/activity?${params({ limit: "5000" })}`);
    setExporting(false);
    if (!r.ok) return setError(r.error);
    downloadCsv(
      `activity-${today}.csv`,
      ["When", "Villa", "What happened", "By", "Type"],
      r.entries.map((e) => [fmtStamp(e.createdAt), name(e.villaId), e.detail, e.by, e.action]),
    );
  };

  const filtered = query.trim() !== "" || villaId !== "all" || type !== "all" || from !== "" || to !== "";
  const clear = () => {
    setQuery("");
    setVillaId("all");
    setType("all");
    setFrom("");
    setTo("");
  };

  return (
    <div>
      <AdminHeader
        title="Activity"
        subtitle="Everything that happened on the platform, newest first"
        action={
          <Button variant="secondary" onClick={exportCsv} disabled={exporting || !entries?.length}>
            <Download /> {exporting ? "Preparing" : "Export CSV"}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search what happened, a villa or a person" label="Search activity" />
        <FilterSelect
          value={villaId}
          onChange={setVillaId}
          label="Villa"
          className="max-w-64"
          options={[{ value: "all", label: "All villas" }, { value: "platform", label: "Platform only" }, ...villas.map((v) => ({ value: v.id, label: v.name }))]}
        />
        <FilterSelect
          value={type}
          onChange={setType}
          label="Type"
          options={[{ value: "all", label: "All types" }, ...(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((t) => ({ value: t, label: ACTIVITY_TYPE_LABEL[t] }))]}
        />
      </div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <Input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <Input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </label>
        {filtered ? (
          <Button variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {error ? <p className="mb-4 rounded-xl bg-clay-soft px-4 py-3 text-clay">{error}</p> : null}
      {entries === null ? (
        <div className="h-64 animate-pulse rounded-card bg-well" aria-label="Loading activity" />
      ) : entries.length === 0 && filtered ? (
        <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-muted">Nothing matches these filters.</p>
      ) : (
        <ActivityList entries={entries} showVilla={villaId === "all" ? (id) => (id ? name(id) : undefined) : undefined} />
      )}
      {more ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore}>
            Show older
          </Button>
        </div>
      ) : null}
    </div>
  );
}
