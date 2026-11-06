"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/brand";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { api } from "@/lib/api";
import { PHOTOS } from "@/lib/photos";
import { useStore } from "@/lib/store";
import { money } from "@/lib/utils";

/*
 * Anyone can create a villa account here. The account opens locked: the next
 * screen asks for the first card payment, and the villa opens once it goes through.
 */

const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL;

interface Info {
  platformName: string;
  signup: { open: boolean; monthlyAmount: number };
}

const blank = { villaName: "", location: "", ownerName: "", email: "", phone: "", password: "", confirm: "" };

export default function RegisterPage() {
  const { reload } = useStore();
  const [info, setInfo] = useState<Info | null>(null);
  const [form, setForm] = useState(blank);
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<Info>("/api/auth/info").then((r) => {
      if (r.ok) setInfo({ platformName: r.platformName || "LankaStay", signup: r.signup });
    });
  }, []);

  const set = (key: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [key]: e.target.value });
    setError(null);
  };

  const problem =
    form.villaName.trim().length < 2 ? "Enter your villa's name."
    : form.ownerName.trim().length < 2 ? "Enter your name."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? "Enter a valid email address."
    : form.password.length < 8 ? "The password needs at least 8 characters."
    : form.password !== form.confirm ? "The two passwords do not match."
    : !accept ? "Please accept the terms to continue."
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return setError(problem);
    setBusy(true);
    const result = await api("/api/auth/register", {
      villaName: form.villaName,
      location: form.location,
      ownerName: form.ownerName,
      email: form.email.trim(),
      phone: form.phone,
      password: form.password,
      acceptTerms: accept,
    });
    if (!result.ok) {
      setBusy(false);
      return setError(result.error);
    }
    // Signed in: the app shell now shows "Confirm your email", then the first-payment screen.
    await reload();
  };

  const platform = info?.platformName ?? "LankaStay";
  const closed = info !== null && !info.signup.open;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="relative h-56 sm:h-72 lg:h-auto">
        <Photo src={PHOTOS.villa} alt="A villa seen from its pool" className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10 lg:p-14">
          <div className="flex items-center gap-3">
            <BrandMark className="size-11" />
            <div>
              <Wordmark name={platform} className="block text-2xl leading-tight sm:text-3xl" accentClassName="text-[#bfe3d8]" />
              <div className="text-white/85">For villa owners and managers</div>
            </div>
          </div>
          <p className="mt-6 hidden max-w-md text-xl leading-snug text-white/90 lg:block">
            Bookings by the whole villa or by the room, guests, check-in and check-out, invoices and expenses, all in one place.
          </p>
        </div>
      </div>

      <div className="flex items-start justify-center px-5 py-8 sm:px-10 sm:py-12 lg:items-center">
        <form onSubmit={submit} className="w-full max-w-md" noValidate>
          <h1 className="text-[1.875rem] leading-tight font-semibold sm:text-4xl">Create your account</h1>
          {info?.signup.open ? (
            <p className="mt-1 text-lg text-muted">
              {money(info.signup.monthlyAmount)} a month, paid by card. Cancel any time.
            </p>
          ) : (
            <p className="mt-1 text-lg text-muted">Set up your villa in a few minutes.</p>
          )}

          {closed ? (
            <div role="status" className="mt-6 rounded-card border border-line bg-card p-5">
              <p className="font-semibold">New sign-ups are closed at the moment</p>
              <p className="mt-1 text-[0.9375rem] text-muted">Please contact us, or try again later.</p>
            </div>
          ) : (
            <>
              {error ? (
                <div role="alert" className="mt-6 flex gap-3 rounded-card border border-clay/30 bg-clay-soft p-4">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-clay" />
                  <p className="text-[0.9375rem]">{error}</p>
                </div>
              ) : null}

              <div className="mt-6 space-y-5">
                <Field label="Villa name">{(id) => <Input id={id} value={form.villaName} onChange={set("villaName")} placeholder="e.g. Ocean Breeze Villa" autoComplete="organization" />}</Field>
                <Field label="Location" optional>{(id) => <Input id={id} value={form.location} onChange={set("location")} placeholder="e.g. Mirissa, Matara" />}</Field>
                <Field label="Your name">{(id) => <Input id={id} value={form.ownerName} onChange={set("ownerName")} autoComplete="name" />}</Field>
                <Field label="Email" hint="You sign in with this.">
                  {(id) => (
                    <Input id={id} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={form.email} onChange={set("email")} placeholder="you@example.com" />
                  )}
                </Field>
                <Field label="Phone" optional>{(id) => <Input id={id} type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />}</Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Password" hint="At least 8 characters">{(id) => <PasswordInput id={id} autoComplete="new-password" value={form.password} onChange={set("password")} />}</Field>
                  <Field label="Confirm password">{(id) => <PasswordInput id={id} autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />}</Field>
                </div>

                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={accept}
                    onChange={(e) => { setAccept(e.target.checked); setError(null); }}
                    className="mt-0.5 size-6 shrink-0 rounded-md accent-[#252525]"
                  />
                  <span className="text-[0.9375rem]">
                    I agree to the{" "}
                    {TERMS_URL ? <a href={TERMS_URL} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">Terms of Service</a> : "Terms of Service"}
                    {" "}and{" "}
                    {PRIVACY_URL ? <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">Privacy Policy</a> : "Privacy Policy"}.
                  </span>
                </label>
              </div>

              <Button type="submit" size="lg" block className="mt-7" disabled={busy || info === null}>
                {busy ? <Loader2 className="animate-spin" /> : null} {busy ? "Creating your account" : "Create account"}
              </Button>
              <p className="mt-3 text-center text-sm text-muted">Next, you pay the first month by card. Your villa opens as soon as it goes through.</p>
            </>
          )}

          <p className="mt-6 text-center">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brass-deep underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
