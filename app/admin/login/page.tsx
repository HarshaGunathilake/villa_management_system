"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { useAdmin } from "@/lib/admin-store";

export default function AdminLoginPage() {
  const { signIn } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await signIn(email.trim(), password, remember);
    setBusy(false);
    if (!result.ok) setError(result.code === "invalid_credentials" ? "That email or password is not right." : result.message);
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-sand p-6 shadow-float sm:p-9" noValidate>
        <div className="flex items-center gap-3">
          <BrandMark className="size-12" />
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted">
            <ShieldCheck className="size-4" aria-hidden /> Super Admin
          </span>
        </div>
        <h1 className="mt-5 text-[1.75rem] leading-tight font-semibold">Super Admin sign in</h1>
        <p className="mt-1 text-muted">Platform administration. Villa owners sign in on the villa page.</p>

        {error ? (
          <div role="alert" className="mt-5 flex gap-3 rounded-card border border-clay/30 bg-clay-soft p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-clay" />
            <p className="font-medium">{error}</p>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          <Field label="Email">
            {(id) => <Input id={id} type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} />}
          </Field>
          <Field label="Password">
            {(id) => (
              <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
            )}
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-5 shrink-0 accent-[#252525]" />
            <span className="font-medium">Keep me signed in on this computer</span>
          </label>
        </div>

        <Button type="submit" size="lg" block className="mt-7" disabled={!email.trim() || !password || busy}>
          {busy ? "Signing in" : "Sign in"}
        </Button>
        <Link href="/forgot-password?portal=admin" className="mt-4 flex min-h-11 items-center justify-center font-medium text-brass-deep underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </form>
    </div>
  );
}
