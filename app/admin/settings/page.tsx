"use client";

import { useState } from "react";
import { EmailSettings } from "@/components/admin/email-settings";
import { WebsiteSettings } from "@/components/admin/website-settings";
import { AdminCard, AdminHeader, FormError } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, PasswordInput } from "@/components/ui/field";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import { money } from "@/lib/utils";

export default function AdminSettingsPage() {
  const { act, notify } = useAdmin();
  const { settings, me, villas } = useAdminData();
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

  return (
    <div className="max-w-2xl">
      <AdminHeader title="Settings" />

      <h2 className="mb-3 text-xl font-semibold">Platform</h2>
      <AdminCard className="space-y-5 p-5 sm:p-6">
        <Field label="Platform name" hint="Shown on the sign-in screens.">
          {(id) => <Input id={id} value={draft.platformName} onChange={(e) => setDraft({ ...draft, platformName: e.target.value })} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Support email" hint="Shown to villa admins whose access is off.">
            {(id) => <Input id={id} type="email" value={draft.supportEmail} onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })} />}
          </Field>
          <Field label="Support phone">{(id) => <Input id={id} type="tel" value={draft.supportPhone} onChange={(e) => setDraft({ ...draft, supportPhone: e.target.value })} />}</Field>
        </div>
        <FormError message={error} />
        <Button disabled={(!dirty && offPrice === 0) || draft.platformName.trim().length < 2 || draft.defaultMonthlyAmount < 1} onClick={save}>
          Save changes
        </Button>
      </AdminCard>

      <h2 className="mt-10 mb-3 text-xl font-semibold">Subscription</h2>
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
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={draft.signupsOpen}
            onChange={(e) => setDraft({ ...draft, signupsOpen: e.target.checked })}
            className="mt-0.5 size-6 shrink-0 rounded-md accent-[#252525]"
          />
          <span>
            <span className="font-medium">Anyone can sign up</span>
            <span className="block text-sm text-muted">
              New villa owners can create an account from the Register page. Their villa stays locked until the first card payment goes through.
            </span>
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={draft.requireEmailVerification}
            onChange={(e) => setDraft({ ...draft, requireEmailVerification: e.target.checked })}
            className="mt-0.5 size-6 shrink-0 rounded-md accent-[#252525]"
          />
          <span>
            <span className="font-medium">New sign-ups must confirm their email</span>
            <span className="block text-sm text-muted">
              They get a link by email and can&apos;t do anything, paying included, until they click it. Needs the Email settings below. You can also confirm an owner by hand on the villa&apos;s Owner login tab.
            </span>
          </span>
        </label>
        <Button disabled={(!dirty && offPrice === 0) || draft.platformName.trim().length < 2 || draft.defaultMonthlyAmount < 1} onClick={save}>
          Save changes
        </Button>
      </AdminCard>

      <h2 className="mt-10 mb-3 text-xl font-semibold">Website</h2>
      <WebsiteSettings />

      <h2 className="mt-10 mb-3 text-xl font-semibold">Email</h2>
      <EmailSettings />

      <h2 className="mt-10 mb-3 text-xl font-semibold">Your account</h2>
      <AdminCard className="space-y-5 p-5 sm:p-6">
        <div>
          <div className="font-semibold">{me.name}</div>
          <div className="text-muted">{me.email}</div>
        </div>
        <Field label="Current password">{(id) => <PasswordInput id={id} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}</Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="New password" hint="At least 8 characters">{(id) => <PasswordInput id={id} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}</Field>
          <Field label="Confirm new password">{(id) => <PasswordInput id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />}</Field>
        </div>
        <FormError message={passwordError} />
        <Button variant="secondary" disabled={!current || next.length < 8} onClick={changePassword}>
          Change password
        </Button>
      </AdminCard>
    </div>
  );
}
