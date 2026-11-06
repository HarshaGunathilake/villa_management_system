"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Home } from "lucide-react";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { AccessDisabled } from "@/components/access-screens";
import { api } from "@/lib/api";
import { DEV_LOGIN } from "@/lib/auth";
import { PHOTOS } from "@/lib/photos";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  const { signIn, access, support, reload } = useStore();
  const [platform, setPlatform] = useState("Villa Stay Manager");
  const [email, setEmail] = useState(DEV_LOGIN.email);
  const [password, setPassword] = useState(DEV_LOGIN.password);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
      {/* The villa itself is the welcome */}
      <div className="relative h-56 sm:h-72 lg:h-auto">
        <Photo src={PHOTOS.villa} alt="A villa seen from its pool" className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10 lg:p-14">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Home className="size-6" aria-hidden />
            </span>
            <div>
              <div className="text-2xl leading-tight font-semibold sm:text-3xl">{platform}</div>
              <div className="text-white/85">For villa owners and managers</div>
            </div>
          </div>
          <p className="mt-6 hidden max-w-md text-xl leading-snug text-white/90 lg:block">
            Bookings, guests and expenses for the villa, all in one calm place.
          </p>
        </div>
      </div>

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

          <button
            type="button"
            onClick={() => setHelpOpen(!helpOpen)}
            aria-expanded={helpOpen}
            className="mt-4 min-h-11 w-full rounded-xl font-medium text-brass-deep underline-offset-4 hover:underline"
          >
            Forgot your password?
          </button>
          {helpOpen ? (
            <p className="rounded-card border border-line bg-card p-4 text-[0.9375rem] text-muted">
              Ask the platform administrator to reset your password. They can set a new one for you straight away.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
