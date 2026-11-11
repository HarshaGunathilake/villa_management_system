import { cn } from "@/lib/utils";

/*
 * The LankaStay logo: the island of Sri Lanka with a villa roof and door inside.
 * The favicon uses a smoother outline, without the house, so it still reads at 16 px.
 * The same drawing is used for the favicon (app/icon.svg).
 */

/** Traced from the island's outline; ISLAND_SIMPLE is the smoother one for very small sizes. */
const ISLAND = "M16.4 6.1 L15.8 6.6 L15.8 6.7 L16.0 6.9 L16.1 7.2 L16.2 7.3 L16.2 7.2 L17.3 7.8 L17.4 8.0 L17.4 8.1 L17.2 8.3 L17.6 8.6 L17.9 8.7 L18.4 9.1 L18.4 9.4 L18.1 9.5 L17.9 9.8 L17.5 9.9 L17.1 10.1 L17.2 10.6 L17.7 11.0 L17.6 11.9 L17.3 12.5 L17.3 13.0 L17.0 13.6 L16.2 14.3 L15.9 14.4 L15.9 14.6 L15.9 15.7 L16.2 16.1 L16.2 16.5 L15.9 17.6 L15.4 18.2 L15.4 18.4 L15.4 18.7 L15.2 19.1 L15.1 20.3 L14.8 20.8 L15.0 21.9 L14.8 22.2 L14.7 22.5 L15.0 22.8 L15.1 23.1 L14.8 23.3 L14.5 23.3 L14.1 23.1 L14.2 22.6 L14.0 22.3 L14.0 22.1 L14.1 21.8 L14.1 21.3 L14.3 21.1 L14.4 20.8 L14.2 20.5 L14.1 20.8 L13.8 21.1 L13.9 21.4 L13.8 22.4 L14.0 23.1 L14.5 25.0 L14.6 26.0 L14.8 26.3 L14.7 26.8 L14.5 26.9 L14.7 27.3 L14.7 27.8 L14.8 27.9 L14.9 29.4 L15.1 29.9 L15.1 30.4 L15.0 30.5 L15.1 30.8 L14.9 30.8 L15.4 32.4 L15.2 32.8 L15.2 33.7 L15.6 35.0 L16.2 36.5 L16.4 37.1 L16.3 37.5 L16.5 37.6 L16.5 37.8 L16.8 38.5 L16.9 39.4 L17.0 39.5 L17.5 40.6 L18.4 41.5 L18.7 41.5 L19.8 42.0 L19.9 42.0 L20.4 42.2 L20.7 42.1 L20.9 42.3 L21.8 42.3 L22.0 42.5 L22.2 42.5 L22.6 42.2 L23.3 42.1 L23.8 41.6 L24.3 41.4 L24.6 41.4 L25.1 41.1 L25.7 41.0 L25.9 40.9 L26.8 40.7 L27.8 40.2 L27.9 40.3 L29.0 39.8 L30.8 38.4 L31.7 38.0 L32.3 37.4 L33.2 36.0 L33.2 35.6 L33.5 35.1 L33.7 34.0 L34.1 32.7 L34.0 29.4 L33.7 28.3 L33.5 28.1 L33.5 27.7 L33.4 26.9 L33.2 26.7 L32.9 25.9 L32.4 25.6 L31.8 24.7 L31.7 24.8 L31.3 24.5 L31.2 24.4 L31.3 23.9 L31.1 23.6 L31.1 23.2 L30.6 23.0 L30.2 22.2 L30.0 22.0 L30.0 21.7 L29.6 20.4 L29.6 20.1 L29.3 19.9 L29.5 19.5 L29.3 18.6 L29.0 18.4 L28.7 18.4 L28.7 18.7 L28.5 18.9 L28.0 18.9 L27.7 18.6 L27.7 18.4 L27.9 18.3 L27.9 18.2 L28.2 18.0 L28.2 17.8 L28.0 17.5 L28.0 17.0 L27.7 16.7 L27.7 16.6 L27.4 16.4 L27.3 16.0 L26.9 15.7 L26.8 15.2 L26.2 14.9 L25.7 14.1 L25.4 14.4 L25.2 14.2 L25.1 13.9 L25.4 13.6 L25.0 13.1 L24.9 12.7 L24.6 12.5 L24.6 12.4 L24.7 12.3 L24.3 11.5 L24.3 11.3 L24.2 11.3 L23.9 11.4 L23.7 11.3 L23.7 11.1 L24.0 11.0 L23.0 10.0 L21.7 8.9 L20.6 8.2 L19.1 6.6 L19.0 6.1 L18.8 6.0 L18.1 6.0 L17.9 6.2 L17.6 6.1 L17.3 6.2Z";
/** The detailed outline, for large drawings. */
export const ISLAND_OUTLINE = ISLAND;
export const ISLAND_SIMPLE = "M16.4 6.1 L15.3 6.7 L15.1 7.2 L15.4 7.8 L16.9 8.0 L18.1 9.1 L18.1 9.5 L17.1 10.1 L17.2 10.6 L17.7 11.2 L17.2 13.3 L16.7 13.9 L16.2 13.9 L15.1 13.1 L13.8 12.9 L14.6 13.2 L15.8 14.2 L16.2 16.1 L16.0 17.4 L15.4 18.2 L15.1 19.7 L14.8 20.2 L14.3 20.2 L13.8 21.1 L13.8 22.4 L14.8 26.3 L14.5 26.9 L15.1 29.9 L14.9 31.0 L15.3 32.1 L15.2 33.7 L16.2 36.5 L16.9 39.4 L17.5 40.6 L18.4 41.5 L19.8 42.0 L22.2 42.5 L23.2 42.2 L24.8 41.2 L26.8 40.7 L29.0 39.8 L32.3 37.4 L33.2 36.0 L34.1 32.7 L34.0 29.4 L32.9 25.9 L31.3 24.4 L31.1 23.2 L30.4 22.8 L30.0 21.9 L29.3 18.6 L28.2 18.0 L28.0 17.0 L25.0 13.1 L24.3 11.3 L23.0 10.0 L20.6 8.2 L19.0 6.1Z";
const ROOF = "M19.5 29.2 24.3 25.2l4.8 4";
const DOOR = "M21.4 28.6v4.6h5.8v-4.6";

/**
 * tile: the green rounded square with the white island (on light backgrounds).
 * bare: just the white island, the roof in `roof` colour (on green or dark backgrounds).
 */
export function BrandMark({ variant = "tile", roof = "#0b5d50", className, label }: { variant?: "tile" | "bare"; roof?: string; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-8 shrink-0", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {variant === "tile" ? <rect width="48" height="48" rx="13" fill="#0b5d50" /> : null}
      <path d={ISLAND} fill="#fff" stroke="#fff" strokeWidth="0.4" strokeLinejoin="round" />
      <g fill="none" stroke={variant === "tile" ? "#0b5d50" : roof} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={ROOF} />
        <path d={DOOR} />
      </g>
    </svg>
  );
}

/** The platform name, set as "Lanka" bold and "Stay" in the accent when it is LankaStay; any other name is shown as it is. */
export function Wordmark({ name, className, accentClassName = "text-[#0b5d50]" }: { name: string; className?: string; accentClassName?: string }) {
  const split = /^lankastay$/i.test(name.trim());
  return (
    <span className={cn("font-display tracking-[-0.035em]", className)}>
      {split ? (
        <>
          <span className="font-bold">Lanka</span>
          <span className={cn("font-medium", accentClassName)}>Stay</span>
        </>
      ) : (
        <span className="font-bold">{name}</span>
      )}
    </span>
  );
}
