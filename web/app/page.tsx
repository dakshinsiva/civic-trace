import Link from "next/link";
import { Suspense } from "react";

import { Explorer } from "@/components/explore/Explorer";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { LocalitySearch } from "@/components/LocalitySearch";
import { Term } from "@/components/Term";
import { PageTitle } from "@/components/ui";
import { getMeta, getOverview, hasData } from "@/lib/data";
import { date, num, pct } from "@/lib/format";
import { authorLd, BENGALURU, REPO, SITE_NAME, SITE_URL } from "@/lib/seo";

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
  // Not yet fetched vs. refused by the portal on every attempt: only the first means "still collecting".
  const pending = meta.coverage.reduce((a, c) => a + (c.detail_pending ?? 0), 0);
  const unavailable = meta.coverage.reduce((a, c) => a + c.detail_unavailable, 0);
  const collecting = meta.counts.calls > 0 && pending / meta.counts.calls >= 0.02;
  const share = o.base_rate.share;

  return (
    <div className="space-y-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: `${SITE_URL}/`,
          inLanguage: "en-IN",
          description: "Who gets Bengaluru's public works contracts, what they cost and where the money goes, ward by ward.",
          creator: authorLd,
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/tenders/?q={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "Bengaluru public works tenders (Karnataka Public Procurement Portal)",
          description: `Public works tenders published since May 2023 by BBMP, the Greater Bengaluru Authority, the five Bengaluru city corporations, B-SMILE and BSWML on the Karnataka Public Procurement Portal (KPPP): ${num(meta.counts.calls)} tender calls with estimates, winning bids, winners, number of bidders, deadlines and changes, placed on 369 wards and 28 assembly constituencies, and checked for six warning signs of tender manipulation.`,
          url: `${SITE_URL}/`,
          sameAs: REPO,
          keywords: ["Bengaluru", "Bangalore", "BBMP", "public procurement", "tenders", "public works", "Karnataka", "open data"],
          creator: authorLd,
          isAccessibleForFree: true,
          isBasedOn: "https://kppp.karnataka.gov.in",
          dateModified: meta.generated_at,
          temporalCoverage: `${meta.published_range[0].slice(0, 10)}/${meta.published_range[1].slice(0, 10)}`,
          spatialCoverage: {
            "@type": "Place",
            name: "Bengaluru, Karnataka, India",
            geo: { "@type": "GeoCoordinates", latitude: BENGALURU.lat, longitude: BENGALURU.lon },
          },
          variableMeasured: ["Official estimate", "Winning bid", "Winning contractor", "Number of bidders", "Time given to bid", "Changes after publication", "Warning signs"],
          distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE_URL}/data/tenders-index.json` }],
        }}
      />
      {/* Hero */}
      <section className="relative -mx-4 -mt-8 overflow-hidden px-4 pb-4 pt-12 sm:pt-16">
        <div className="grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <p className="label-mono flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
          <span className="flex items-center gap-2 text-accent">
            <span className="live-dot" aria-hidden />
            Public records
          </span>
          <span>{num(meta.counts.calls)} tenders</span>
          <span className="hidden sm:inline">
            {date(meta.published_range[0])} → {date(meta.published_range[1])}
          </span>
          <span className="hidden md:inline">Updated {date(meta.as_of)}</span>
        </p>
        <h1 className="mt-5 max-w-3xl text-headline-l text-ink text-balance sm:text-display-s">
          Who gets Bengaluru&apos;s public works contracts, and what looks unusual?
        </h1>
        <p className="mt-5 max-w-2xl text-body-l text-ink-2">
          Every road, drain and building repair the city pays for starts as a <Term k="tender">tender</Term> on the Karnataka
          government&apos;s procurement website. We track {num(meta.counts.calls)} of them and check each for the{" "}
          <Term k="risk_indicator">warning signs</Term> that investigators look for when contracts may have been steered.
        </p>
        <div className="mt-8">
          <LocalitySearch />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href="#explore" className="btn-outline">
            <Icon name="map" size={16} />
            Explore the whole city
          </a>
          <Link href="/areas/" className="btn-outline">
            <Icon name="map-pin" size={16} />
            Browse areas and wards
          </Link>
          <Link href="/findings/" className="btn-ghost">
            How widespread is it?
            <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/tenders/" className="btn-ghost">
            Search all tenders
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          <Step n={1} title="Find your area" text="Search a ward or neighbourhood. The map zooms in and every chart below shows that place." />
          <Step n={2} title="See who won the work" text="Contractors, winning prices and how many companies competed, exactly as the portal publishes them." />
          <Step n={3} title="Read warning signs carefully" text="Each comes with its evidence and the ordinary reasons it could happen. A warning sign is not proof." />
        </ol>
      </section>

      {!collecting && unavailable > 0 && (
        <div role="note" className="rounded-lg border border-line px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="label-mono flex items-center gap-2 text-ink-2">
              <Icon name="circle-alert" size={14} />
              Download complete · {pct(detailShare, 0)} read in full
            </span>
            <Link href="/coverage/#unavailable" className="text-body-s">
              Which ones are missing
            </Link>
          </div>
          <p className="mt-2.5 text-body-s text-ink-2">
            We have the full details of {num(meta.counts.calls_with_details)} of the {num(meta.counts.calls)} tenders. For the
            other {num(unavailable)}, the government portal returns an error for the main record every time we ask. Their bidder
            list and award usually loaded, and the figures below use whatever parts did.
          </p>
        </div>
      )}

      {collecting && (
        <div role="note" className="rounded-lg border border-line px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="label-mono flex items-center gap-2 text-notice-ink">
              <Icon name="hourglass" size={14} />
              Still collecting · {pct(detailShare, detailShare < 0.1 ? 1 : 0)} read
            </span>
            <Link href="/coverage/" className="text-body-s">
              What&apos;s covered so far
            </Link>
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-notice-ink" style={{ width: `${Math.max(2, detailShare * 100)}%` }} />
          </div>
          <p className="mt-2.5 text-body-s text-ink-2">
            We read the full details of {num(meta.counts.calls_with_details)} of the {num(meta.counts.calls)} tenders listed so far,
            a few at a time to avoid overloading the government website. The numbers below will change as more come in.
          </p>
        </div>
      )}

      {/* Explorer */}
      <section>
        <p className="label-mono text-accent">Map</p>
        <h2 className="mt-2 text-headline-s text-ink">Explore the map</h2>
        <p className="mt-2 mb-5 text-body-l text-ink-2 max-w-3xl">
          Start with a question below the title, or click any part of the city. The charts further down follow whatever you pick.
        </p>
        <Suspense fallback={<p className="text-muted">Loading the explorer…</p>}>
          <Explorer buyerNames={buyerNames} ruleNames={Object.fromEntries(o.rules.map((r) => [r.rule_id, r.plain_name]))} />
        </Suspense>
      </section>

      {/* Warning signs */}
      <section>
        <p className="label-mono text-accent">Checks</p>
        <h2 className="mt-2 text-headline-s text-ink">Six warning signs we check every tender for</h2>
        <p className="mt-2 text-body-l text-ink-2 max-w-3xl">
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
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {o.rules
            .filter((r) => r.enabled)
            .map((r) => (
              <Link key={r.rule_id} href={`/flags/?rule=${r.rule_id}`} className="card group flex flex-col p-5 text-ink no-underline hover:no-underline">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-body-s text-accent">R{r.number}</span>
                  <Icon name="arrow-up-right" size={16} className="text-muted transition-colors group-hover:text-accent" />
                </div>
                <div className="mt-3 text-title-m text-ink">{r.plain_name}</div>
                <p className="text-body-m text-ink-2 mt-1">{r.plain_question}</p>
                <p className="text-body-s text-muted mt-2 flex-1">{r.plain_why}</p>
                <p className="mt-4 border-t border-line pt-3 font-mono text-body-s tabular text-ink-2">
                  {r.evaluated ? (
                    <>
                      <strong className="font-medium text-ink">{num(r.flags)}</strong> found
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

      <section className="text-body-m text-ink-2 max-w-3xl space-y-2">
        <p className="label-mono text-accent">Source</p>
        <h2 className="text-title-l text-ink">Where this comes from</h2>
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
    <li className="bg-page p-5">
      <span className="font-mono text-body-s text-accent">{String(n).padStart(2, "0")}</span>
      <div className="mt-2 text-title-m text-ink">{title}</div>
      <p className="mt-1 text-body-m text-ink-2">{text}</p>
    </li>
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
