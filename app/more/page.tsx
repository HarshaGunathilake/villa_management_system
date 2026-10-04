"use client";

import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { MORE_LINKS, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

const NOTES: Record<string, string> = {
  "/expenses": "Bills, cleaning, repairs",
  "/money": "Revenue, expenses and profit this month",
  "/rooms": "Names, prices and which rooms take bookings",
  "/settings": "Villa name, phone, whole-villa price",
};

export default function MorePage() {
  const { villa, signOut } = useStore();
  return (
    <div>
      <PageHeader title="More" subtitle={`${villa.name}, ${villa.location}`} />
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card">
        {MORE_LINKS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex min-h-20 items-center gap-4 px-5 py-4 hover:bg-sand/70">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-well">
                <item.icon className="size-6 text-brass-deep" />
              </span>
              <span className="flex-1">
                <span className="block text-lg font-semibold">{item.label}</span>
                <span className="block text-muted">{NOTES[item.href]}</span>
              </span>
              <ChevronRight className="size-5 text-line-strong" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <Button variant="secondary" size="lg" block className="mt-6" onClick={signOut}>
        <LogOut /> Sign out
      </Button>
    </div>
  );
}
