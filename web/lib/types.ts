// Shapes of the static data release written by pipeline/civictrace/export.py.

export type SourceLink = { label: string; url: string; sha256?: string | null; fetched_at?: string | null };

export type FlagStub = {
  flag_id: string;
  rule_id: string;
  rule_number: number;
  rule_name: string;
  rule_plain_name: string;
  subject_type: "tender_call" | "buyer_slice" | "supplier_slice";
  headline: string;
  direction: string | null;
  title: string | null;
  buyer: string | null;
  division: string | null;
  work_category: string | null;
  fiscal_year: string | null;
  nit_id: number | null;
  tender_number: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  level: string | null;
  ecv: number | null;
  partial_period: boolean;
};

export type Histogram = { counts: number[]; edges: number[]; log: boolean; quantiles?: Quantiles };
export type Quantiles = { n: number; min: number; p05: number; q1: number; median: number; q3: number; p95: number; max: number };

export type Flag = {
  flag_id: string;
  rule_id: string;
  rule_number: number;
  rule_name: string;
  rule_plain_name?: string | null;
  rule_version: string;
  subject_type: FlagStub["subject_type"];
  subject_id: string;
  headline: string;
  direction: string | null;
  observed: Record<string, unknown>;
  baseline: { summary?: string | null; method: string; values: Record<string, unknown>; distribution: Record<string, unknown> | null };
  period: { label: string; start: string | null; end: string | null; basis: string; partial: boolean };
  coverage: { dataset: string; slice: Record<string, unknown>; n: number; completeness: Record<string, number>; notes: string[] };
  source_links: SourceLink[];
  non_fraud_explanations: string[];
  limitations: string[];
  context: Record<string, unknown> & { nit_id?: number; nit_ids?: number[]; supplier_id?: number };
};

export type RuleConfig = {
  number: number;
  version: string;
  name: string;
  plain_name?: string;
  plain_question?: string;
  plain_why?: string;
  ocp_ref?: string;
  enabled: boolean;
  summary: string;
  method: string;
  non_fraud_explanations: string[];
  limitations: string[];
  [k: string]: unknown;
};

export type CoverageRow = {
  buyer: string;
  calls: number;
  details_fetched: number;
  detail_unavailable: number;
  first_published: string | null;
  last_published: string | null;
  fields: Record<string, { label: string; completeness: number; n: number }>;
};

export type Meta = {
  generated_at: string;
  data_version: string;
  pipeline_version: string;
  as_of: string;
  published_range: [string, string];
  buyers: { dept_id: number; code: string; name: string; family: string; parent_code: string | null; effective_from: string | null; effective_to: string | null; note: string | null }[];
  counts: {
    calls: number;
    processes: number;
    calls_with_details: number;
    selections: number;
    suppliers: number;
    flags: number;
    quarantined: number;
    suppressed: Record<string, number>;
  };
  coverage: CoverageRow[];
  rules: Record<string, RuleConfig>;
  rule_defaults: Record<string, unknown>;
  sources: { name: string; url: string; terms: string; coverage: string }[];
  relationships_included: boolean;
  suppressions: { type: string; id: string; reason: string; since: string }[];
};

export type BuyerSummary = {
  code: string;
  name: string;
  calls: number;
  processes: number;
  selections: number;
  suppliers: number;
  single_bidder: number;
  bidder_count_known: number;
  flags_by_rule: Record<string, number>;
};

export type Overview = {
  base_rate: { calls_with_details: number; calls_with_any_call_level_indicator: number; share: number | null };
  by_buyer: BuyerSummary[];
  rules: { rule_id: string; number: number; name: string; plain_name: string; plain_question: string | null; plain_why: string | null; enabled: boolean; flags: number; evaluated: number | null; slices: number | null; notices: Record<string, number> }[];
  window_distribution: Histogram | null;
  window_quantiles: Quantiles | null;
  ratio_distribution: Histogram | null;
  single_bidder_trend: { buyer: string; fy: string; single: number; known: number }[];
  concentration: { level: string; buyer: string; division?: string; work_category: string; fiscal_year: string; hhi: number; top3_share: number; n: number; flag_id: string }[];
  selections_by_fy: { fy: string; awarded: number; selected_no_award: number }[];
};

export type BuyerDoc = {
  code: string;
  name: string;
  totals: { calls: number; processes: number; selections: number; suppliers: number };
  by_fy: {
    fy: string;
    calls: number;
    statuses: Record<string, number>;
    selections: number;
    single_bidder: number;
    bidder_count_known: number;
    median_bidders: number | null;
    selected_value: number | null;
  }[];
  work_categories: Record<string, number>;
  divisions: { division: string; calls: number; selections: number; suppliers: number }[];
  window_distribution: Histogram | null;
  window_quantiles: Quantiles | null;
  ratio_distribution: Histogram | null;
  flags_by_rule: Record<string, number>;
};

export type TenderDoc = {
  nit_id: number;
  tender_number: string;
  process_key: string;
  call_no: number;
  buyer_code: string;
  buyer_name: string;
  division: string;
  work_category: string;
  tender_type: string;
  notice_type: string | null;
  inviting_strategy: string | null;
  evaluation_type: string | null;
  bid_value_type: string | null;
  tax_type: string | null;
  published_by_post: string | null;
  title: string;
  ecv: number | null;
  ecv_public: number | null;
  published_at: string | null;
  close_at_original: string | null;
  close_at_final: string | null;
  tech_open_at: string | null;
  no_of_calls: number | null;
  status: string;
  award_date: string | null;
  detail_state: string;
  fy_published: string | null;
  n_price_stage_bidders: number | null;
  n_corrigenda: number;
  n_deadline_extensions: number;
  selection: {
    supplier_id: number | null;
    supplier_name: string;
    bid_value: number | null;
    negotiated_value: number | null;
    contract_value: number | null;
    label: "awarded" | "selected_no_award";
    bid_status: string | null;
    bid_tax_type: string | null;
  } | null;
  bidders: { position: number; raw_name: string; total_bid: number | null; rank: string | null }[];
  amendments: { seq: number; reason: string | null; created_at: string | null; close_original: string | null; close_revised: string | null }[];
  status_history: { status: string; first_observed_at: string }[];
  calls_in_process: { nit_id: number; call_no: number; status: string; published_at: string | null; close_at_final: string | null; n_price_stage_bidders: number | null }[];
  quarantine: { reason: string; detail: string | null }[];
  sources: SourceLink[];
  portal_url: string;
  flags: FlagStub[];
};

export type TenderStub = {
  nit_id: number;
  tender_number: string;
  title: string;
  buyer: string;
  division: string;
  work_category: string;
  status: string;
  fy: string | null;
  ecv: number | null;
  supplier_id: number | null;
  supplier_name: string | null;
  bid_value: number | null;
  n_flags: number;
};

export type SupplierDoc = {
  supplier_id: number;
  name: string;
  names_seen: string[];
  selections: number;
  awarded: number;
  selected_no_award: number;
  total_bid_value: number | null;
  by_buyer_fy: { buyer_code: string; fy_decision: string; selections: number; bid_value: number | null }[];
  tenders: {
    nit_id: number;
    tender_number: string;
    title: string;
    buyer: string;
    division: string;
    work_category: string;
    fy: string | null;
    ecv: number | null;
    bid_value: number | null;
    label: string;
    n_price_stage_bidders: number | null;
  }[];
  flags: FlagStub[];
};

export type Graph = {
  nodes: { id: string; kind: string; entity_id: string; name: string }[];
  edges: {
    id: string;
    source: string;
    target: string;
    predicate: string;
    qualifier: string | null;
    valid_from: string | null;
    valid_to: string | null;
    identity_basis: string | null;
    evidence: { title: string; url: string; page: string; excerpt: string; sha256: string; evidence_path: string | null; wayback_url: string | null; retrieved_at: string };
    reviewer: string | null;
    reviewed_at: string | null;
  }[];
};
