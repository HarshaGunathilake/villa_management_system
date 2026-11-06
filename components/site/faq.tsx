/** Questions and answers, open one at a time. Each answer is a full sentence that stands on its own, for readers and answer engines alike. */
export function FaqList({ items, openFirst }: { items: { q: string; a: string }[]; openFirst?: boolean }) {
  return (
    <div className="min-w-0 border-t border-lp-line">
      {items.map((f, i) => (
        <details key={f.q} open={openFirst && i === 0} className="group border-b border-lp-line py-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            <h3 className="font-semibold">{f.q}</h3>
            <svg className="size-5 shrink-0 text-lp-muted transition-transform group-open:rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </summary>
          <p className="mt-2 max-w-[40rem] leading-[1.65] text-lp-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
