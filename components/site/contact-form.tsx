"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { focusRing } from "./bits";

const TOPICS = [
  { id: "signup", label: "Signing up" },
  { id: "account", label: "My account" },
  { id: "billing", label: "Billing" },
  { id: "other", label: "Something else" },
] as const;

const field = "min-h-[3.125rem] w-full rounded-xl border border-[#c9d2cf] bg-white px-3.5 text-base font-normal focus:border-lp-accent focus:ring-2 focus:ring-lp-accent/20 focus:outline-none";

/** The Contact us form. Sends to /api/contact, which emails the support address. */
export function ContactForm() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["id"]>("signup");
  const [form, setForm] = useState({ name: "", villa: "", email: "", phone: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Please enter an email address we can reply to.");
    if (form.message.trim().length < 5) return setError("Please write a short message.");
    setBusy(true);
    const result = await api("/api/contact", { ...form, topic, email: form.email.trim() });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    setSent(true);
  };

  if (sent) {
    return (
      <div role="status" className="flex min-w-0 flex-[1_1_28.75rem] flex-col items-start rounded-[1.75rem] border border-lp-line bg-white p-8 shadow-[0_24px_60px_rgba(14,26,25,0.08)] sm:p-10">
        <CircleCheck className="size-11 text-lp-accent" aria-hidden />
        <h2 className="mt-5 font-display text-[1.75rem] font-semibold">Message sent</h2>
        <p className="mt-2 text-[1.0625rem] leading-relaxed text-lp-muted">
          Thank you, {form.name.trim().split(/\s+/)[0]}. We&apos;ll reply to <span className="font-medium text-lp-ink">{form.email.trim()}</span> soon.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setForm({ ...form, message: "" });
          }}
          className={cn("mt-6 min-h-11 font-semibold text-lp-accent underline-offset-4 hover:underline", focusRing)}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-[1_1_28.75rem] flex-col gap-5 rounded-[1.75rem] border border-lp-line bg-white p-6 shadow-[0_24px_60px_rgba(14,26,25,0.08)] sm:p-10">
      <h2 className="font-display text-[1.625rem] font-semibold">Send us a message</h2>

      <fieldset>
        <legend className="mb-2.5 text-[0.9375rem] font-medium">What is it about?</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <label
              key={t.id}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[0.9375rem] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lp-accent",
                topic === t.id ? "border-lp-ink bg-lp-ink text-white" : "border-[#c9d2cf] hover:border-lp-ink",
              )}
            >
              <input type="radio" name="topic" value={t.id} checked={topic === t.id} onChange={() => setTopic(t.id)} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-[0.9375rem] font-medium">
          Your name
          <input value={form.name} onChange={set("name")} autoComplete="name" className={field} />
        </label>
        <label className="flex flex-col gap-2 text-[0.9375rem] font-medium">
          <span>
            Villa name <span className="text-[0.8125rem] font-normal text-lp-muted">(optional)</span>
          </span>
          <input value={form.villa} onChange={set("villa")} className={field} />
        </label>
        <label className="flex flex-col gap-2 text-[0.9375rem] font-medium">
          Email
          <input type="email" value={form.email} onChange={set("email")} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} className={field} />
        </label>
        <label className="flex flex-col gap-2 text-[0.9375rem] font-medium">
          <span>
            Phone or WhatsApp <span className="text-[0.8125rem] font-normal text-lp-muted">(optional)</span>
          </span>
          <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-[0.9375rem] font-medium">
        Message
        <textarea
          rows={5}
          value={form.message}
          onChange={set("message")}
          placeholder="How many rooms do you have, and how do guests book today?"
          className={cn(field, "resize-y py-3 placeholder:text-lp-muted/70")}
        />
      </label>
      {/* Hidden from people; bots fill it in */}
      <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </label>

      {error ? (
        <p role="alert" className="rounded-xl bg-[#f4e4e0] px-4 py-3 text-[0.9375rem] text-[#8b3f33]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className={cn("group flex min-h-[3.375rem] items-center justify-center gap-2.5 rounded-xl bg-lp-accent font-semibold text-white transition-colors hover:bg-lp-accent-deep disabled:opacity-60", focusRing)}
      >
        {busy ? "Sending…" : "Send message"}
      </button>
      <p className="text-[0.8125rem] leading-normal text-lp-muted">We use your details only to reply to this message.</p>
    </form>
  );
}
