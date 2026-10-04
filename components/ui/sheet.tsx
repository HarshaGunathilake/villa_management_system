"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
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
          <div className="flex-1 overflow-y-auto px-5 pb-6 sm:px-7">{children}</div>
          {footer ? (
            <div className="border-t border-line bg-sand px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
