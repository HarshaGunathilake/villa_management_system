"use client";

import { useState } from "react";
import { AdminCard, AdminHeader, FormError } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, PasswordInput } from "@/components/ui/field";
import { useAdmin, useAdminData } from "@/lib/admin-store";

export default function AdminSettingsPage() {
  const { act, notify } = useAdmin();
  const { settings, me } = useAdminData();
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const save = async () => {
    const result = await act({ type: "updateSettings", patch: draft });
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
        <Field label="Default monthly subscription" hint="Filled in when you add a villa. You can change it for each villa.">
          {(id) => <MoneyInput id={id} value={draft.defaultMonthlyAmount} onChange={(n) => setDraft({ ...draft, defaultMonthlyAmount: n })} />}
        </Field>
        <FormError message={error} />
        <Button disabled={!dirty || draft.platformName.trim().length < 2} onClick={save}>
          Save changes
        </Button>
      </AdminCard>

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
