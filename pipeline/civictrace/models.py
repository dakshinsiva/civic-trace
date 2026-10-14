"""Pydantic models for outputs that leave the pipeline: flags and claims.

Every flag MUST carry all seven evidence sections; the validators make an
incomplete flag impossible to construct.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


def _non_empty(v, name: str):
    if v is None or (hasattr(v, "__len__") and len(v) == 0):
        raise ValueError(f"{name} must not be empty")
    return v


class SourceLink(BaseModel):
    label: str
    url: str
    sha256: str | None = None
    fetched_at: str | None = None


class Baseline(BaseModel):
    summary: str | None = None   # one plain-language sentence for non-specialists
    method: str
    values: dict[str, Any]
    distribution: dict[str, Any] | None = None  # e.g. quantiles or histogram for the chart

    @field_validator("method")
    @classmethod
    def _m(cls, v):
        return _non_empty(v.strip(), "baseline.method")

    @field_validator("values")
    @classmethod
    def _v(cls, v):
        return _non_empty(v, "baseline.values")


class Period(BaseModel):
    label: str               # e.g. "FY 2024-25"
    start: str | None = None
    end: str | None = None
    basis: str               # which date defines the period
    partial: bool = False


class Coverage(BaseModel):
    dataset: str
    slice: dict[str, Any]
    n: int
    completeness: dict[str, float]
    notes: list[str] = Field(default_factory=list)

    @field_validator("slice")
    @classmethod
    def _s(cls, v):
        return _non_empty(v, "coverage.slice")


class Flag(BaseModel):
    flag_id: str
    rule_id: str
    rule_number: int
    rule_name: str
    rule_plain_name: str | None = None
    rule_version: str
    subject_type: Literal["tender_call", "buyer_slice", "supplier_slice"]
    subject_id: str
    headline: str
    direction: str | None = None     # e.g. "high" / "low" for two-sided rules
    observed: dict[str, Any]
    baseline: Baseline
    period: Period
    coverage: Coverage
    source_links: list[SourceLink]
    non_fraud_explanations: list[str]
    limitations: list[str]
    context: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _complete(self):
        _non_empty(self.observed, "observed")
        _non_empty(self.source_links, "source_links")
        _non_empty([s for s in self.non_fraud_explanations if s.strip()], "non_fraud_explanations")
        _non_empty([s for s in self.limitations if s.strip()], "limitations")
        _non_empty(self.headline.strip(), "headline")
        return self


# ---------------------------------------------------------------- claims

ALLOWED_PREDICATES = {
    "HELD_OFFICE": "An official record shows the person held a specified public office during a stated period.",
    "DECLARED_SHAREHOLDING_IN": "The person's own sworn affidavit declares a shareholding in the company.",
    "DECLARED_GOVT_CONTRACT": "The person's own sworn affidavit (Form 26 item 9B) declares a contract with government.",
    "DIRECTOR_OF": "An official corporate record lists the person as a director of the company.",
    "COURT_FINDING": "A court judgment records a finding against the named party.",
    "AUDIT_OBSERVATION": "An official audit report documents a specified observation about the work or entity.",
    "SAME_ENTITY_AS": "Two records refer to the same legal entity, established by a shared official identifier.",
}

ENTITY_KINDS = {"person", "company", "office", "kppp_supplier", "tender_call", "audit_report", "court_case"}
IDENTITY_BASES = {"CIN", "LLPIN", "GSTIN", "registered_address_and_name", "official_cross_reference"}


class EntityRef(BaseModel):
    kind: str
    id: str
    name: str

    @field_validator("kind")
    @classmethod
    def _k(cls, v):
        if v not in ENTITY_KINDS:
            raise ValueError(f"entity kind must be one of {sorted(ENTITY_KINDS)}")
        return v


class ClaimSource(BaseModel):
    title: str
    url: str
    page: str            # page / paragraph / item locator, e.g. "p. 12, item 7A(iii)"
    excerpt: str         # verbatim excerpt supporting the claim
    sha256: str          # hash of the archived evidence file
    evidence_path: str | None = None   # path under data/evidence/ (committed)
    wayback_url: str | None = None
    retrieved_at: str

    @model_validator(mode="after")
    def _ok(self):
        for f in ("title", "url", "page", "excerpt", "sha256", "retrieved_at"):
            _non_empty((getattr(self, f) or "").strip(), f"source.{f}")
        if not (self.evidence_path or self.wayback_url):
            raise ValueError("source needs evidence_path (committed file) or wayback_url")
        return self


class Claim(BaseModel):
    id: str
    subject: EntityRef
    predicate: str
    object: EntityRef
    valid_from: str | None = None
    valid_to: str | None = None
    identity_basis: str | None = None     # required for SAME_ENTITY_AS
    qualifier: str | None = None          # e.g. office title, declared holding description
    source: ClaimSource
    status: Literal["draft", "reviewed", "published"]
    author: str
    reviewer: str | None = None
    reviewed_at: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _rules(self):
        if self.predicate not in ALLOWED_PREDICATES:
            raise ValueError(f"predicate {self.predicate!r} not allowed; allowed: {sorted(ALLOWED_PREDICATES)}")
        if self.predicate == "SAME_ENTITY_AS" and self.identity_basis not in IDENTITY_BASES:
            raise ValueError(f"SAME_ENTITY_AS requires identity_basis in {sorted(IDENTITY_BASES)} (a name match is never enough)")
        if self.status in ("reviewed", "published"):
            if not self.reviewer or not self.reviewed_at:
                raise ValueError("reviewed/published claims need reviewer and reviewed_at")
            if self.reviewer.strip().lower() == self.author.strip().lower():
                raise ValueError("reviewer must be a different person from author")
        return self
