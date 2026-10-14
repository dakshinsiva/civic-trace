import Link from "next/link";

import { PageTitle, Section } from "@/components/ui";

export const metadata = { title: "How tender manipulation works" };

type Scheme = {
  name: string;
  how: string;
  signals: { rule?: string; label: string }[];
  cannotSee: string;
};

const SCHEMES: Scheme[] = [
  {
    name: "Deadline squeeze",
    how: "A tender is published with very little time to respond, so only a bidder who knew in advance can prepare a compliant bid. Variants: publishing just before a holiday, or short windows on re-tenders.",
    signals: [{ rule: "short_window", label: "R3 short submission window" }, { label: "Calls in a work's history (re-tender windows)" }],
    cannotSee: "Whether a shorter period was approved in writing for a genuine emergency under Rule 17(2), or whether the notice was circulated informally earlier.",
  },
  {
    name: "Bid suppression and cover bidding",
    how: "Competitors agree that one will win. Others stay away, or submit deliberately high or non-compliant 'cover' bids so the tender looks competitive.",
    signals: [
      { rule: "single_bidder", label: "R2 single bidder at price stage" },
      { label: "Tender page: all price-stage bids, ranks and their distance from the estimate" },
    ],
    cannotSee: "Agreements themselves. Cover bids with three nominal bidders pass a single-bid test. Technical-stage rejections are not published.",
  },
  {
    name: "Bid rotation and market allocation",
    how: "A group of contractors takes turns winning, or splits a city by ward or work type so each has its own territory.",
    signals: [
      { rule: "supplier_share", label: "R1 supplier's share of a buyer's selections" },
      { rule: "concentration", label: "R6 concentrated selections in a market" },
    ],
    cannotSee: "Related firms registered under different supplier IDs (no GSTIN or CIN is published), so true concentration can be higher than shown.",
  },
  {
    name: "Tailored specifications and moving goalposts",
    how: "Eligibility criteria, turnover thresholds or specifications are written, or amended by corrigendum, to fit one bidder.",
    signals: [{ rule: "amendments", label: "R4 repeated amendments (corrigenda)" }],
    cannotSee: "What a corrigendum changed beyond dates: the portal's structured data records date changes and a free-text reason, not the text of changed criteria.",
  },
  {
    name: "Inflated pricing",
    how: "The estimate is padded, or the winning price sits well above what the work should cost, leaving room for kickbacks.",
    signals: [{ rule: "award_ratio", label: "R5 selected bid far from the estimate" }],
    cannotSee: "Whether the estimate itself was inflated. If both estimate and bid are padded, the ratio looks normal. Negotiation often brings the price exactly to the estimate, so the bid before negotiation is used.",
  },
  {
    name: "Re-tendering until the 'right' bidder wins",
    how: "Calls are cancelled or re-tendered, sometimes repeatedly, until conditions favour a preferred bidder.",
    signals: [{ label: "Tender page: every call for the same work, with outcomes and bidder counts" }],
    cannotSee: "Why a call was recalled; the reason is rarely published in structured form.",
  },
  {
    name: "Contract splitting",
    how: "One large work is broken into several smaller tenders to stay below approval or advertising thresholds, or to spread it across friendly contractors.",
    signals: [{ label: "Planned rule: clusters of same-day tenders with near-identical estimates and titles in one division" }],
    cannotSee: "Not yet implemented as a rule. Legitimate packaging of ward-level maintenance looks similar.",
  },
  {
    name: "Selection without a recorded award",
    how: "A bidder is selected after evaluation but no award is recorded on the portal, leaving the final contract terms outside public view.",
    signals: [{ label: "'Selected, no award recorded' label on tenders and suppliers; status counts on buyer pages" }],
    cannotSee: "Whether work orders were issued offline. Many of these are probably awarded but not updated on the portal.",
  },
];

export default function PatternsPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="How tender manipulation works, and what records can show">
        <p>
          A general guide to common ways public tenders are manipulated, the indicator that can sometimes detect each
          one, and the blind spots. It describes schemes in general and does not say any of them happened in a particular
          tender.
        </p>
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-2">
        {SCHEMES.map((s) => (
          <Section key={s.name} title={s.name}>
            <p className="text-sm text-ink">{s.how}</p>
            <h3 className="text-xs font-semibold text-ink-2 mt-3 mb-1 uppercase tracking-wide">What can surface it</h3>
            <ul className="text-sm space-y-0.5">
              {s.signals.map((sig) => (
                <li key={sig.label}>{sig.rule ? <Link href={`/methodology/#${sig.rule}`}>{sig.label}</Link> : sig.label}</li>
              ))}
            </ul>
            <h3 className="text-xs font-semibold text-ink-2 mt-3 mb-1 uppercase tracking-wide">Blind spots</h3>
            <p className="text-sm text-ink-2">{s.cannotSee}</p>
          </Section>
        ))}
      </div>

      <Section title="Can these records show that politicians benefit?">
        <div className="space-y-3 text-sm text-ink">
          <p>
            Tender records name the buyer and the winning supplier. They do not name the officials or politicians who may
            have influenced a decision. The connection has to come from other official documents, and only where those
            documents say so explicitly:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Election affidavits (Form 26).</strong> Candidates must declare shareholdings (item 7A) and contracts
              with government held by themselves, their spouse or dependents, or by firms and companies they have an
              interest in (item 9B).
            </li>
            <li>
              <strong>Official corporate records.</strong> These list a company&apos;s directors. KPPP publishes no company
              identifiers, so matching a supplier to a registered company needs an official identifier, not a similar name.
            </li>
            <li>
              <strong>Records of office held.</strong> Assembly membership and ministerial portfolios, such as Greater
              Bengaluru Development, show who had authority over which bodies and when.
            </li>
            <li>
              <strong>Court judgments and audit reports.</strong> These record findings about named parties or specific
              works.
            </li>
          </ul>
          <p>Even a complete documented chain only says what each document says. It does not show influence. In particular:</p>
          <ul className="list-disc pl-5 space-y-1 text-ink-2">
            <li>A declared asset is not evidence of wrongdoing.</li>
            <li>A pending criminal case is not a conviction.</li>
            <li>An audit observation is not necessarily a finding of criminal conduct.</li>
            <li>A donation or personal relationship does not establish favouritism.</li>
            <li>A shared surname, constituency, hometown or party is not evidence of a relationship.</li>
            <li>A company winning many contracts is not, by itself, evidence of collusion.</li>
          </ul>
          <p className="text-ink-2">
            CivicTrace keeps a documented-connections layer that records only such explicit, source-cited and independently
            reviewed links. It is not part of the public site until its review process and a legal review are complete.
          </p>
        </div>
      </Section>
    </div>
  );
}
