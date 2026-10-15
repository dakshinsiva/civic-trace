import Link from "next/link";

import { PageTitle, Section } from "@/components/ui";
import { getMeta, getUnavailable } from "@/lib/data";
import { date, num, pct } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Data coverage",
  description:
    "How much of Bengaluru's public works tender data has been read so far, field by field and department by department.",
  path: "/coverage/",
});

export default function CoveragePage() {
  const meta = getMeta();
  const unavailable = getUnavailable();
  const fields = meta.coverage[0] ? Object.entries(meta.coverage[0].fields).map(([k, v]) => [k, v.label] as const) : [];
  return (
    <div className="space-y-6">
      <PageTitle title="Data coverage">
        <p>What this release contains, how complete each field is, and what is not covered at all.</p>
      </PageTitle>

      <Section title="Sources">
        {meta.sources.map((s) => (
          <div key={s.url} className="text-sm">
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.name}
            </a>
            <p className="text-ink-2">{s.coverage}</p>
            <p className="text-muted">{s.terms}</p>
          </div>
        ))}
      </Section>

      <Section title="Field completeness by buyer">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Buyer</th>
                <th className="num">Calls</th>
                <th className="num">Details fetched</th>
                <th>Published</th>
                {fields.map(([k, label]) => (
                  <th key={k} className="num whitespace-normal min-w-[7rem]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meta.coverage.map((c) => (
                <tr key={c.buyer}>
                  <td>{c.buyer}</td>
                  <td className="num">{num(c.calls)}</td>
                  <td className="num">
                    {pct(c.details_fetched, 0)}
                    {c.detail_unavailable > 0 && (
                      <a href="#unavailable" className="block text-xs text-muted">
                        {c.detail_unavailable} unavailable
                      </a>
                    )}
                  </td>
                  <td className="text-xs whitespace-nowrap">
                    {date(c.first_published)} – {date(c.last_published)}
                  </td>
                  {fields.map(([k]) => (
                    <td key={k} className="num">
                      {pct(c.fields[k]?.completeness, 0)}
                      <div className="text-xs text-muted">n={num(c.fields[k]?.n)}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">
          Completeness is measured over calls whose details have been fetched. Supplier, bid value and bidder count are
          measured over calls that reached a selection (awarded, evaluation completed or finalised). &ldquo;Unavailable&rdquo;
          means the portal returned an error for that record&apos;s details on every attempt.
        </p>
      </Section>

      <Section title="Counts">
        <ul className="text-sm space-y-0.5 tabular">
          <li>Tender calls: {num(meta.counts.calls)} ({num(meta.counts.processes)} distinct works)</li>
          <li>Calls with full details: {num(meta.counts.calls_with_details)}</li>
          <li>Selections: {num(meta.counts.selections)}</li>
          <li>Quarantined by automatic consistency checks: {num(meta.counts.quarantined)}</li>
          <li>Withheld pending correction: {Object.values(meta.counts.suppressed).reduce((a, b) => a + b, 0)}</li>
        </ul>
      </Section>

      {unavailable && unavailable.count > 0 && (
        <Section id="unavailable" title={`Records the portal wouldn't give us (${num(unavailable.count)})`}>
          <p className="text-sm text-ink">
            For {num(unavailable.count)} of {num(unavailable.listed)} tenders ({pct(unavailable.count / unavailable.listed, 1)}), the
            government portal returned an error every time we asked for the full record. Each was tried more than once, at
            different times (the &ldquo;Attempts&rdquo; column), with three quick retries on every attempt. These tenders still appear in the tender list with what the portal&apos;s search
            listing shows, but they are left out of every warning sign and finding that needs the missing details.
          </p>
          <p className="mt-2 text-sm text-ink-2">
            This is a fault on the portal&apos;s side (it answers with a server error for these records), not a judgement about the
            tenders. They will be tried again in future updates.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {Object.entries(unavailable.by_buyer)
              .sort((a, b) => b[1] - a[1])
              .map(([b, n]) => (
                <span key={b} className="rounded-full border border-line px-2.5 py-1 tabular">
                  {b}: {num(n)}
                </span>
              ))}
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-ink-2">Show the {num(unavailable.count)} tenders</summary>
            <div className="mt-2 max-h-[480px] overflow-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Tender</th>
                    <th>Department</th>
                    <th>Published</th>
                    <th className="num">Attempts</th>
                    <th>Last tried</th>
                    <th>What failed</th>
                  </tr>
                </thead>
                <tbody>
                  {unavailable.tenders.map((t) => (
                    <tr key={t.nit_id}>
                      <td className="max-w-md">
                        <Link href={`/tender/?id=${t.nit_id}`}>{t.title || t.tender_number}</Link>
                        <div className="text-xs text-muted tabular">{t.tender_number}</div>
                      </td>
                      <td>{t.buyer}</td>
                      <td className="whitespace-nowrap">{date(t.published_at)}</td>
                      <td className="num">{t.attempts ?? "—"}</td>
                      <td className="whitespace-nowrap">{date(t.last_tried)}</td>
                      <td className="text-xs text-ink-2">{t.error ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Section>
      )}

      <Section title="Not covered (yet)">
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>Tenders before 20 May 2023, which sit on the older eproc.karnataka.gov.in portal and haven&apos;t been ingested yet.</li>
          <li>Goods and services tenders. Only works tenders are covered so far.</li>
          <li>Other Bengaluru bodies: BDA, BWSSB, BMRCL, BESCOM, Bengaluru Smart City, KRIDE, BMTC and BMRDA. They are configured but not yet enabled.</li>
          <li>Contract execution, payments and bills.</li>
          <li>Bidders rejected at the technical stage.</li>
          <li>Company identifiers (GSTIN, CIN). The portal publishes none.</li>
          <li>Audit reports (CAG, Lokayukta). The audit-linked rule is planned.</li>
          <li>The Central Public Procurement Portal. It uses a CAPTCHA, which CivicTrace does not bypass.</li>
        </ul>
      </Section>
    </div>
  );
}
