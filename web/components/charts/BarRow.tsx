import type { CSSProperties, ReactNode } from "react";

/**
 * One row of a horizontal bar list. On wide screens: label | bar | value in three columns.
 * On phones the label and value share the first line and the bar takes the full width below,
 * so bars never shrink to a sliver next to fixed-width text.
 */
export function BarRow({ label, value, bar, title, labelWidth = "8rem", valueWidth = "7rem" }: { label: ReactNode; value: ReactNode; bar: ReactNode; title?: string; labelWidth?: string; valueWidth?: string }) {
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[var(--bar-label)_minmax(0,1fr)_var(--bar-value)]"
      style={{ "--bar-label": labelWidth, "--bar-value": valueWidth } as CSSProperties}
      title={title}
    >
      <span className="min-w-0 text-ink-2">{label}</span>
      <span className="tabular text-right text-ink sm:order-3 sm:text-left">{value}</span>
      <span className="col-span-2 sm:order-2 sm:col-span-1">{bar}</span>
    </div>
  );
}
