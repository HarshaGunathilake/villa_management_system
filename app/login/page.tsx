"use client";

import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Home } from "lucide-react";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { DEMO_LOGIN } from "@/lib/auth";
import { PHOTOS } from "@/lib/photos";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  const { villa, signIn } = useStore();
  const [email, setEmail] = useState(DEMO_LOGIN.email);
  const [password, setPassword] = useState(DEMO_LOGIN.password);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // On success the app shell takes over and opens the home screen.
    if (!signIn(email, password, remember)) setError(true);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* The villa itself is the welcome */}
      <div className="relative h-56 sm:h-72 lg:h-auto">
        <Photo src={PHOTOS.villa} alt={`${villa.name} seen from the pool`} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10 lg:p-14">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Home className="size-6" aria-hidden />
            </span>
            <div>
              <div className="text-2xl leading-tight font-semibold sm:text-3xl">{villa.name}</div>
              <div className="text-white/85">{villa.location}</div>
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
          <p className="mt-1 text-lg text-muted">Sign in to manage {villa.name}.</p>

          {error ? (
            <div role="alert" className="mt-6 flex gap-3 rounded-card border border-clay/30 bg-clay-soft p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-clay" />
              <div>
                <p className="font-semibold">That email or password is not right</p>
                <p className="text-[0.9375rem]">Check both and try again. Passwords notice capital letters.</p>
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
                  onChange={(e) => { setEmail(e.target.value); setError(false); }}
                  placeholder="you@example.com"
                  className="min-h-14 text-lg"
                  aria-invalid={error}
                />
              )}
            </Field>

            <Field label="Password">
              {(id) => (
                <div className="relative">
                  <Input
                    id={id}
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(false); }}
                    className="min-h-14 pr-14 text-lg"
                    aria-invalid={error}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                    className="absolute top-1/2 right-1.5 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-well hover:text-ink"
                  >
                    {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
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

          <Button type="submit" size="lg" block className="mt-7" disabled={!email.trim() || !password}>
            Sign in
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
              Password reset is not part of this prototype. In the real app a reset link would be sent to your email or
              phone.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
