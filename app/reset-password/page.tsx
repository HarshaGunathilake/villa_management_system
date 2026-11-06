"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck, LinkIcon } from "lucide-react";
import { FormError } from "@/components/admin/ui";
import { AuthPanel } from "@/components/auth-panel";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput } from "@/components/ui/field";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const admin = params.get("portal") === "admin";
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"villa" | "admin" | null>(null);
  const signIn = admin ? "/admin/login" : "/login";
  const back = { href: signIn, label: "Back to sign in" };

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValid(false);
      return;
    }
    void api<{ valid: boolean }>(`/api/auth/reset?token=${encodeURIComponent(token)}`).then((r) => setValid(r.ok ? r.valid : false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const result = await api<{ portal: "villa" | "admin" }>("/api/auth/reset", { token, password });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(result.portal);
  };

  if (valid === null) return <AuthPanel back={back}><div className="h-40 animate-pulse rounded-xl bg-well" aria-label="Checking the link" /></AuthPanel>;

  if (done) {
    return (
      <AuthPanel back={back}>
        <CircleCheck className="size-10 text-sage" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Password changed</h1>
        <p className="mt-2 text-muted">Sign in with your new password. For safety, you have been signed out on every device.</p>
        <Link href={done === "admin" ? "/admin/login" : "/login"} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-ink px-5 font-semibold text-white">
          Sign in
        </Link>
      </AuthPanel>
    );
  }

  if (!valid) {
    return (
      <AuthPanel back={back}>
        <LinkIcon className="size-10 text-clay" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">This link no longer works</h1>
        <p className="mt-2 text-muted">Reset links work once and expire after 1 hour. Ask for a new one and use the newest email.</p>
        <Link href={admin ? "/forgot-password?portal=admin" : "/forgot-password"} className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-ink px-5 font-semibold text-white">
          Send a new link
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel back={back}>
      <form onSubmit={submit} noValidate>
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-muted">At least 8 characters. Use one you don&apos;t use anywhere else.</p>
        <div className="mt-6 space-y-5">
          <Field label="New password">{(id) => <PasswordInput id={id} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-14 text-lg" autoFocus />}</Field>
          <Field label="Type it again">{(id) => <PasswordInput id={id} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="min-h-14 text-lg" />}</Field>
        </div>
        <div className="mt-4">
          <FormError message={error} />
        </div>
        <Button type="submit" size="lg" block className="mt-4" disabled={password.length < 8 || !confirm || busy}>
          {busy ? "Saving" : "Save new password"}
        </Button>
      </form>
    </AuthPanel>
  );
}
