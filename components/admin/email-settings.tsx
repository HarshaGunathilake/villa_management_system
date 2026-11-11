"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCard, FormError, fmtStamp } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Chip, Field, Input, PasswordInput, Toggle } from "@/components/ui/field";
import type { EmailKind, EmailLogEntry, MailSettings, SmtpSecurity } from "@/lib/admin-types";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/*
 * Super Admin → Settings → Email: the SMTP server, a test email, which emails
 * villa owners get, and a log of what was sent.
 */

const SECURITY: { id: SmtpSecurity; label: string; port: number; hint: string }[] = [
  { id: "starttls", label: "STARTTLS", port: 587, hint: "Most providers (port 587)" },
  { id: "tls", label: "SSL/TLS", port: 465, hint: "Port 465" },
  { id: "none", label: "None", port: 25, hint: "Only for a local test server" },
];

const OWNER_EMAILS: { key: keyof MailSettings["emails"]; label: string; hint: string }[] = [
  { key: "welcome", label: "Welcome", hint: "When a villa owner signs up, or you add a villa." },
  { key: "trial", label: "Free trial", hint: "When the card is added and the free trial starts, and 3 days before the first charge." },
  { key: "paymentReceived", label: "Payment received", hint: "Each time a card payment goes through, with the paid-until date." },
  { key: "paymentFailed", label: "Payment failed", hint: "When a renewal is declined and Dodo starts retrying." },
  { key: "subscriptionEnded", label: "Subscription ended", hint: "When the subscription is cancelled or expires and the villa becomes read-only." },
];

export const EMAIL_KIND_LABEL: Record<EmailKind, string> = {
  test: "Test",
  contact: "Website message",
  password_reset: "Password reset",
  verify_email: "Email confirmation",
  welcome: "Welcome",
  payment_received: "Payment received",
  payment_failed: "Payment failed",
  subscription_ended: "Subscription ended",
  trial_started: "Free trial started",
  trial_ending: "Free trial ending",
  monthly_report: "Monthly report",
};

type Loaded = { mail: MailSettings; log: EmailLogEntry[]; canStoreSecrets: boolean; appUrlSet: boolean };

/** One part of the email settings, each shown on its own tab. */
export function EmailSettings({ part }: { part: "server" | "owners" | "log" }) {
  const { act, notify } = useAdmin();
  const { me } = useAdminData();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MailSettings | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState(me.email);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api<Loaded>("/api/admin/email");
    if (!result.ok) return setLoadError(result.error);
    setLoaded(result);
    setDraft((d) => d ?? result.mail);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loadError) return <AdminCard className="p-5 text-clay">{loadError}</AdminCard>;
  if (!loaded || !draft) return <AdminCard className="h-40 animate-pulse" aria-label="Loading email settings" />;

  const saved = loaded.mail;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || password !== "";
  const configured = Boolean(saved.host && (saved.fromEmail || saved.user));

  const save = async (patch?: Partial<MailSettings>, extra?: Record<string, unknown>) => {
    setSaving(true);
    const body = { ...(patch ?? draft), ...(password ? { password } : {}), ...extra };
    const result = await act<{ mail: MailSettings }>({ type: "saveMail", mail: body });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    setPassword("");
    setDraft(result.mail);
    await load();
    notify("Email settings saved");
  };

  const sendTest = async () => {
    setTesting(true);
    const result = await act({ type: "sendTestEmail", to: testTo });
    setTesting(false);
    await load();
    if (!result.ok) return setTestError(result.error);
    setTestError(null);
    notify(`Test email sent to ${testTo}`);
  };

  // A switch saves straight away.
  const toggle = async (key: keyof MailSettings["emails"], on: boolean) => {
    const emails = { ...saved.emails, [key]: on };
    setDraft({ ...draft, emails });
    const result = await act<{ mail: MailSettings }>({ type: "saveMail", mail: { emails } });
    if (!result.ok) {
      setDraft({ ...draft, emails: saved.emails });
      return notify(result.error);
    }
    await load();
    notify(on ? "Email switched on" : "Email switched off");
  };

  if (part === "owners") {
    return (
      <AdminCard className="divide-y divide-line">
        {OWNER_EMAILS.map((e) => (
          <div key={e.key} className="flex items-center gap-4 px-5 py-4">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{e.label}</span>
              <span className="block text-sm text-muted">{e.hint}</span>
            </span>
            <Toggle checked={draft.emails[e.key]} onChange={(on) => toggle(e.key, on)} label={`${e.label} email`} />
          </div>
        ))}
        {configured ? null : <p className="bg-amber-soft px-5 py-3 text-[0.9375rem] text-amber-deep">These only go out once the email server is set up.</p>}
      </AdminCard>
    );
  }

  if (part === "log") {
    return (
      <AdminCard className="divide-y divide-line overflow-hidden">
        {loaded.log.length === 0 ? <p className="p-5 text-muted">No emails sent yet.</p> : null}
        {loaded.log.slice(0, 15).map((m) => (
          <div key={m.id} className="flex items-start gap-3 px-5 py-3.5">
            <span
              aria-hidden
              className={cn("mt-2 size-2.5 shrink-0 rounded-full", m.status === "sent" ? "bg-sage" : m.status === "failed" ? "bg-clay" : "bg-stone")}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.subject}</span>
              <span className="block truncate text-sm text-muted">
                {EMAIL_KIND_LABEL[m.kind] ?? m.kind} · {m.to} · {fmtStamp(m.createdAt)}
              </span>
              {m.error ? <span className="mt-1 block text-sm break-words text-clay">{m.error}</span> : null}
            </span>
            <span className={cn("shrink-0 text-sm font-medium", m.status === "sent" ? "text-sage" : m.status === "failed" ? "text-clay" : "text-muted")}>
              {m.status === "sent" ? "Sent" : m.status === "failed" ? "Failed" : "Not sent"}
            </span>
          </div>
        ))}
      </AdminCard>
    );
  }

  return (
    <>
      <AdminCard className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", configured ? "bg-sage" : "bg-amber")} />
          <p className="text-[0.9375rem] text-muted">
            {configured
              ? "Email is set up. Password reset links and the owner emails that are switched on go out from this server."
              : "Email is not set up yet. Until it is, villa owners can't reset a forgotten password by email and no emails go out."}
          </p>
        </div>

        {!loaded.canStoreSecrets ? (
          <p className="rounded-xl bg-amber-soft px-4 py-3 text-[0.9375rem] text-amber-deep">
            Add <code className="font-mono">APP_SECRET</code> (any long random text) to the server&apos;s environment variables and restart it. The SMTP password is encrypted with it before it is saved.
          </p>
        ) : null}
        {!loaded.appUrlSet ? (
          <p className="rounded-xl bg-amber-soft px-4 py-3 text-[0.9375rem] text-amber-deep">
            Set <code className="font-mono">APP_URL</code> to the site&apos;s address so emails can link back to it.
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field label="SMTP server" hint="For example smtp.hostinger.com or smtp.gmail.com">
            {(id) => <Input id={id} value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} autoComplete="off" spellCheck={false} />}
          </Field>
          <Field label="Port">
            {(id) => <Input id={id} inputMode="numeric" value={String(draft.port)} onChange={(e) => setDraft({ ...draft, port: Number(e.target.value.replace(/\D/g, "")) || 0 })} />}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 font-medium">Connection security</legend>
          <div className="flex flex-wrap gap-2">
            {SECURITY.map((s) => (
              <Chip key={s.id} selected={draft.security === s.id} onClick={() => setDraft({ ...draft, security: s.id, port: SECURITY.some((x) => x.port === draft.port) ? s.port : draft.port })}>
                {s.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{SECURITY.find((s) => s.id === draft.security)?.hint}</p>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Username">
            {(id) => <Input id={id} value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} autoComplete="off" spellCheck={false} />}
          </Field>
          <Field label="Password" hint={saved.hasPassword ? "Saved. Leave blank to keep it." : "Stored encrypted."}>
            {(id) => (
              <PasswordInput id={id} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={saved.hasPassword ? "••••••••" : ""} disabled={!loaded.canStoreSecrets} />
            )}
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sender name" hint="Leave blank to use the platform name">
            {(id) => <Input id={id} value={draft.fromName} onChange={(e) => setDraft({ ...draft, fromName: e.target.value })} />}
          </Field>
          <Field label="Sender email" hint="Leave blank to use the username">
            {(id) => <Input id={id} type="email" value={draft.fromEmail} onChange={(e) => setDraft({ ...draft, fromEmail: e.target.value })} placeholder="no-reply@yourdomain.com" />}
          </Field>
        </div>

        <FormError message={error} />
        <div className="flex flex-wrap gap-3">
          <Button disabled={!dirty || saving || draft.port < 1} onClick={() => save()}>
            {saving ? "Saving…" : "Save email settings"}
          </Button>
          {saved.hasPassword ? (
            <Button variant="secondary" disabled={saving} onClick={() => save({}, { clearPassword: true })}>
              Remove saved password
            </Button>
          ) : null}
        </div>

        <div className="border-t border-line pt-5">
          <Field label="Send a test email to" hint={dirty ? "Save your changes first; the test uses the saved settings." : undefined}>
            {(id) => (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input id={id} type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="sm:flex-1" />
                <Button variant="secondary" disabled={!configured || testing || dirty || !testTo.includes("@")} onClick={sendTest}>
                  {testing ? "Sending…" : "Send test email"}
                </Button>
              </div>
            )}
          </Field>
          <div className="mt-3">
            <FormError message={testError} />
          </div>
        </div>
      </AdminCard>

    </>
  );
}
