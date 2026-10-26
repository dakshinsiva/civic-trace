import { statSync } from "node:fs";
import path from "node:path";

import Link from "next/link";

import { DownloadAll } from "@/components/DownloadAll";
import { Icon } from "@/components/Icon";
import { PageTitle, Section } from "@/components/ui";
import { getMeta, getOverview } from "@/lib/data";
import { date, num } from "@/lib/format";
import { allAreas } from "@/lib/placeData";
import { pageMetadata, REPO, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Open data: Bengaluru public works tenders",
  description:
    "Download every Bengaluru public works tender in CivicTrace as a spreadsheet, or use the JSON files and RSS feeds directly. What each file contains, the licence and how to cite it.",
  path: "/open-data/",
});

const FILES: { file: string; what: string }[] = [
  { file: "facts.json", what: "Every tender in a compact column table: department, local office, type of work, year and month, estimate, winning price, number of bidders, time to bid, change notices, winner, warning signs, constituency area and ward. Decode it with the `dict` lists; this is what powers the homepage." },
  { file: "tenders-index.json", what: "One row per tender: number, title, department, local office, type of work, status, year, estimate, winner as published and winning price." },
  { file: "tenders/", what: "The full record of each tender (dates, every change notice, every bidder and price, sources), in files of up to 256 tenders. The tender page shows which file it reads." },
  { file: "findings.json", what: "The figures on the \"How widespread?\" page: how often each warning sign appears, with 95% ranges, competition against price, and the bid-rigging checks." },
  { file: "peers.json", what: "Typical price, competition and time to bid for groups of similar tenders, used by \"How does this tender compare?\"." },
  { file: "flags-index.json", what: "Every warning sign raised, with the rule, the tender or contractor, and the values behind it." },
  { file: "suppliers-index.json", what: "Every contractor that won at least one tender, as the portal publishes the name, with counts and totals." },
  { file: "unavailable.json", what: "The tenders whose full record the portal refuses to return, with how many times each was tried and what failed." },
  { file: "recent.json", what: "The newest tenders, citywide and for each constituency area, as used by the RSS feeds." },
  { file: "meta.json", what: "This release: when it was built, the period it covers, counts, field completeness by department, and sources." },
  { file: "geo/areas.geojson", what: "The 28 constituency areas, with population." },
  { file: "geo/wards.geojson", what: "The 369 wards (2025 delimitation), with their area and corporation." },
  { file: "geo/corporations.geojson", what: "The five city corporations." },
];

function size(rel: string): string | null {
  try {
    const st = statSync(path.join(process.cwd(), "public", "data", rel));
    if (st.isDirectory()) return null;
    const kb = st.size / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
  } catch {
    return null;
  }
}

export default function OpenDataPage() {
  const meta = getMeta();
  const o = getOverview();
  const buyerNames = Object.fromEntries(meta.buyers.map((b) => [b.code, b.name]));
  const ruleNames = Object.fromEntries(o.rules.map((r) => [r.rule_id, r.plain_name]));
  const areas = allAreas().sort((a, b) => a.name.localeCompare(b.name));
  const citation = `${SITE_NAME}, data release ${meta.data_version} (${date(meta.generated_at)}), from the Karnataka Public Procurement Portal. ${SITE_URL}/open-data/`;
  return (
    <div className="space-y-6">
      <PageTitle title="Open data">
        <p>
          Everything on this site comes from public records, and all of it can be downloaded: {num(meta.counts.calls)} public works tenders
          published from {date(meta.published_range[0])} to {date(meta.published_range[1])}, last checked {date(meta.as_of)}. Use it for
          reporting, research or your residents&apos; association; please credit the sources below.
        </p>
      </PageTitle>

      <Section title="Download every tender">
        <p className="mb-4 max-w-3xl text-body-m text-ink-2">
          One spreadsheet (CSV) with a row per tender and a link to its page here. It opens in Excel, Google Sheets or LibreOffice. To
          download only part of it, set the filters on the <Link href="/#explore">homepage</Link> and use the download button there.
        </p>
        <DownloadAll buyerNames={buyerNames} ruleNames={ruleNames} />
      </Section>

      <Section title="The data files">
        <p className="mb-3 max-w-3xl text-body-m text-ink-2">
          The site is built from these JSON files, served as they are. Each new data release replaces them.
        </p>
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>File</th>
                <th>What it contains</th>
                <th className="num">Size</th>
              </tr>
            </thead>
            <tbody>
              {FILES.map((f) => (
                <tr key={f.file}>
                  <td className="whitespace-nowrap font-mono text-body-s">
                    {f.file.endsWith("/") ? `/data/${f.file}` : <a href={`/data/${f.file}`}>/data/{f.file}</a>}
                  </td>
                  <td className="min-w-[18rem] text-body-s text-ink-2">{f.what}</td>
                  <td className="num whitespace-nowrap text-body-s">{size(f.file) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Follow new tenders (RSS)">
        <p className="max-w-3xl text-body-m text-ink-2">
          Add a feed to any feed reader (Feedly, Inoreader, NetNewsWire, Thunderbird) to see new tenders as they are added. No account or
          email is needed.
        </p>
        <p className="mt-3">
          <a href="/feed.xml" className="inline-flex items-center gap-1.5">
            <Icon name="rss" size={16} />
            All of Bengaluru: {SITE_URL}/feed.xml
          </a>
        </p>
        <details className="mt-3 text-body-m">
          <summary className="cursor-pointer text-ink-2">One feed per constituency area ({areas.length})</summary>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((a) => (
              <li key={a.href}>
                <a href={`${a.href}feed.xml`} className="inline-flex items-center gap-1.5 text-body-s">
                  <Icon name="rss" size={12} />
                  {a.name}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </Section>

      <Section title="Licence and credit">
        <ul className="list-disc space-y-2 pl-5 text-body-m text-ink-2">
          {meta.sources.map((s) => (
            <li key={s.url}>
              <strong className="font-medium text-ink">Tender records:</strong> <a href={s.url}>{s.name}</a>. {s.terms}
            </li>
          ))}
          {meta.geo?.attribution && (
            <li>
              <strong className="font-medium text-ink">Boundaries:</strong> {meta.geo.attribution}
            </li>
          )}
          {meta.geo?.sites?.attribution && (
            <li>
              <strong className="font-medium text-ink">Places:</strong> {meta.geo.sites.attribution.replace(/^Places:\s*/, "")}
            </li>
          )}
          <li>
            <strong className="font-medium text-ink">Warning signs, findings and code:</strong> open source under the MIT licence;{" "}
            <a href={REPO}>the code and the rules</a> are on GitHub.
          </li>
        </ul>
        <h3 className="mt-5 text-title-s text-ink">How to cite</h3>
        <p className="mt-2 rounded-md bg-surface-2 p-3 font-mono text-body-s text-ink">{citation}</p>
        <p className="mt-3 text-body-s text-muted">
          Contractor names appear exactly as the portal publishes them. A warning sign is a reason to look closer, not proof of wrongdoing;
          please say so when you use them. Found an error? <Link href="/corrections/">Report it</Link>.
        </p>
      </Section>
    </div>
  );
}
