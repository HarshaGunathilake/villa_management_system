"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/brand";
import { api } from "@/lib/api";

/** The plain, centred frame for the password pages. */
export function AuthPanel({ children, back }: { children: React.ReactNode; back: { href: string; label: string } }) {
  const [platform, setPlatform] = useState("LankaStay");
  useEffect(() => {
    void api<{ platformName: string }>("/api/auth/info").then((r) => {
      if (r.ok && r.platformName) setPlatform(r.platformName);
    });
  }, []);
  return (
    <div className="flex min-h-dvh flex-col items-center bg-sand px-4 py-10 sm:py-16">
      <Link href="/" className="flex items-center gap-2.5" aria-label={`${platform} home`}>
        <BrandMark className="size-9" />
        <Wordmark name={platform} className="text-2xl" />
      </Link>
      <div className="mt-8 w-full max-w-md rounded-card border border-line bg-card p-6 shadow-sm sm:p-8">{children}</div>
      <Link href={back.href} className="mt-6 min-h-11 font-medium text-brass-deep underline-offset-4 hover:underline">
        {back.label}
      </Link>
    </div>
  );
}
