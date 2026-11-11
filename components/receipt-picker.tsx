"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
 * Attach a receipt (a photo or a PDF). The file uploads straight away to the
 * villa's private storage; the form then saves the expense with it.
 */

export type Receipt = { key: string; name: string };

async function upload(file: File): Promise<{ ok: true; receipt: Receipt } | { ok: false; error: string }> {
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/villa/receipts", { method: "POST", body, credentials: "same-origin" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; key?: string; name?: string; error?: string } | null;
    if (res.ok && json?.ok && json.key) return { ok: true, receipt: { key: json.key, name: json.name ?? file.name } };
    return { ok: false, error: json?.error ?? "The file could not be uploaded. Please try again." };
  } catch {
    return { ok: false, error: "No connection. Check the internet and try again." };
  }
}

export function ReceiptPicker({ value, onChange, onBusy, label = "Attach a receipt" }: { value: Receipt | null; onChange: (r: Receipt | null) => void; onBusy?: (busy: boolean) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(file.name);
    onBusy?.(true);
    const result = await upload(file);
    setBusy(null);
    onBusy?.(false);
    if (input.current) input.current.value = "";
    if (result.ok) onChange(result.receipt);
    else setError(result.error);
  };

  return (
    <div>
      <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
      {busy ? (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-muted">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Uploading {busy}…</span>
        </div>
      ) : value ? (
        <div className="flex items-center gap-3 rounded-xl border border-sage/40 bg-sage-soft px-4 py-3 text-sage-deep">
          <FileText className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{value.name}</span>
          <button type="button" className="grid size-9 place-items-center rounded-full hover:bg-white/60" aria-label="Remove receipt" onClick={() => onChange(null)}>
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button variant="secondary" block onClick={() => input.current?.click()}>
          <Paperclip /> {label}
        </Button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[0.9375rem] text-clay">
          {error}
        </p>
      ) : (
        !value && !busy && <p className="mt-1.5 text-sm text-muted">A photo or a PDF, up to 10 MB.</p>
      )}
    </div>
  );
}
