/*
 * Small static pictures of the app's own screens, for the landing page. They
 * are drawn in HTML rather than screenshots, so they stay sharp at any size.
 * The names and amounts in them are made up.
 */

function Tag({ children, tone }: { children: React.ReactNode; tone: "paid" | "due" | "free" }) {
  const c = { paid: "bg-[#ddefe5] text-[#22583f]", due: "bg-[#fbebd3] text-[#7a4608]", free: "bg-[#edf1f0] text-[#46524f]" }[tone];
  return <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${c}`}>{children}</span>;
}

/** The hero: tonight's rooms, on the lagoon panel. */
export function TonightPanel() {
  const rows = [
    { dot: "bg-[#2f7d5b]", room: "Sunrise Room", who: "Anika Sharma", tag: <Tag tone="paid">Paid</Tag> },
    { dot: "bg-[#c27a1a]", room: "Garden Room · arrives 2:00 PM", who: "Pieter de Vries", tag: <Tag tone="due">LKR 38,000 due</Tag> },
    { dot: "bg-[#b9c4c1]", room: "Coral Room", who: "Free tonight", tag: <Tag tone="free">LKR 13,000</Tag> },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-[1.75rem] bg-lp-accent p-5 sm:p-8" role="img" aria-label="Preview of the home screen: tonight's rooms, who is staying and what is owed">
      <div className="overflow-hidden rounded-[1.125rem] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-lp-hairline px-5 py-4 sm:px-6">
          <div>
            <div className="text-[0.8125rem] text-lp-muted">Sunday, 15 November</div>
            <div className="font-display text-lg font-semibold">Tonight at Ocean Breeze</div>
          </div>
          <div className="font-display text-[1.625rem] font-bold tracking-[-0.02em]">2/3</div>
        </div>
        <ul className="divide-y divide-lp-hairline">
          {rows.map((r) => (
            <li key={r.who} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6">
              <span className={`size-2.5 shrink-0 rounded-full ${r.dot}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.8125rem] text-lp-muted">{r.room}</div>
                <div className="truncate font-semibold">{r.who}</div>
              </div>
              {r.tag}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex-[1_1_10rem] rounded-2xl bg-white/12 px-5 py-4 text-white">
          <div className="text-[0.8125rem] text-white/80">Arriving today</div>
          <div className="mt-0.5 font-display text-[1.375rem] font-semibold">1 guest</div>
        </div>
        <div className="flex-[1_1_10rem] rounded-2xl bg-white/12 px-5 py-4 text-white">
          <div className="text-[0.8125rem] text-white/80">Owed this week</div>
          <div className="mt-0.5 font-display text-[1.375rem] font-semibold">LKR 64,300</div>
        </div>
      </div>
    </div>
  );
}

/** The calendar: rooms and the whole villa on one timeline, with a clash caught. */
export function CalendarPicture() {
  const days = ["14", "15", "16", "17", "18", "19", "20"];
  const grid = "grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] items-center sm:grid-cols-[6rem_repeat(7,minmax(0,1fr))]";
  const rows: { name: string; bar?: { col: string; label: string; tone: string } }[] = [
    { name: "Whole villa", bar: { col: "col-[7/span_2]", label: "Fernandos", tone: "bg-[#2e4a6b]" } },
    { name: "Sunrise", bar: { col: "col-[2/span_4]", label: "A. Sharma", tone: "bg-lp-accent" } },
    { name: "Garden", bar: { col: "col-[3/span_2]", label: "P. de Vries", tone: "bg-[#c27a1a]" } },
    { name: "Coral" },
  ];
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-lp-ground p-4 sm:p-5" role="img" aria-label="Preview of the calendar with rooms and the whole villa, and a clash being refused">
      <div className={`${grid} text-[0.8125rem] text-lp-muted`}>
        <span />
        {days.map((d) => (
          <span key={d} className="text-center tabular-nums">{d}</span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.name} className={`${grid} text-sm`}>
          <span className="truncate pr-2 font-semibold">{r.name}</span>
          {r.bar ? (
            <span className={`${r.bar.col} truncate rounded-lg px-2.5 py-2 text-xs font-semibold text-white ${r.bar.tone}`}>{r.bar.label}</span>
          ) : (
            <span className="col-[2/span_7] h-[2.125rem]" />
          )}
        </div>
      ))}
      <p className="mt-1.5 rounded-[0.625rem] bg-[#fbe6e2] px-3.5 py-2.5 text-sm text-[#8a2e21]">
        <strong>The whole villa isn&apos;t free on 16 Nov.</strong> Sunrise and Garden have guests that night.
      </p>
    </div>
  );
}

/** Check-out: the bill with extras, the advance and the balance. */
export function BillPicture() {
  const lines = [
    ["Garden Room, 2 nights", "26,000"],
    ["Airport pickup", "4,500"],
    ["Dinner for two", "6,800"],
  ];
  return (
    <div className="flex flex-1 flex-col gap-6" role="img" aria-label="Preview of the check-out bill with extras, the advance paid and the balance">
      <dl className="flex flex-col gap-3 text-[0.9375rem]">
        {lines.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-lp-night-muted">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-lp-night-line pt-3">
          <dt className="text-lp-night-muted">Advance paid</dt>
          <dd className="font-medium text-lp-mint tabular-nums">− 10,000</dd>
        </div>
      </dl>
      <div className="mt-auto flex items-baseline justify-between gap-3 rounded-[0.875rem] bg-lp-night px-4.5 py-4">
        <span className="text-lp-night-muted">Balance, LKR</span>
        <span className="font-display text-[1.875rem] font-bold tracking-[-0.02em] tabular-nums">27,300</span>
      </div>
    </div>
  );
}

/** Money: a month's income and expenses, and where it went. */
export function MoneyPicture() {
  const spend = [
    { label: "Salaries", value: "52,000", pct: "w-[47%]" },
    { label: "Electricity", value: "23,400", pct: "w-[21%]" },
    { label: "Food and supplies", value: "19,750", pct: "w-[18%]" },
  ];
  return (
    <div className="flex flex-col gap-5" role="img" aria-label="Preview of the monthly money summary: income, expenses and spending by category">
      <div className="flex gap-6">
        <div>
          <div className="text-[0.8125rem] text-lp-muted">Income</div>
          <div className="font-display text-2xl font-bold tabular-nums">533,000</div>
        </div>
        <div>
          <div className="text-[0.8125rem] text-lp-muted">Expenses</div>
          <div className="font-display text-2xl font-bold tabular-nums">110,250</div>
        </div>
      </div>
      <ul className="flex flex-col gap-2.5 text-sm">
        {spend.map((s) => (
          <li key={s.label}>
            <div className="flex justify-between">
              <span>{s.label}</span>
              <span className="text-lp-muted tabular-nums">{s.value}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-[#edf1f0]">
              <div className={`h-1.5 rounded-full bg-lp-accent ${s.pct}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A returning guest. */
export function GuestPicture() {
  return (
    <div className="mt-auto flex items-center gap-3.5 rounded-[0.875rem] bg-white p-4" role="img" aria-label="Preview of a guest record with past stays">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lp-accent font-semibold text-white">NP</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Nimali Perera</div>
        <div className="text-[0.8125rem] text-lp-muted">4 stays · last in August</div>
      </div>
    </div>
  );
}
