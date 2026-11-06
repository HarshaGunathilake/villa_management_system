"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { FormError } from "@/components/admin/ui";
import { AuthPanel } from "@/components/auth-panel";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPassword />
    </Suspense>
  );
}

function ForgotPassword() {
  const admin = useSearchParams().get("portal") === "admin";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = admin ? { href: "/admin/login", label: "Back to Super Admin sign in" } : { href: "/login", label: "Back to sign in" };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await api("/api/auth/forgot", { email: email.trim(), portal: admin ? "admin" : "villa" });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthPanel back={back}>
        <MailCheck className="size-10 text-sage" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-muted">
          If <span className="font-medium text-ink">{email.trim()}</span> has an account, a link to choose a new password is on its way. It works once and expires in 1 hour.
        </p>
        <p className="mt-4 text-[0.9375rem] text-muted">Nothing after a few minutes? Check the spam folder, or ask again.</p>
        <Button variant="secondary" block className="mt-6" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel back={back}>
      <form onSubmit={submit} noValidate>
        <h1 className="text-2xl font-semibold">Forgot your password?</h1>
        <p className="mt-2 text-muted">Enter the email you sign in with. We&apos;ll send you a link to choose a new password.</p>
        <div className="mt-6">
          <Field label="Email">
            {(id) => (
              <Input id={id} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="min-h-14 text-lg" autoFocus />
            )}
          </Field>
        </div>
        <div className="mt-4">
          <FormError message={error} />
        </div>
        <Button type="submit" size="lg" block className="mt-4" disabled={!email.includes("@") || busy}>
          {busy ? "Sending" : "Send reset link"}
        </Button>
      </form>
    </AuthPanel>
  );
}
