// The CivicTrace mark: a map pin with crosshair ticks, for "look closely at a place".
// The same drawing is in app/icon.svg and public/logo.svg; keep them in step.
const PIN = "M16 29C16 29 8 21 8 13.5A8 8 0 0 1 24 13.5C24 21 16 29 16 29Z";
const TICKS = "M1.5 13.5H5.5M26.5 13.5H30.5";

/** The mark alone. The pin takes the text colour; ticks and dot take the accent. */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" className={`shrink-0 ${className}`} aria-hidden focusable="false">
      <path d={PIN} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d={TICKS} stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />
      <circle cx="16" cy="13.5" r="2.5" fill="var(--accent)" />
    </svg>
  );
}

/** Mark and name, as used in the header. */
export function Logo({ city = "Bengaluru" }: { city?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={28} />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.035em] text-ink">CivicTrace</span>
      {city && <span className="label-mono hidden rounded-sm border border-line px-1.5 py-0.5 text-muted sm:inline lg:hidden xl:inline">{city}</span>}
    </span>
  );
}
