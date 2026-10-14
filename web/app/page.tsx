import Link from "next/link";
import { Suspense } from "react";

import { Explorer } from "@/components/explore/Explorer";
import { Term } from "@/components/Term";
import { PageTitle } from "@/components/ui";
import { getMeta, getOverview, hasData } from "@/lib/data";
import { date, num, pct } from "@/lib/format";

export default function Home() {
  if (!hasData()) {
    return (
      <PageTitle title="No data release yet">
        <p>
          Run <code>./tasks.sh data</code> to fetch tender records, check them for warning signs and build this site.
        </p>
      </PageTitle>
    );
  }
  const meta = getMeta();
  const o = getOverview();
  const buyerNames = Object.fromEntries(meta.buyers.map((b) => [b.code, b.name]));
  const detailShare = meta.counts.calls ? meta.counts.calls_with_details / meta.counts.calls : 0;
  const share = o.base_rate.share;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section>
        <p className="text-sm text-muted mb-2">Bengaluru · public works contracts · {date(meta.published_range[0])} to {date(meta.published_range[1])}</p>
        <h1 className="text-3xl sm:text-4xl font-semibold text-ink text-balance max-w-3xl">
          Who gets Bengaluru&apos;s public works contracts, and what looks unusual?
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-2">
          Every road, drain and building repair the city pays for starts as a <Term k="tender">tender</Term> on the Karnataka
          government&apos;s procurement website. We track {num(meta.counts.calls)} of them and check each for the{" "}
          <Term k="risk_indicator">warning signs</Term> that investigators look for when contracts may have been steered.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3 max-w-4xl">
          <Step n={1} title="Explore the patterns" text="Use the charts below. Filter by area, year or type of work; hover for details." />
          <Step n={2} title="Check the warning signs" text="Each one shows exactly what was found, what it was compared with, and the source." />
          <Step n={3} title="Read the innocent explanations" text="Every warning sign lists ordinary reasons it could happen. A warning sign is not proof." />
        </div>
      </section>

      {detailShare < 0.98 && (
        <div role="note" className="rounded-md border border-notice-border bg-notice-bg px-4 py-3 text-sm text-notice-ink">
          <strong>Still collecting data.</strong> So far we have read the full details of {pct(detailShare, detailShare < 0.1 ? 1 : 0)} of the{" "}
          {num(meta.counts.calls)} tenders listed, a few at a time to avoid overloading the government website. The numbers
          below will change as more come in. <Link href="/coverage/" className="underline text-notice-ink">What&apos;s covered so far</Link>
        </div>
      )}

      {/* Warning signs */}
      <section>
        <h2 className="text-2xl font-semibold text-ink">Six warning signs we check every tender for</h2>
        <p className="mt-1 text-ink-2 max-w-3xl">
          {share != null ? (
            <>
              About <strong>{oneIn(share)}</strong> tenders checked so far shows at least one warning sign. That is common, which is
              exactly why a single warning sign means little on its own. Patterns across many tenders, and several signs
              together, matter more.
            </>
          ) : (
            "Warning signs will appear as tender details are collected."
          )}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {o.rules
            .filter((r) => r.enabled)
            .map((r) => (
              <Link key={r.rule_id} href={`/flags/?rule=${r.rule_id}`} className="card p-4 no-underline hover:no-underline hover:border-[var(--accent)] group">
                <div className="text-base font-semibold text-ink group-hover:underline">{r.plain_name}</div>
                <p className="text-sm text-ink-2 mt-1">{r.plain_question}</p>
                <p className="text-xs text-muted mt-2">{r.plain_why}</p>
                <p className="mt-3 text-sm tabular text-ink">
                  {r.evaluated ? (
                    <>
                      <strong>{num(r.flags)}</strong> found
                      <span className="text-muted">
                        {" "}
                        · {num(r.evaluated)} {unit(r.rule_id, r.evaluated)} checked
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">Not enough data yet to check</span>
                  )}
                </p>
              </Link>
            ))}
        </div>
      </section>

      {/* Explorer */}
      <section>
        <h2 className="text-2xl font-semibold text-ink">Explore the contracts</h2>
        <p className="mt-1 mb-4 text-ink-2 max-w-3xl">
          Pick an area, a year or a type of work, and every chart updates. Hover over anything to see the numbers behind it.
        </p>
        <Suspense fallback={<p className="text-muted">Loading the explorer…</p>}>
          <Explorer buyerNames={buyerNames} />
        </Suspense>
      </section>

      <section className="text-sm text-ink-2 max-w-3xl space-y-2">
        <h2 className="text-lg font-semibold text-ink">Where this comes from</h2>
        <p>
          All data comes from the public Karnataka Public Procurement Portal (kppp.karnataka.gov.in): tenders published from
          May 2023 by the former BBMP, the Greater Bengaluru Authority, the five city corporations and related city bodies.
          Contractor names are shown exactly as the portal publishes them.
        </p>
        <p>
          Read <Link href="/patterns/">how tender manipulation works</Link>, the <Link href="/methodology/">exact rules</Link>{" "}
          we apply, or the <Link href="/glossary/">glossary</Link>.
        </p>
      </section>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--series-1)] text-xs font-semibold text-white tabular">{n}</span>
        <span className="font-medium text-ink">{title}</span>
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{text}</p>
    </div>
  );
}

function unit(ruleId: string, n: number): string {
  const one = n === 1;
  if (ruleId === "concentration") return one ? "area" : "areas";
  if (ruleId === "supplier_share") return one ? "contractor record" : "contractor records";
  return one ? "tender" : "tenders";
}

function oneIn(share: number): string {
  if (share <= 0) return "none of the";
  const k = Math.round(1 / share);
  return k <= 1 ? `${Math.round(share * 100)}% of` : `1 in ${k}`;
}
