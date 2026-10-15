import Link from "next/link";

import { Term } from "@/components/Term";
import { PageTitle } from "@/components/ui";
import { getFindings, getMeta, type Stat } from "@/lib/data";
import { date, inr, num } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "How common are the warning signs in Bengaluru's tenders?",
  description:
    "How common are warning signs in Bengaluru's public works tenders? Single-bidder contracts, prices at the estimate, short deadlines and more, with 95% ranges, from public KPPP records.",
  path: "/findings/",
});

const pct = (x: number | null | undefined, d = 0) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const ci = (s: Stat) => (s.ci95 ? `${pct(s.ci95[0])}–${pct(s.ci95[1])}` : "—");
function inWords(x: number | null): string {
  if (x == null) return "—";
  if (x >= 0.73) return "about 3 in 4";
  if (x >= 0.68) return "about 7 in 10";
  if (x >= 0.6) return "about 2 in 3";
  if (x >= 0.45) return "about half";
  if (x >= 0.3) return "about 1 in 3";
  if (x >= 0.22) return "about 1 in 4";
  if (x >= 0.18) return "about 1 in 5";
  if (x >= 0.14) return "about 1 in 6";
  if (x >= 0.11) return "about 1 in 8";
  if (x >= 0.08) return "about 1 in 10";
  if (x >= 0.06) return "about 1 in 15";
  if (x >= 0.04) return "about 1 in 20";
  return "very few";
}
const vs = (d: number | null) => (d == null ? "—" : Math.abs(d) < 0.5 ? "right at the estimate" : `${Math.abs(d).toFixed(1)}% ${d < 0 ? "below" : "above"} the estimate`);

export default function FindingsPage() {
  const f = getFindings();
  const meta = getMeta();
  if (!f) return <PageTitle title="Findings are not available in this release" />;
  const lowComp = f.single_bidder.n ? (f.single_bidder.k + f.two_bidders.k) / f.single_bidder.n : null;
  const b = f.median_price_vs_estimate_by_bidders;
  const st = f.status_all_listed;
  const chosen = st.awarded + st.evaluation_completed_no_award;
  const noAward = chosen ? st.evaluation_completed_no_award / chosen : null;
  const cancelled = st.listed ? (st.recalled + st.retendered) / st.listed : null;
  const rushedRare = (f.window_under_7_days.share ?? 1) < 0.05;
  const changedRare = (f.changed_3_plus_times.share ?? 1) < 0.05;
  const competitionEffect = b.three_plus != null && b.two != null ? b.two - b.three_plus : null;
  const screens = f.bid_screens;
  // Still downloading (tenders not yet tried) vs. done, with only the portal's refusals missing.
  const stillReading =
    f.coverage.pending_calls != null
      ? f.coverage.pending_calls / f.coverage.listed_calls >= 0.02
      : (f.coverage.fetched_share ?? 0) < 0.98;

  return (
    <div className="space-y-10">
      <PageTitle eyebrow="Findings · updated with every data release" title="How common are the warning signs in Bengaluru's tenders?">
        <p className="text-lg">
          No public record can tell us how much corruption there is. What records <em>can</em> show is how often the patterns
          investigators associate with it appear. Here is what {num(f.coverage.fetched_calls)} tenders show
          {stillReading ? " so far" : ""}.
        </p>
      </PageTitle>

      {stillReading && (
        <div role="note" className="rounded-md border border-notice-border bg-notice-bg px-4 py-3 text-sm text-notice-ink">
          <strong>Based on a sample.</strong> {num(f.coverage.fetched_calls)} of {num(f.coverage.listed_calls)} tenders (
          {pct(f.coverage.fetched_share, 1)}) have been downloaded so far. They are read month by month in a random order,
          so they work like a random sample: each figure below comes with a <strong>95% range</strong>, the span the true
          figure very likely falls in. The ranges narrow as more tenders are read.
        </div>
      )}
      {(f.coverage.unavailable_calls ?? 0) > 0 && (
        <p className="text-sm text-ink-2">
          For {num(f.coverage.unavailable_calls ?? 0)} of these tenders ({pct((f.coverage.unavailable_calls ?? 0) / f.coverage.listed_calls, 1)}),
          the government portal returned an error for the main record, including on later retries, though their bidder list
          and award usually loaded. Each figure below counts a tender only when it has the details that figure needs.{" "}
          <Link href="/coverage/#unavailable">See which ones</Link>.
        </p>
      )}

      {/* The verdict */}
      <section className="card p-6 border-l-4 border-l-[var(--series-2)]">
        <h2 className="text-title-l text-ink">What the records say, in short</h2>
        <div className="mt-3 space-y-3 text-base text-ink leading-relaxed max-w-3xl">
          <p>
            <strong>The clearest pattern is weak competition.</strong> In {inWords(lowComp)} contracts ({pct(lowComp)}), two
            or fewer companies competed on price, and in {inWords(f.single_bidder.share)} ({pct(f.single_bidder.share)},
            range {ci(f.single_bidder)}) only one did.
          </p>
          {b.two != null && b.three_plus != null && (
            <p>
              <strong>When competition is thin, prices stick to the government&apos;s own estimate.</strong> With one bidder
              the typical winning price was {vs(b.one)}; with two, {vs(b.two)}. When three or more companies competed, it was{" "}
              {vs(b.three_plus)}
              {competitionEffect != null && competitionEffect > 3 ? `, a difference of about ${competitionEffect.toFixed(0)} percentage points` : ""}.
            </p>
          )}
          {screens && screens.same_loser_pairs > 2 * screens.same_loser_expected && (
            <p>
              <strong>Patterns specific to bid-rigging show up in a smaller share.</strong> In {pct(screens.met_min.share)} of
              contracts with two bidders, the same two firms had faced each other at least {screens.min_meetings} times. In{" "}
              {pct(screens.same_loser_tenders.share, 1)}, one of those firms had lost every single time, which chance alone
              would rarely produce. <a href="#bid-rigging">How this is checked</a>.
            </p>
          )}
          <p>
            {rushedRare && changedRare ? (
              <>
                <strong>The blunt tricks are rare.</strong> Very short deadlines ({pct(f.window_under_7_days.share, 1)} of
                tenders) and tenders changed again and again ({pct(f.changed_3_plus_times.share, 1)}) almost never appear.
              </>
            ) : (
              <>
                Short deadlines appear in {pct(f.window_under_7_days.share, 1)} of tenders, and repeated changes in{" "}
                {pct(f.changed_3_plus_times.share, 1)}.
              </>
            )}
          </p>
          <p>
            <strong>The paper trail is incomplete.</strong> For {pct(noAward)} of the {num(chosen)} contracts where a winner was
            chosen, the portal has not recorded an award (some may simply not be updated yet), and {pct(cancelled)} of all tender calls were cancelled or advertised
            again.
          </p>
          <p className="text-ink-2">
            Put together: these are the marks of a market where contractors mostly don&apos;t compete on price. That can come
            from collusion, such as companies agreeing who wins and others bidding just to make it look competitive. It can
            come from work being informally shared out. Or it can come from simple facts: thin local markets, small jobs that
            few firms want, and bidders quoting the government&apos;s published rates. <strong>The records cannot tell these
            apart.</strong> They show where to look, not who did what.
          </p>
        </div>
      </section>

      {/* The numbers */}
      <section>
        <h2 className="text-headline-s text-ink">The numbers behind it</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Big label="Only one company competed" stat={f.single_bidder} note="Open contracts with a winner and a published bidder count. EU benchmark: above 20% is poor." />
          <Big label="Exactly two companies competed" stat={f.two_bidders} note="The most common situation. Two bids can satisfy the rules while still not being real competition." />
          <Big label="Winning price within 1% of the estimate" stat={f.price_within_1pct_of_estimate} note="Contracts with both an estimate and a winning price." />
          <Big label="Winning price more than 5% above the estimate" stat={f.price_over_5pct_above_estimate} note="Overpaying relative to the government's own calculation." />
          <Big label="Less than a week to bid" stat={f.window_under_7_days} note={`Typical time given: ${f.median_window_days ?? "—"} days.`} />
          <Big label="At least one warning sign" stat={f.any_warning_sign} note="Any tender-level warning sign. Most have innocent explanations." />
        </div>
      </section>

      {/* Competition chart */}
      <section className="card p-5">
        <h2 className="text-title-l text-ink">Does competition change the price?</h2>
        <p className="text-sm text-ink-2 mt-1">
          Typical winning price compared with the government&apos;s <Term k="estimate">official estimate</Term>, by how many
          companies competed.
        </p>
        <CompetitionBars rows={[
          { label: "1 company", v: b.one, n: b.n_one, color: "var(--series-2)" },
          { label: "2 companies", v: b.two, n: b.n_two, color: "var(--series-1)" },
          { label: "3 or more", v: b.three_plus, n: b.n_three_plus, color: "var(--series-3)" },
        ]} />
        {f.price_vs_estimate_by_category.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-medium text-ink">Same comparison within each type of work</h3>
            <p className="text-xs text-muted">This rules out the simplest explanation: that bigger or different kinds of job attract more bidders.</p>
            <table className="data mt-2 max-w-2xl">
              <thead>
                <tr>
                  <th>Type of work</th>
                  <th className="num">1–2 companies</th>
                  <th className="num">3 or more</th>
                </tr>
              </thead>
              <tbody>
                {f.price_vs_estimate_by_category.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td className="num">{vs(c.low_competition)} <span className="text-muted">(n={c.n_low})</span></td>
                    <td className="num">{vs(c.three_plus)} <span className="text-muted">(n={c.n_three_plus})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {f.competition_gap.share != null && f.competition_gap.amount > 0 && (
          <div className="mt-5 rounded-md bg-surface-2 p-4 text-sm">
            <p className="text-ink">
              <strong>What competition might have been worth:</strong> had the {inr(f.competition_gap.of_value)} of low-competition
              contracts in this sample been priced like comparable contracts with three or more bidders, they would have cost
              about <strong>{inr(f.competition_gap.amount)}</strong> less ({pct(f.competition_gap.share, 1)}).
            </p>
            <p className="text-xs text-muted mt-1">
              This is an illustration, not a measure of loss or of corruption. Contracts that attract more bidders may differ
              in ways the records don&apos;t capture, and very low prices carry their own risks for the quality of work.
            </p>
          </div>
        )}
      </section>

      {screens && screens.two_bidder_tenders > 0 && (
        <section id="bid-rigging" className="card p-5 scroll-mt-24">
          <h2 className="text-title-l text-ink">Signs of bid-rigging</h2>
          <p className="text-sm text-ink-2 mt-1 max-w-3xl">
            Two checks that competition authorities use to spot rigged tenders, from the OECD&apos;s guidelines on bid rigging,
            run on the {num(screens.two_bidder_tenders)} open tenders where exactly two companies bid. These are totals only;
            no firm is named here.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Big
              label={`The same two firms, ${screens.min_meetings} or more times`}
              stat={screens.met_min}
              note={`The two bidders had faced each other in at least ${screens.min_meetings} tenders (${num(screens.regular_pairs)} pairs). Firms taking turns to win look like this. So does an area where only two firms do this kind of work.`}
            />
            <Big
              label="One firm lost to the same rival every time"
              stat={screens.same_loser_tenders}
              note={`In ${num(screens.same_loser_pairs)} of those ${num(screens.regular_pairs)} pairs, one firm lost every meeting. If each contest were a coin flip, about ${screens.same_loser_expected} pairs would. A firm that bids only to lose (a "cover bid") looks like this. So does a rival that is simply always cheaper.`}
            />
            <Big
              label="Losing bid within 1% of the winner"
              stat={screens.runner_up_gap.two.within_1pct}
              note={`Typical gap between the two bids: ${screens.runner_up_gap.two.median_pct ?? "—"}% (with three or more bidders: ${screens.runner_up_gap.three_plus.median_pct ?? "—"}%). Cover bids sit just above the winner. So do honest bids when both firms quote close to the government's published rates.`}
            />
          </div>
          <p className="text-xs text-muted mt-3 max-w-3xl">
            Bidders are matched by the name the portal prints, since it publishes no company numbers. A firm spelled two ways
            counts as two firms, which generally makes these checks find less, not more. Related firms bidding under different names
            can&apos;t be seen at all.
          </p>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-title-l text-ink">Where to look next</h2>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <Link href="/#explore">The map</Link>: which areas show thin competition, prices at the estimate, or a few contractors
              winning most of the work.
            </li>
            <li>
              <Link href="/flags/">Every warning sign</Link>, with its evidence and innocent explanations.
            </li>
            <li>
              <Link href="/patterns/">How manipulation works</Link>, and what each pattern can and cannot reveal.
            </li>
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="text-title-l text-ink">What would change this picture</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-ink-2">
            <li>The names of bidders rejected at the document check, which the portal doesn&apos;t publish.</li>
            <li>Company registration numbers, which would show when several &ldquo;competitors&rdquo; are related firms.</li>
            <li>Bills and payments, to compare what was paid with what was agreed.</li>
            <li>Audit reports on specific works.</li>
          </ul>
        </div>
      </section>

      <p className="text-xs text-muted">
        Data release {meta.data_version}, records observed up to {date(meta.as_of)}. Ranges are 95% Wilson intervals. Source:
        Karnataka Public Procurement Portal. <Link href="/methodology/">How we check</Link>.
      </p>
    </div>
  );
}

function Big({ label, stat, note }: { label: string; stat: Stat; note: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-headline-l text-ink">{pct(stat.share, 0)}</span>
        <span className="text-sm text-muted">{inWords(stat.share)}</span>
      </div>
      <div className="text-xs text-muted mt-1 tabular">
        95% range {ci(stat)} · {num(stat.k)} of {num(stat.n)}
      </div>
      <p className="text-xs text-ink-2 mt-2">{note}</p>
    </div>
  );
}

function CompetitionBars({ rows }: { rows: { label: string; v: number | null; n: number; color: string }[] }) {
  const max = Math.max(5, ...rows.map((r) => Math.abs(r.v ?? 0)));
  const W = 640, row = 44, P = { l: 110, r: 120 };
  const mid = P.l + (W - P.l - P.r) / 2;
  const scale = (W - P.l - P.r) / 2 / max;
  return (
    <div className="mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${rows.length * row + 30}`} className="w-full max-w-3xl h-auto min-w-[34rem]" role="img" aria-label="Typical winning price versus estimate by number of competing companies">
        <line x1={mid} x2={mid} y1={0} y2={rows.length * row} stroke="var(--ink-2)" strokeWidth={1.5} />
        <text x={mid - 8} y={rows.length * row + 18} textAnchor="end" fontSize={11} fill="var(--muted)">
          ← cheaper than the estimate
        </text>
        <text x={mid + 8} y={rows.length * row + 18} fontSize={11} fill="var(--muted)">
          dearer than the estimate →
        </text>
        {rows.map((r, i) => {
          const v = r.v ?? 0;
          const w = Math.max(2, Math.abs(v) * scale);
          const x = v < 0 ? mid - w : mid;
          const y = i * row + 8;
          return (
            <g key={r.label}>
              <text x={P.l - 10} y={y + 17} textAnchor="end" fontSize={13} fill="var(--ink)">
                {r.label}
              </text>
              <rect x={x} y={y} width={w} height={24} rx={4} fill={r.color} />
              {/* Values for bars that run left sit on the free side of the zero line, clear of the row labels. */}
              <text x={v < 0 ? mid + 6 : x + w + 6} y={y + 17} fontSize={12} fill="var(--ink)" className="tabular">
                {r.v == null ? "—" : `${r.v > 0 ? "+" : ""}${r.v.toFixed(1)}%`} <tspan fill="var(--muted)">(n={r.n})</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
