"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { api } from "@/lib/api";
import { focusRing } from "./bits";

/** "Tell me when it opens": saves the email to the waitlist. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Please enter a valid email address.");
    setBusy(true);
    const result = await api("/api/waitlist", { email: email.trim(), website });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    setDone(true);
  };

  if (done) {
    return (
      <p role="status" className="flex items-start gap-3 rounded-2xl border border-lp-line bg-white px-5 py-4 text-[1.0625rem]">
        <CircleCheck className="mt-0.5 size-6 shrink-0 text-lp-accent" aria-hidden />
        <span>
          You&apos;re on the list. We&apos;ll email <span className="font-semibold">{email.trim()}</span> when it opens.
        </span>
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="waitlist-email" className="text-[0.9375rem] font-medium">
        Your email
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@example.com"
          aria-invalid={!!error}
          aria-describedby={error ? "waitlist-error" : undefined}
          className="min-h-[3.25rem] min-w-0 flex-1 rounded-xl border border-[#c9d2cf] bg-white px-4 text-base focus:border-lp-accent focus:ring-2 focus:ring-lp-accent/20 focus:outline-none"
        />
        <button type="submit" disabled={busy} className={`min-h-[3.25rem] shrink-0 rounded-xl bg-lp-ink px-6 font-semibold text-white transition-colors hover:bg-lp-accent disabled:opacity-60 ${focusRing}`}>
          {busy ? "Saving…" : "Tell me when it opens"}
        </button>
      </div>
      {/* Hidden from people; bots fill it in */}
      <input tabIndex={-1} aria-hidden="true" autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-px w-px" />
      {error ? (
        <p id="waitlist-error" role="alert" className="mt-2 text-[0.9375rem] text-[#8b3f33]">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[0.8125rem] text-lp-muted">One email when we open. Nothing else.</p>
      )}
    </form>
  );
}
