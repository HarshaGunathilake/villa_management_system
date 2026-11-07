"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck, LinkIcon } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { api } from "@/lib/api";

/** The link from the confirmation email. */
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"checking" | "done" | "failed">("checking");
  const [message, setMessage] = useState<string | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("failed");
      return;
    }
    void api("/api/auth/verify", { token }).then((r) => {
      if (r.ok) setState("done");
      else {
        setMessage(r.error);
        setState("failed");
      }
    });
  }, [token]);

  const back = { href: "/login", label: "Back to sign in" };
  if (state === "checking") return <AuthPanel back={back}><div className="h-40 animate-pulse rounded-xl bg-well" aria-label="Confirming your email" /></AuthPanel>;

  if (state === "done") {
    return (
      <AuthPanel back={back}>
        <CircleCheck className="size-10 text-sage" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Email confirmed</h1>
        <p className="mt-2 text-muted">Thank you. Your account is ready. Carry on to your dashboard.</p>
        <Link href="/dashboard" className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-ink px-5 font-semibold text-white">
          Continue
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel back={back}>
      <LinkIcon className="size-10 text-clay" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">This link no longer works</h1>
      <p className="mt-2 text-muted">{message ?? "The link is incomplete."} Links work for 24 hours, and only the newest one works.</p>
      <Link href="/dashboard" className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-ink px-5 font-semibold text-white">
        Sign in to get a new link
      </Link>
    </AuthPanel>
  );
}
