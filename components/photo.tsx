"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** A photo that quietly falls back to a warm tone when it can't load (for example, offline). */
export function Photo({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("overflow-hidden bg-gradient-to-br from-[#e9dfcd] to-[#d9c8ab]", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : null}
    </div>
  );
}
