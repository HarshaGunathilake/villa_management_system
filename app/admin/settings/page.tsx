"use client";

import { useEffect, useState } from "react";
import { CreditCard, Globe, History, Mail, MailCheck, SlidersHorizontal, UserRound, type LucideIcon } from "lucide-react";
import { EmailSettings } from "@/components/admin/email-settings";
import { WebsiteSettings } from "@/components/admin/website-settings";
import { AdminCard, AdminHeader, FormError } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, PasswordInput } from "@/components/ui/field";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import { cn, money } from "@/lib/utils";

/*
 * Platform settings in short tabs (a side menu on wide screens), so nothing needs a long scroll.
 * ?tab=email opens a tab directly.
 */

type Tab = "general" | "subscription" | "website" | "email" | "owner-emails" | "email-log" | "account";

const TABS: { id: Tab; label: string; icon: LucideIcon; title: string; text: string }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal, title: "General", text: "The platform's name and how villa owners can reach you." },
  { id: "subscription", label: "Subscription", icon: CreditCard, title: "Subscription and sign-ups", text: "The monthly price every villa pays, and who can register." },
  { id: "website", label: "Website", icon: Globe, title: "Website", text: "What visitors and search engines see on the public pages." },
  { id: "email", label: "Email server", icon: Mail, title: "Email server", text: "The SMTP account that password resets, confirmations and owner emails are sent from." },
  { id: "owner-emails", label: "Owner emails", icon: MailCheck, title: "Emails to villa owners", text: "Each one goes out by itself when it happens. Switches save straight away." },
  { id: "email-log", label: "Email log", icon: History, title: "Recent emails", text: "The last 15 emails the platform tried to send." },
  { id: "account", label: "Your account", icon: UserRound, title: "Your account", text: "Change the password you sign in with." },
];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);

export default function AdminSettingsPage() {
  const { act, notify } = useAdmin();
  const { settings, me, villas } = useAdminData();
  const [tab, setTab] = useState<Tab>("general");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isTab(wanted)) setTab(wanted);
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "general" ? "/admin/settings" : `/admin/settings?tab=${t}`);
  };
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // The Website switches save on their own, so they are left out of this form.
  const formPart = (x: typeof settings) => {
    const { searchIndexing: _i, comingSoon: _c, waitlistForm: _w, ...rest } = x;
    void _i;
    void _c;
    void _w;
    return rest;
  };
  const dirty = JSON.stringify(formPart(draft)) !== JSON.stringify(formPart(settings));
  // Villas still on another price (from before the price was the same for all). Saving moves them.
  const offPrice = villas.filter((v) => v.monthlyAmount !== settings.defaultMonthlyAmount).length;

  const save = async () => {
    const result = await act({ type: "updateSettings", patch: formPart(draft) });
    if (!result.ok) return setError(result.error);
    setError(null);
    notify("Settings saved");
  };

  const changePassword = async () => {
    if (next !== confirm) return setPasswordError("The two new passwords do not match.");
    const result = await act({ type: "changePassword", current, next });
    if (!result.ok) return setPasswordError(result.error);
    setPasswordError(null);
    setCurrent("");
    setNext("");
    setConfirm("");
    notify("Password changed");
  };

  const trialOk = Number.isInteger(draft.trialDays) && draft.trialDays >= 0 && draft.trialDays <= 365;
  const canSave = (dirty || offPrice > 0) && draft.platformName.trim().length >= 2 && draft.defaultMonthlyAmount >= 1 && trialOk;
  const current_ = TABS.find((t) => t.id === tab)!;
  // A small dot on a tab with unsaved changes, so switching tabs never hides them.
  const unsaved: Partial<Record<Tab, boolean>> = {
    general: draft.platformName !== settings.platformName || draft.supportEmail !== settings.supportEmail || draft.supportPhone !== settings.supportPhone,
    subscription:
      draft.defaultMonthlyAmount !== settings.defaultMonthlyAmount ||
      draft.trialDays !== settings.trialDays ||
      draft.signupsOpen !== settings.signupsOpen || draft.requireEmailVerification !== settings.requireEmailVerification,
  };
  const saveRow = (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
      <Button disabled={!canSave} onClick={save}>
        Save changes
      </Button>
      {dirty ? (
        <Button variant="secondary" onClick={() => setDraft(settings)}>
          Undo changes
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="max-w-5xl">
      <AdminHeader title="Settings" />

      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Settings sections" className="mb-5 lg:mb-0">
          <div role="tablist" aria-orientation="vertical" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  aria-controls="settings-panel"
                  onClick={() => choose(t.id)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2.5 rounded-full border px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors lg:rounded-xl lg:border-transparent lg:px-3",
                    on ? "border-ink bg-ink text-white lg:border-ink" : "border-line-strong bg-card text-ink hover:bg-well lg:bg-transparent",
                  )}
                >
                  <Icon className={cn("hidden size-[1.125rem] shrink-0 lg:block", on ? "text-white" : "text-muted")} aria-hidden />
                  <span className="flex-1 text-left">{t.label}</span>
                  {unsaved[t.id] ? <span className="size-2 rounded-full bg-amber" aria-label="unsaved changes" /> : null}
                </button>
              );
            })}
          </div>
        </nav>

        <section id="settings-panel" role="tabpanel" aria-labelledby="settings-title" className="min-w-0">
          <div className="mb-4">
            <h2 id="settings-title" className="text-xl font-semibold">
              {current_.title}
            </h2>
            <p className="mt-0.5 text-muted">{current_.text}</p>
          </div>

          {tab === "general" ? (
            <AdminCard className="space-y-5 p-5 sm:p-6">
              <Field label="Platform name" hint="Shown on the website, the sign-in screens, emails and the card checkout.">
                {(id) => <Input id={id} value={draft.platformName} onChange={(e) => setDraft({ ...draft, platformName: e.target.value })} />}
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Support email" hint="Shown on the website and to villa admins whose access is off.">
                  {(id) => <Input id={id} type="email" value={draft.supportEmail} onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })} />}
                </Field>
                <Field label="Support phone" hint="Also used for the WhatsApp button on the website.">
                  {(id) => <Input id={id} type="tel" value={draft.supportPhone} onChange={(e) => setDraft({ ...draft, supportPhone: e.target.value })} />}
                </Field>
              </div>
              <FormError message={error} />
              {saveRow}
            </AdminCard>
          ) : null}

          {tab === "subscription" ? (
            <AdminCard className="space-y-5 p-5 sm:p-6">
              <Field
                label="Monthly subscription price"
                hint="Every villa pays this price. A new price applies to all villas: those paying by card are charged it from their next payment, nothing extra now."
              >
                {(id) => <MoneyInput id={id} value={draft.defaultMonthlyAmount} onChange={(n) => setDraft({ ...draft, defaultMonthlyAmount: n })} />}
              </Field>
              {offPrice > 0 ? (
                <p className="rounded-xl bg-amber-soft px-4 py-3 text-[0.9375rem] text-amber-deep">
                  {offPrice} {offPrice === 1 ? "villa is" : "villas are"} still on a different price. Save to move {offPrice === 1 ? "it" : "them"} to {money(settings.defaultMonthlyAmount)}.
                </p>
              ) : null}
              <Field
                label="Free trial for new sign-ups"
                hint={
                  draft.trialDays > 0
                    ? `New owners add their card at sign-up and use everything free for ${draft.trialDays} ${draft.trialDays === 1 ? "day" : "days"}. The first charge is at the end of the trial, unless they cancel. Owners who already signed up keep the trial they were offered.`
                    : "Off: new owners pay the first month when they add their card. Owners who already signed up keep the trial they were offered."
                }
              >
                {(id) => (
                  <div className="flex items-center gap-3">
                    <Input
                      id={id}
                      inputMode="numeric"
                      className="w-28 tnum"
                      value={Number.isNaN(draft.trialDays) ? "" : String(draft.trialDays)}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        setDraft({ ...draft, trialDays: v === "" ? Number.NaN : Math.min(365, Number(v)) });
                      }}
                    />
                    <span className="text-muted">days (0 for no trial)</span>
                  </div>
                )}
              </Field>
              <div className="divide-y divide-line rounded-xl border border-line">
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={draft.signupsOpen}
                    onChange={(e) => setDraft({ ...draft, signupsOpen: e.target.checked })}
                    className="mt-0.5 size-6 shrink-0 rounded-md accent-[#252525]"
                  />
                  <span>
                    <span className="font-medium">Anyone can sign up</span>
                    <span className="block text-sm text-muted">New villa owners can register themselves. Their villa stays locked until they add their card (and, without a free trial, the first payment goes through).</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={draft.requireEmailVerification}
                    onChange={(e) => setDraft({ ...draft, requireEmailVerification: e.target.checked })}
                    className="mt-0.5 size-6 shrink-0 rounded-md accent-[#252525]"
                  />
                  <span>
                    <span className="font-medium">New sign-ups must confirm their email</span>
                    <span className="block text-sm text-muted">
                      They can&apos;t do anything, paying included, until they click the link we email them. Needs the{" "}
                      <button type="button" onClick={() => choose("email")} className="font-medium text-ink underline underline-offset-2">
                        email server
                      </button>
                      .
                    </span>
                  </span>
                </label>
              </div>
              <FormError message={error} />
              {saveRow}
            </AdminCard>
          ) : null}

          {tab === "website" ? <WebsiteSettings /> : null}
          {tab === "email" ? <EmailSettings part="server" /> : null}
          {tab === "owner-emails" ? <EmailSettings part="owners" /> : null}
          {tab === "email-log" ? <EmailSettings part="log" /> : null}

          {tab === "account" ? (
            <AdminCard className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#0b5d50] font-semibold text-white">
                  {me.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold">{me.name}</div>
                  <div className="truncate text-muted">{me.email}</div>
                </div>
              </div>
              <Field label="Current password">{(id) => <PasswordInput id={id} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}</Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="New password" hint="At least 8 characters">{(id) => <PasswordInput id={id} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}</Field>
                <Field label="Confirm new password">{(id) => <PasswordInput id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />}</Field>
              </div>
              <FormError message={passwordError} />
              <Button disabled={!current || next.length < 8} onClick={changePassword}>
                Change password
              </Button>
            </AdminCard>
          ) : null}
        </section>
      </div>
    </div>
  );
}
