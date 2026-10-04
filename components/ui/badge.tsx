import { CheckCircle2, CircleDashed, CircleDot, LogIn, LogOut, Lock, XCircle, Clock3 } from "lucide-react";
import type { PaymentStatus } from "@/lib/availability";
import { cn } from "@/lib/utils";

export type Tone = "sage" | "amber" | "dusk" | "clay" | "stone" | "brass";

const tones: Record<Tone, string> = {
  sage: "bg-sage-soft text-sage-deep",
  amber: "bg-amber-soft text-amber-deep",
  dusk: "bg-dusk-soft text-dusk",
  clay: "bg-clay-soft text-clay",
  stone: "bg-stone-soft text-[#5f5a52]",
  brass: "bg-brass-soft text-brass-deep",
};

export function Badge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm leading-none font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  if (status === "Paid") return <Badge tone="sage" icon={CheckCircle2}>Paid</Badge>;
  if (status === "Partially paid") return <Badge tone="amber" icon={CircleDot}>Partially paid</Badge>;
  return <Badge tone="clay" icon={CircleDashed}>Unpaid</Badge>;
}

export const StateIcons = { available: CheckCircle2, booked: CircleDot, arriving: LogIn, leaving: LogOut, completed: Clock3, blocked: Lock, cancelled: XCircle };
