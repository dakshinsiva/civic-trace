// Indian number formatting: ₹ with lakh/crore units.

export function inr(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const compact = opts.compact ?? true;
  if (compact) {
    if (Math.abs(v) >= 1e7) return `₹${trim(v / 1e7)} cr`;
    if (Math.abs(v) >= 1e5) return `₹${trim(v / 1e5)} lakh`;
  }
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function trim(n: number): string {
  return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function rate(n: number, d: number): string {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}% (${n.toLocaleString("en-IN")} of ${d.toLocaleString("en-IN")})`;
}

export function date(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function datetime(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "Published",
  CLOSED: "Closed",
  UNDER_EVALUATION: "Under evaluation",
  EVALUATION_SUSPENDED: "Evaluation suspended",
  EVALUATION_COMPLETED: "Evaluation completed",
  AWARDED: "Awarded",
  NO_BIDS_RECIEVED: "No bids received",
  RECALLED: "Cancelled (recalled)",
  RETENDERED: "Retendered",
  FINALIZED: "Finalized",
};

export function statusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return STATUS_LABELS[s] ?? s;
}

export function selectionLabel(l: string | null | undefined): string {
  if (l === "awarded") return "Awarded";
  if (l === "selected_no_award") return "Selected (no award recorded on portal)";
  return "—";
}

export function humanKey(k: string): string {
  return k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
