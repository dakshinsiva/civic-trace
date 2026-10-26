import Link from "next/link";

import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { MapLink } from "@/components/map/MapLink";
import { PlaceMap } from "@/components/map/PlaceMap";
import { ShareBar } from "@/components/ShareBar";
import { Section, Stat } from "@/components/ui";
import { inr, num } from "@/lib/format";
import type { Place } from "@/lib/placeData";
import { SITE_URL } from "@/lib/seo";

const pct = (k: number, n: number) => (n ? `${Math.round((k / n) * 100)}%` : "—");

function vsEstimate(m: number | null): string {
  if (m == null) return "—";
  if (Math.abs(m) < 0.005) return "At the estimate";
  return `${Math.abs(m * 100).toFixed(1)}% ${m < 0 ? "below" : "above"}`;
}

/** Overview of one constituency area or ward: numbers, map, who wins, recent contracts and neighbours. */
export function PlaceOverview({ p }: { p: Place }) {
  const s = p.stat;
  const isWard = p.kind === "ward";
  const mapHref = isWard ? `/?level=wards&ward=${encodeURIComponent(p.id)}&area=${p.area.acNo}&dots=1` : `/?level=areas&area=${p.id}&dots=1`;
  const maxWins = p.topContractors[0]?.wins || 1;

  const url = isWard ? `${SITE_URL}/wards/${p.slug}/` : `${SITE_URL}${p.area.href}`;
  const crumbs = [
    { name: "Bengaluru", url: `${SITE_URL}/areas/` },
    ...(isWard ? [{ name: p.area.name, url: `${SITE_URL}${p.area.href}` }] : []),
    { name: p.name, url },
  ];

  return (
    <div className="space-y-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": isWard ? "Place" : "AdministrativeArea",
          name: isWard ? `${p.name} ward, Bengaluru` : `${p.name} constituency, Bengaluru`,
          ...(p.nameKn ? { alternateName: p.nameKn } : {}),
          url,
          description: s
            ? `${s.tenders} public works tenders and ${inr(s.spend)} in winning bids since May 2023.`
            : `Public works contracts in ${p.name}, Bengaluru.`,
          geo: { "@type": "GeoCoordinates", latitude: Number(p.lat.toFixed(5)), longitude: Number(p.lon.toFixed(5)) },
          address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressRegion: "Karnataka", addressCountry: "IN" },
          containedInPlace: isWard
            ? { "@type": "AdministrativeArea", name: `${p.area.name} constituency`, url: `${SITE_URL}${p.area.href}` }
            : { "@type": "City", name: "Bengaluru", sameAs: "https://en.wikipedia.org/wiki/Bengaluru" },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
        }}
      />
      <nav aria-label="Breadcrumb" className="label-mono flex flex-wrap items-center gap-2 text-muted">
        <Link href="/areas/" className="text-muted">
          Bengaluru
        </Link>
        <Icon name="chevron-right" size={12} />
        {isWard && (
          <>
            <Link href={p.area.href} className="text-muted">
              {p.area.name}
            </Link>
            <Icon name="chevron-right" size={12} />
          </>
        )}
        <span className="text-ink">{p.name}</span>
      </nav>

      <header>
        <p className="label-mono text-accent">{isWard ? `Ward · ${p.area.name} constituency` : "Constituency area"}</p>
        <h1 className="mt-2 text-headline-l text-ink text-balance">
          {p.name}
          {p.nameKn && <span className="ml-3 text-headline-s text-ink-2">{p.nameKn}</span>}
        </h1>
        <p className="mt-3 max-w-3xl text-body-l text-ink-2">
          {s ? (
            <>
              Public works contracts {isWard ? "that name this ward" : "issued for this area"} since May 2023:{" "}
              <strong className="font-medium text-ink">{num(s.tenders)} tenders</strong> and{" "}
              <strong className="font-medium text-ink">{inr(s.spend)}</strong> in winning bids.{" "}
            </>
          ) : null}
          {p.corporations.join(", ")} {p.corporations.length > 1 ? "corporations" : "corporation"}
          {p.population ? ` · ${num(p.population)} residents (2011 census)` : ""}.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <MapLink href={mapHref} className="btn-primary">
            <Icon name="map" size={16} />
            Open on the city map
          </MapLink>
          {isWard && (
            <Link href={p.area.href} className="btn-outline">
              <Icon name="landmark" size={16} />
              {p.area.name} constituency
            </Link>
          )}
          <Link href="/areas/" className="btn-ghost">
            All areas and wards
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a href={`${p.area.href}feed.xml`} className="inline-flex items-center gap-1.5 text-body-s">
            <Icon name="rss" size={14} />
            Follow new tenders in {p.area.name} (RSS)
          </a>
          <ShareBar text={`${p.name}${isWard ? " ward" : ""}, Bengaluru: who got the public works contracts? On CivicTrace`} url={url} />
        </div>
      </header>

      {s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Tenders" value={num(s.tenders)} sub={`${num(s.selections)} with a winner`} />
          <Stat label="Winning bids" value={inr(s.spend)} sub={p.perResident ? `₹${Math.round(p.perResident).toLocaleString("en-IN")} per resident` : undefined} />
          <Stat label="Only one company bid" value={pct(s.single, s.openKnown)} sub={`${num(s.single)} of ${num(s.openKnown)} open contracts`} />
          <Stat label="Typical winning price" value={vsEstimate(s.medianVsEstimate)} sub="compared with the official estimate" />
          <Stat label="Contractors" value={num(s.suppliers.length)} sub={s.top3 != null ? `top 3 won ${Math.round(s.top3 * 100)}%` : undefined} />
          <Stat label="With a warning sign" value={num(s.flagged)} sub={`of ${num(s.fetched)} tenders read in full`} />
          <Stat label="Less than a week to bid" value={pct(s.shortWindows, s.windows)} sub={`${num(s.shortWindows)} tenders`} />
          <Stat label="Priced at the estimate" value={pct(s.atEstimate, s.priced)} sub="within 1% of it" />
        </div>
      ) : (
        <div className="card space-y-3 p-5 text-body-m text-ink-2">
          <p>
            No tender in this release names {p.name} in its title, so none can be pinned to this ward. Most tenders name an office
            rather than a ward, and are counted under the surrounding <strong className="font-medium text-ink">{p.area.name}</strong>{" "}
            constituency.
          </p>
          <Link href={p.area.href} className="btn-secondary">
            <Icon name="map" size={16} />
            See {p.area.name}&apos;s contracts
          </Link>
        </div>
      )}

      <PlaceMap kind={p.kind} id={p.id} />

      {s && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Who wins the work here">
            <ol className="space-y-2.5">
              {p.topContractors.map((c, i) => (
                <li key={c.id} className="text-body-m">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/supplier/?id=${c.id}`} className="min-w-0 truncate">
                      <span className="mr-2 font-mono text-body-s text-muted">{i + 1}</span>
                      {c.name}
                    </Link>
                    <span className="whitespace-nowrap font-mono text-body-s text-ink-2 tabular">
                      {c.wins} · {inr(c.value)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-surface-2">
                    <div className="h-1 rounded-full bg-accent" style={{ width: `${(c.wins / maxWins) * 100}%` }} />
                  </div>
                </li>
              ))}
              {!p.topContractors.length && <li className="text-body-m text-muted">No winners recorded yet.</li>}
            </ol>
            <p className="mt-4 text-body-s text-muted">Winning often is not wrongdoing: local markets for small civil works can be genuinely thin.</p>
          </Section>

          <Section title="Recent contracts">
            <ul className="divide-y divide-line">
              {p.recent.map((r) => (
                <li key={r.nit} className="py-2.5 first:pt-0">
                  <Link href={`/tender/?id=${r.nit}`} className="line-clamp-2 text-body-m">
                    {r.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-body-s text-muted">
                    <span>FY {r.fy}</span>
                    {r.bid != null && <span className="font-mono text-ink-2">{inr(r.bid)}</span>}
                    {r.bidders != null && <span>{r.bidders === 1 ? "only 1 bidder" : `${r.bidders} bidders`}</span>}
                    {r.supplier && <span className="truncate">won by {r.supplier}</span>}
                    {r.flagged && (
                      <span className="flex items-center gap-1 text-notice-ink">
                        <Icon name="flag" size={12} />
                        warning sign
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {s && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="By financial year">
            <table className="data">
              <thead>
                <tr>
                  <th>Year</th>
                  <th className="num">Tenders</th>
                  <th className="num">Winning bids</th>
                </tr>
              </thead>
              <tbody>
                {p.byYear.map((y) => (
                  <tr key={y.fy}>
                    <td className="font-mono">FY {y.fy}</td>
                    <td className="num">{num(y.tenders)}</td>
                    <td className="num">{inr(y.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="Types of work">
            <ul className="space-y-2 text-body-m">
              {p.workTypes.map((w) => (
                <li key={w.category} className="flex justify-between gap-3">
                  <span>{w.category}</span>
                  <span className="font-mono text-ink-2 tabular">{num(w.tenders)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {p.wards.length > 0 && (
        <Section title={isWard ? `Other wards in ${p.area.name}` : `Wards in ${p.name}`}>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {p.wards.map((w) => (
              <li key={w.href} className="flex items-baseline justify-between gap-3 text-body-m">
                <Link href={w.href} className="truncate">
                  {w.name}
                </Link>
                <span className="whitespace-nowrap font-mono text-body-s text-muted">{w.tenders ? `${w.tenders} tenders` : "none pinned"}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <section className="max-w-3xl space-y-2 text-body-s text-muted">
        <p>
          {isWard
            ? "Ward figures count only tenders that name the ward in their title; most tenders name an office instead, and are counted under the constituency."
            : "Tenders are placed in an area by the engineering division that issued them, which follows assembly constituencies."}{" "}
          Areas are administrative geography only: a pattern here says nothing about any elected representative.
        </p>
        <p>
          <strong className="font-medium text-ink-2">Warning signs are not proof.</strong> They mark patterns worth a closer look, each with
          the ordinary explanations that could account for it. Source: Karnataka Public Procurement Portal (KPPP).
        </p>
      </section>
    </div>
  );
}
