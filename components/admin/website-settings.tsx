"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { AdminCard, fmtStamp } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/field";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { SITE_URL } from "@/lib/site-url";

/*
 * Super Admin → Settings → Website: keep the public site out of search engines,
 * and show a Coming soon page until launch. Each switch saves straight away.
 */
export function WebsiteSettings() {
  const { act, notify } = useAdmin();
  const { settings, today } = useAdminData();
  const [waitlist, setWaitlist] = useState<{ email: string; createdAt: string }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void api<{ waitlist: { email: string; createdAt: string }[] }>("/api/admin/waitlist").then((r) => {
      if (r.ok) setWaitlist(r.waitlist);
    });
  }, []);

  const save = async (key: "searchIndexing" | "comingSoon" | "waitlistForm", on: boolean, message: string) => {
    setBusy(key);
    const result = await act({ type: "updateSettings", patch: { [key]: on } });
    setBusy(null);
    notify(result.ok ? message : result.error);
  };

  const indexingEffective = settings.searchIndexing && !settings.comingSoon;

  return (
    <AdminCard className="divide-y divide-line">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Coming soon page</span>
          <span className="block text-sm text-muted">
            Visitors to the website see a Coming soon page with a &ldquo;Tell me when it opens&rdquo; form, and new sign-ups wait. Villa owners can still sign in. To check
            the real pages, open the website&apos;s preview link (/preview?key=…, set by PREVIEW_KEY). Changes show on the website within a minute.
          </span>
        </span>
        <Toggle
          checked={settings.comingSoon}
          label="Coming soon page"
          onChange={(on) => void save("comingSoon", on, on ? "Coming soon page is on" : "The website is open")}
        />
      </div>

      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Email form on the Coming soon page</span>
          <span className="block text-sm text-muted">Visitors can leave their email to hear when you open. Off, the page shows only your message and contact links.</span>
        </span>
        <Toggle
          checked={settings.waitlistForm}
          label="Email form on the Coming soon page"
          onChange={(on) => void save("waitlistForm", on, on ? "Email form is shown" : "Email form is hidden")}
        />
      </div>

      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Let search engines index the website</span>
          <span className="block text-sm text-muted">
            Google, Bing and AI assistants can list the public pages. Switched off, every page asks not to be indexed and robots.txt blocks crawlers.
          </span>
          {settings.searchIndexing && settings.comingSoon ? (
            <span className="mt-1.5 block text-sm font-medium text-amber-deep">Paused while the Coming soon page is on.</span>
          ) : null}
        </span>
        <Toggle
          checked={settings.searchIndexing}
          label="Let search engines index the website"
          onChange={(on) => void save("searchIndexing", on, on ? "Search engines may index the website" : "Search engines are kept out")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5 text-sm sm:px-6">
        <span className={`inline-flex items-center gap-2 font-medium ${indexingEffective ? "text-sage-deep" : "text-muted"}`}>
          <span aria-hidden className={`size-2.5 rounded-full ${indexingEffective ? "bg-sage" : "bg-stone"}`} />
          {indexingEffective ? "Visible to search engines" : "Hidden from search engines"}
        </span>
        <a href={`${SITE_URL}/robots.txt`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brass-deep underline-offset-4 hover:underline">
          robots.txt <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <a href={`${SITE_URL}/sitemap.xml`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brass-deep underline-offset-4 hover:underline">
          sitemap.xml <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <a href={SITE_URL || "/"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brass-deep underline-offset-4 hover:underline">
          Open the website <ExternalLink className="size-3.5" aria-hidden />
        </a>
        {busy ? <span className="text-muted">Saving…</span> : null}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            <span className="block font-medium">Waiting list</span>
            <span className="block text-sm text-muted">
              {waitlist === null ? "Loading…" : waitlist.length === 0 ? "No one has signed up for news yet." : `${waitlist.length} ${waitlist.length === 1 ? "person wants" : "people want"} to hear when you open.`}
            </span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!waitlist?.length}
            onClick={() => waitlist && downloadCsv(`waiting-list-${today}.csv`, ["Email", "Signed up"], waitlist.map((w) => [w.email, w.createdAt.slice(0, 10)]))}
          >
            <Download /> Export CSV
          </Button>
        </div>
        {waitlist && waitlist.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {waitlist.slice(0, 5).map((w) => (
              <li key={w.email} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2.5 text-[0.9375rem]">
                <span className="min-w-0 truncate font-medium">{w.email}</span>
                <span className="text-sm text-muted">{fmtStamp(w.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AdminCard>
  );
}
