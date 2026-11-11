import { BedDouble, CalendarDays, CheckCircle2, LogIn, LogOut, Zap } from "lucide-react";
import { BrandMark, ISLAND_OUTLINE, Wordmark } from "@/components/brand";

/*
 * The left side of the sign-in and register pages: the LankaStay green, a large
 * quiet outline of the island, and a few cards showing what the app does.
 * Drawn in code, so it is sharp at any size and needs no image to load.
 * The cards are illustrations, not live data.
 */

const ROOMS = [
  { name: "Ocean View", bars: [{ from: 0, len: 3, tone: "dusk", label: "Emma T." }, { from: 4, len: 3, tone: "brass", label: "Dilani P." }] },
  { name: "Garden", bars: [{ from: 1, len: 4, tone: "sage", label: "Kasun F." }] },
  { name: "Pool View", bars: [{ from: 2, len: 2, tone: "brass", label: "Mark R." }, { from: 5, len: 2, tone: "dusk", label: "Ana S." }] },
] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TONE = { dusk: "bg-[#3f5873] text-white", brass: "bg-[#f3eadd] text-[#8a6638] ring-1 ring-[#e2cfb3]", sage: "bg-[#e6efe9] text-[#3f6b53] ring-1 ring-[#c7dccf]" };

export function AuthShowcase({ platform, tagline }: { platform: string; tagline: string }) {
  return (
    <div className="relative isolate h-56 overflow-hidden bg-[#0b5d50] text-white sm:h-72 lg:h-auto lg:min-h-dvh">
      {/* Light from the top left, and a darker floor */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_0%_0%,#14806e_0%,transparent_55%),linear-gradient(180deg,transparent_40%,#07463c_100%)]" />
      {/* Fine dots */}
      <div className="absolute inset-0 -z-10 opacity-[0.18] [background-image:radial-gradient(#ffffff_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(180deg,#000_0%,transparent_85%)]" />
      {/* The island, very large and quiet */}
      <svg viewBox="12 4 24 40" aria-hidden className="absolute -right-16 -bottom-24 -z-10 h-[125%] max-h-[64rem] text-white opacity-[0.09] lg:-right-24 lg:-bottom-28">
        <path d={ISLAND_OUTLINE} fill="currentColor" />
      </svg>

      <div className="flex h-full flex-col p-6 sm:p-10 lg:min-h-dvh lg:p-14">
        <div className="flex items-center gap-3">
          <BrandMark variant="bare" roof="#0b5d50" className="size-11 rounded-[0.8rem] bg-white/10 p-1 ring-1 ring-white/20" />
          <div>
            <Wordmark name={platform} className="block text-2xl leading-tight sm:text-3xl" accentClassName="text-[#bfe3d8]" />
            <div className="text-white/80">For villa owners and managers</div>
          </div>
        </div>

        {/* The app, in three cards (wide screens only) */}
        <div className="relative my-auto hidden w-full max-w-[34rem] self-center py-12 lg:block" aria-hidden>
          {/* Today */}
          <div className="relative z-20 w-[19rem] rounded-2xl bg-white p-5 text-[#252525] shadow-[0_24px_60px_-20px_rgba(2,30,26,0.55)]">
            <div className="text-sm text-[#737373]">Today</div>
            <div className="font-display text-xl font-semibold tracking-tight">Good morning</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { icon: LogIn, n: 2, label: "Arriving" },
                { icon: LogOut, n: 1, label: "Leaving" },
                { icon: BedDouble, n: "3/4", label: "Rooms" },
              ].map(({ icon: Icon, n, label }) => (
                <div key={label} className="rounded-xl bg-[#f7f5f0] px-2 py-2.5">
                  <Icon className="mx-auto size-4 text-[#0b5d50]" />
                  <div className="tnum mt-1 text-lg leading-none font-semibold">{n}</div>
                  <div className="mt-1 text-[0.6875rem] text-[#737373]">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar strip */}
          <div className="relative z-10 -mt-6 ml-auto w-[26rem] rounded-2xl bg-white p-4 text-[#252525] shadow-[0_24px_60px_-20px_rgba(2,30,26,0.55)]">
            <div className="mb-3 flex items-center justify-end gap-2 text-sm font-medium">
              <CalendarDays className="size-4 text-[#0b5d50]" /> This week
            </div>
            <div className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] gap-y-2 text-[0.6875rem]">
              <span />
              {DAYS.map((d, i) => (
                <span key={d} className={i === 2 ? "text-center font-semibold text-[#0b5d50]" : "text-center text-[#737373]"}>
                  {d}
                </span>
              ))}
              {ROOMS.map((room) => (
                <div key={room.name} className="contents">
                  <span className="truncate pr-2 font-medium text-[#252525]">{room.name}</span>
                  <div className="relative col-span-7 h-6 rounded-md bg-[#f7f5f0]">
                    {room.bars.map((b) => (
                      <span
                        key={b.label}
                        className={`absolute inset-y-0.5 flex items-center truncate rounded-[0.35rem] px-1.5 text-[0.625rem] font-medium ${TONE[b.tone]}`}
                        style={{ left: `calc(${(b.from / 7) * 100}% + 2px)`, width: `calc(${(b.len / 7) * 100}% - 4px)` }}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment received */}
          <div className="relative z-30 -mt-5 ml-8 flex w-[17.5rem] items-center gap-3 rounded-2xl bg-[#0e1a19] px-4 py-3.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#8fd3b4]/15 text-[#8fd3b4]">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Balance paid</div>
              <div className="tnum text-[0.8125rem] text-white/70">LKR 48,500 · Emma Thompson</div>
            </div>
          </div>

          {/* Bill reminder */}
          <div className="relative z-20 -mt-3 ml-auto mr-6 flex w-[15.5rem] items-center gap-3 rounded-2xl bg-[#f8ecda] px-4 py-3 text-[#94601f] shadow-[0_24px_60px_-20px_rgba(2,30,26,0.5)]">
            <Zap className="size-5 shrink-0" />
            <div className="text-[0.8125rem] leading-snug">
              <span className="font-semibold">Electricity bill</span> due in 2 days
            </div>
          </div>
        </div>

        <p className="mt-auto hidden max-w-md text-xl leading-snug text-white/90 lg:block">{tagline}</p>
      </div>
    </div>
  );
}
