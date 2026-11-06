"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import { useReadOnly } from "@/lib/store";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Slides up from the bottom on phones, in from the right on larger screens. */
export function Sheet({ open, onOpenChange, title, description, children, footer, className }: SheetProps) {
  // Payment due: the panel can be read, but nothing in it can be saved.
  const readOnly = useReadOnly();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "anim-sheet fixed z-50 flex flex-col bg-sand shadow-float outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl",
            "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-l-3xl",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-7 sm:pt-7">
            <div>
              <Dialog.Title className="text-[1.375rem] leading-tight font-semibold">{title}</Dialog.Title>
              {description ? <p className="mt-1 text-muted">{description}</p> : null}
            </div>
            <Dialog.Close
              className="-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-well hover:text-ink"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
            {readOnly ? <PausedNotice onNavigate={() => onOpenChange(false)} /> : null}
            {children}
          </div>
          {footer ? (
            <div className="border-t border-line bg-sand px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
              <fieldset disabled={readOnly} className="contents">
                {footer}
              </fieldset>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PausedNotice({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div role="status" className="mb-5 flex gap-3 rounded-xl bg-amber-soft px-4 py-3.5 text-amber-deep">
      <Lock className="mt-0.5 size-5 shrink-0" />
      <div className="text-[0.9375rem]">
        <p className="font-semibold">Changes are paused</p>
        <p>Your subscription payment is due, so nothing here can be saved until it is paid.</p>
        <Link href="/subscription" onClick={onNavigate} className="mt-1 inline-block font-medium underline underline-offset-4">
          Go to Subscription
        </Link>
      </div>
    </div>
  );
}
