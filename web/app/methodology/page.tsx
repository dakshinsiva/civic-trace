import { PageTitle, Section } from "@/components/ui";
import { getMeta } from "@/lib/data";

export const metadata = { title: "Methodology" };

const SKIP = new Set(["number", "version", "name", "ocp_ref", "enabled", "summary", "method", "non_fraud_explanations", "limitations"]);

export default function MethodologyPage() {
  const meta = getMeta();
  const rules = Object.entries(meta.rules).sort(([, a], [, b]) => a.number - b.number);
  return (
    <div className="space-y-6">
      <PageTitle title="Methodology">
        <p>
          Every indicator comes from a rule with a published definition, fixed thresholds and a version number. The rules
          are deliberately simple so anyone can check them by hand against the source records. The code and tests are open
          source.
        </p>
      </PageTitle>

      <Section title="Principles">
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            <strong>Risk indicators, not findings.</strong> An indicator marks a pattern worth examining. Each one shows its
            observed values, a comparison baseline, the period and data coverage, links to the source records, plausible
            legitimate explanations, and known limitations.
          </li>
          <li>
            <strong>No scores, no rankings of people or companies.</strong> Indicators are never added up into a score for a
            person or a supplier, and the site has no supplier leaderboard.
          </li>
          <li>
            <strong>No inference.</strong> Indicators run only on fields the portal actually publishes. Where a field is
            missing for more than {Math.round(Number(meta.rule_defaults.min_completeness) * 100)}% of a comparison group,
            the rule skips that group rather than guess.
          </li>
          <li>
            <strong>Fair comparisons.</strong> Each tender is compared with its own buyer, work category and call type.
            Groups below a minimum size, or with no spread, are skipped.
          </li>
          <li>
            <strong>Traceable.</strong> Every portal response is archived with its sha256 hash and retrieval time. Records
            whose tender number does not match across portal responses are quarantined and never attributed.
          </li>
        </ul>
      </Section>

      <Section title="Data pipeline">
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          <li>
            Enumerate every works tender for each covered buyer and status from the portal&apos;s public search, at most one
            request per second.
          </li>
          <li>
            For each tender call, fetch the full record, its corrigenda, the selected bid and the published comparative
            statement of price-stage bidders.
          </li>
          <li>
            Group re-tendered calls of the same work, which share a tender-number root with a <code>/CALL-n</code> suffix.
            Officials&apos; phone numbers are never extracted.
          </li>
          <li>Run rules 1–6 and validate every indicator against the seven-section evidence schema.</li>
          <li>Export a versioned, static data release. Disputed items listed in the suppressions file are withheld.</li>
        </ol>
        <p className="text-sm text-ink-2 mt-2">
          Fiscal years run April–March (IST). Process rules (2–4) use the publication date; award rules (1, 5, 6) use the
          award date, or the bid-close date when no award is recorded. FY 2023-24 is partial because portal history begins
          on 20 May 2023, and the current year is partial.
        </p>
      </Section>

      {rules.map(([id, r]) => (
        <Section key={id} id={id} title={`R${r.number} · ${r.name}${r.enabled ? "" : " (planned)"}`}>
          <p className="text-xs text-muted mb-2">
            version {r.version}
            {r.ocp_ref ? ` · ${r.ocp_ref}` : ""}
          </p>
          <p className="text-sm text-ink">{r.summary}</p>
          <p className="text-sm text-ink-2 mt-2">{r.method}</p>
          <h3 className="text-label-l text-accent mt-4 mb-1">Thresholds</h3>
          <ul className="text-sm tabular">
            {Object.entries(r)
              .filter(([k]) => !SKIP.has(k))
              .map(([k, v]) => (
                <li key={k}>
                  {k.replace(/_/g, " ")}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </li>
              ))}
          </ul>
          <div className="grid gap-4 sm:grid-cols-2 mt-3">
            <div>
              <h3 className="text-label-l text-accent mb-1">Plausible non-fraud explanations</h3>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                {r.non_fraud_explanations.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-label-l text-accent mb-1">Known limitations</h3>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                {r.limitations.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      ))}

      <Section title="References">
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>Open Contracting Partnership, Red Flags in Public Procurement (2024): indicator codes R003, R018, R031, R040, R051.</li>
          <li>Open Contracting Partnership, Red Flags for Integrity (2016).</li>
          <li>US Department of Justice Herfindahl–Hirschman Index bands, as cited by OCP.</li>
          <li>Karnataka Transparency in Public Procurements Act, 1999 and Rules, 2000 (rule 17: tender periods). The current gazetted text is still to be verified before any legal-minimum comparison is enabled.</li>
        </ul>
      </Section>
    </div>
  );
}
