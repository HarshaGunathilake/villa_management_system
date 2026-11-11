"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AuthShowcase } from "@/components/auth-showcase";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { AccessDisabled } from "@/components/access-screens";
import { api } from "@/lib/api";
import { DEV_LOGIN } from "@/lib/auth";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  const { signIn, access, support, reload } = useStore();
  const [platform, setPlatform] = useState("LankaStay");
  const [email, setEmail] = useState(DEV_LOGIN.email);
  const [password, setPassword] = useState(DEV_LOGIN.password);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ platformName: string }>("/api/auth/info").then((r) => {
      if (r.ok && r.platformName) setPlatform(r.platformName);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // On success the app shell takes over and opens the home screen.
    const result = await signIn(email.trim(), password, remember);
    setBusy(false);
    if (!result.ok && result.code !== "access_disabled") setError(result);
  };

  // The password was right, but the villa or the user has been switched off.
  if (access === "disabled") return <AccessDisabled support={support} onSignOut={() => void reload()} />;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <AuthShowcase platform={platform} tagline="Bookings, guests and expenses for the villa, all in one calm place." />

      <div className="flex items-start justify-center px-5 py-8 sm:px-10 sm:py-12 lg:items-center">
        <form onSubmit={submit} className="w-full max-w-md" noValidate>
          <h1 className="text-[1.875rem] leading-tight font-semibold sm:text-4xl">Welcome back</h1>
          <p className="mt-1 text-lg text-muted">Sign in to manage your villa.</p>

          {error ? (
            <div role="alert" className="mt-6 flex gap-3 rounded-card border border-clay/30 bg-clay-soft p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-clay" />
              <div>
                <p className="font-semibold">{error.code === "invalid_credentials" ? "That email or password is not right" : "Could not sign in"}</p>
                <p className="text-[0.9375rem]">{error.code === "invalid_credentials" ? "Check both and try again. Passwords notice capital letters." : error.message}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-5">
            <Field label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="you@example.com"
                  className="min-h-14 text-lg"
                  aria-invalid={!!error}
                />
              )}
            </Field>

            <Field label="Password">
              {(id) => (
                <PasswordInput
                  id={id}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  className="min-h-14 text-lg"
                  aria-invalid={!!error}
                />
              )}
            </Field>

            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-6 shrink-0 rounded-md accent-[#252525]"
              />
              <span>
                <span className="font-medium">Keep me signed in</span>
                <span className="block text-sm text-muted">Untick this on a shared computer.</span>
              </span>
            </label>
          </div>

          <Button type="submit" size="lg" block className="mt-7" disabled={!email.trim() || !password || busy}>
            {busy ? "Signing in" : "Sign in"}
          </Button>

          <Link
            href="/forgot-password"
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl font-medium text-brass-deep underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>

          <p className="mt-6 border-t border-line pt-6 text-center">
            New here?{" "}
            <Link href="/register" className="font-medium text-brass-deep underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
