"use client";

import { Section } from "@/components/ui";
import { useJson } from "@/lib/useJson";

type Group = { n: number; price_n: number; price: number[] | null; bidders_n: number; one: number | null; low: number | null; window_n: number; window: number[] | null };
type Peers = { bands: [number, number | null, string][]; min: number; pcts: number[]; groups: Record<string, Group> };

const BAND_LABEL: Record<string, string> = {
  lt10l: "under ₹10 lakh",
  "10l-50l": "₹10–50 lakh",
  "50l-1cr": "₹50 lakh–1 crore",
  "1-5cr": "₹1–5 crore",
  "5cr+": "over ₹5 crore",
};

/** The most specific group of similar tenders that has enough of them for this figure. */
function pick(p: Peers, category: string, band: string, type: string, has: (g: Group) => boolean) {
  const kind = type === "OPEN" ? "open tenders" : type === "RESERVED" ? "reserved tenders" : "tenders";
  const options: [string, string][] = [
    [`${category}|${band}|${type}`, `${category} ${kind}, ${BAND_LABEL[band]}`],
    [`${category}|${band}|*`, `${category} tenders, ${BAND_LABEL[band]}`],
    [`*|${band}|${type}`, `${kind} of every type of work, ${BAND_LABEL[band]}`],
    [`*|${band}|*`, `tenders of every type of work, ${BAND_LABEL[band]}`],
  ];
  for (const [key, label] of options) {
    const g = p.groups[key];
    if (g && has(g)) return { g, label };
  }
  return null;
}

/** Estimated % of similar tenders with a value below `v`, from the 5th…95th percentiles. */
function shareBelow(v: number, q: number[], levels: number[]): number {
  if (v <= q[0]) return Math.min(levels[0], v < q[0] ? 2 : levels[0]);
  if (v >= q[q.length - 1]) return Math.max(levels[levels.length - 1], v > q[q.length - 1] ? 98 : levels[levels.length - 1]);
  for (let i = 1; i < q.length; i++) {
    if (v <= q[i]) {
      const f = q[i] === q[i - 1] ? 0.5 : (v - q[i - 1]) / (q[i] - q[i - 1]);
      return levels[i - 1] + f * (levels[i] - levels[i - 1]);
    }
  }
  return 98;
}

function share(x: number): string {
  if (x < 5) return "fewer than 5%";
  if (x > 95) return "more than 95%";
  return `about ${Math.round(x / 5) * 5}%`;
}

const vsEst = (d: number) => {
  const r = Math.round(Math.abs(d));
  return r === 0 ? "right at the estimate" : `${r}% ${d < 0 ? "below" : "above"} the estimate`;
};

/** Where one tender sits among similar ones: 5th–95th range, middle half, the median, and this tender. */
function Strip({ q, levels, value, fmt }: { q: number[]; levels: number[]; value: number; fmt: (v: number) => string }) {
  const at = (p: number) => q[levels.indexOf(p)];
  const lo = Math.min(at(5), value), hi = Math.max(at(95), value);
  const pad = (hi - lo) * 0.04 || 1;
  const x = (v: number) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  return (
    <div className="mt-3" aria-hidden>
      <div className="relative h-5">
        <div className="absolute top-1/2 h-px w-full bg-line" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--axis)]" style={{ left: `${x(at(5))}%`, width: `${x(at(95)) - x(at(5))}%` }} />
        <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-series-1 opacity-60" style={{ left: `${x(at(25))}%`, width: `${Math.max(0.5, x(at(75)) - x(at(25)))}%` }} />
        <div className="absolute top-0 h-5 w-0.5 bg-ink" style={{ left: `${x(at(50))}%` }} />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-series-2" style={{ left: `${x(value)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted tabular">
        <span>{fmt(at(5))}</span>
        <span className="text-ink-2">typical: {fmt(at(50))}</span>
        <span>{fmt(at(95))}</span>
      </div>
    </div>
  );
}

/** "How does this tender compare?" — this tender against similar ones (same type of work, size of job, open or reserved). */
export function TenderCompare({ category, tenderType, ecv, bid, bidders, windowDays }: { category: string; tenderType: string; ecv: number | null; bid: number | null; bidders: number | null; windowDays: number | null }) {
  const { data: p } = useJson<Peers>("peers.json");
  if (!p || !ecv || ecv <= 0) return null;
  const band = p.bands.find(([lo, hi]) => ecv >= lo && (hi == null || ecv < hi))?.[2];
  if (!band) return null;
  const cat = category || "—";
  const priceNow = bid && bid > 0 ? (bid / ecv - 1) * 100 : null;
  const priceGroup = priceNow != null ? pick(p, cat, band, tenderType, (g) => g.price != null) : null;
  const bidGroup = bidders != null ? pick(p, cat, band, tenderType, (g) => g.low != null) : null;
  const winGroup = windowDays != null ? pick(p, cat, band, tenderType, (g) => g.window != null) : null;
  if (!priceGroup && !bidGroup && !winGroup) return null;

  return (
    <Section title="How does this tender compare?">
      <div className="grid gap-6 lg:grid-cols-3">
        {priceGroup && priceNow != null && (
          <div>
            <h3 className="label-mono text-muted">Winning price</h3>
            <p className="mt-2 text-body-m text-ink">
              This one was <strong className="font-medium">{vsEst(priceNow)}</strong>. Among {priceGroup.g.price_n.toLocaleString("en-IN")} similar
              contracts ({priceGroup.label}), the typical price was {vsEst(priceGroup.g.price![9])}, and {share(shareBelow(priceNow, priceGroup.g.price!, p.pcts))} were
              priced lower than this one.
            </p>
            <Strip q={priceGroup.g.price!} levels={p.pcts} value={priceNow} fmt={(v) => `${v > 0 ? "+" : ""}${Math.round(v)}%`} />
          </div>
        )}
        {bidGroup && bidders != null && (
          <div>
            <h3 className="label-mono text-muted">Competition</h3>
            <p className="mt-2 text-body-m text-ink">
              <strong className="font-medium">
                {bidders === 1 ? "Only one company" : `${bidders} companies`}
              </strong>{" "}
              competed on price. Among {bidGroup.g.bidders_n.toLocaleString("en-IN")} similar contracts ({bidGroup.label}),{" "}
              {Math.round(bidGroup.g.low! * 100)}% had two or fewer and {Math.round(bidGroup.g.one! * 100)}% only one.
            </p>
            <div className="mt-3 flex h-3 gap-[2px]" aria-hidden>
              <span className="rounded-l-sm bg-series-2" style={{ width: `${bidGroup.g.one! * 100}%` }} />
              <span className="bg-series-1" style={{ width: `${(bidGroup.g.low! - bidGroup.g.one!) * 100}%` }} />
              <span className="rounded-r-sm bg-series-3" style={{ width: `${(1 - bidGroup.g.low!) * 100}%` }} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
              <span className={bidders <= 1 ? "font-medium text-ink" : undefined}>1 company</span>
              <span className={bidders === 2 ? "font-medium text-ink" : undefined}>2 companies</span>
              <span className={bidders >= 3 ? "font-medium text-ink" : undefined}>3 or more</span>
            </div>
          </div>
        )}
        {winGroup && windowDays != null && (
          <div>
            <h3 className="label-mono text-muted">Time to bid</h3>
            <p className="mt-2 text-body-m text-ink">
              This one gave <strong className="font-medium">{Math.round(windowDays)} days</strong>. Similar tenders ({winGroup.label}) typically gave{" "}
              {Math.round(winGroup.g.window![9])} days, and {share(shareBelow(windowDays, winGroup.g.window!, p.pcts))} gave less time than this one.
            </p>
            <Strip q={winGroup.g.window!} levels={p.pcts} value={windowDays} fmt={(v) => `${Math.round(v)} days`} />
          </div>
        )}
      </div>
      <p className="mt-5 text-body-s text-muted">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-series-2" /> this tender
        </span>
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-ink" /> typical (median)
        </span>
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-series-1 opacity-60" /> middle half
        </span>
        Similar means the same type of work, a similar size of job and the same kind of tender, falling back to broader groups when
        there are too few. Standing out is a reason to look closer, not proof of anything.
      </p>
    </Section>
  );
}
