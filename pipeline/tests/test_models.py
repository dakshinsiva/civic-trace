"""Every flag must carry all seven evidence sections; claims must be evidence-gated."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from civictrace.models import Baseline, Claim, Coverage, Flag, Period, SourceLink


def _flag(**over):
    base = dict(
        flag_id="x",
        rule_id="single_bidder",
        rule_number=2,
        rule_name="Single bidder at price stage",
        rule_version="1.0.0",
        subject_type="tender_call",
        subject_id="1",
        headline="One bidder.",
        observed={"price_stage_bidders": 1},
        baseline=Baseline(method="rate", values={"rate": 0.1}),
        period=Period(label="FY 2024-25", basis="award date"),
        coverage=Coverage(dataset="d", slice={"buyer": "BBMP"}, n=10, completeness={"n": 1.0}),
        source_links=[SourceLink(label="KPPP", url="https://kppp.karnataka.gov.in")],
        non_fraud_explanations=["Small works attract few bidders."],
        limitations=["Technical-stage rejections not counted."],
    )
    base.update(over)
    return Flag(**base)


def test_complete_flag_ok():
    assert _flag().rule_id == "single_bidder"


@pytest.mark.parametrize(
    "field,value",
    [
        ("observed", {}),
        ("source_links", []),
        ("non_fraud_explanations", []),
        ("non_fraud_explanations", ["  "]),
        ("limitations", []),
        ("headline", " "),
    ],
)
def test_flag_missing_section_rejected(field, value):
    with pytest.raises(ValidationError):
        _flag(**{field: value})


def test_baseline_needs_values():
    with pytest.raises(ValidationError):
        Baseline(method="m", values={})


def _claim(**over):
    base = dict(
        id="c1",
        subject={"kind": "person", "id": "p1", "name": "Person One"},
        predicate="DECLARED_SHAREHOLDING_IN",
        object={"kind": "company", "id": "co1", "name": "Company One"},
        source=dict(
            title="Form 26 affidavit",
            url="https://example.test/affidavit.pdf",
            page="p. 12, item 7A(iii)",
            excerpt="Shares in Company One",
            sha256="a" * 64,
            evidence_path="data/evidence/x.pdf",
            retrieved_at="2026-10-14",
        ),
        status="draft",
        author="alice",
    )
    base.update(over)
    return Claim(**base)


def test_claim_draft_ok():
    assert _claim().status == "draft"


def test_claim_disallowed_predicate():
    for bad in ("RELATIVE_OF", "SAME_PARTY_AS", "SAME_CONSTITUENCY"):
        with pytest.raises(ValidationError):
            _claim(predicate=bad)


def test_claim_published_needs_independent_reviewer():
    with pytest.raises(ValidationError):
        _claim(status="published")
    with pytest.raises(ValidationError):
        _claim(status="published", reviewer="Alice", reviewed_at="2026-10-14")
    assert _claim(status="published", reviewer="bob", reviewed_at="2026-10-14").reviewer == "bob"


def test_claim_needs_excerpt_and_evidence():
    with pytest.raises(ValidationError):
        _claim(source=dict(title="t", url="u", page="p", excerpt="", sha256="a", evidence_path="x", retrieved_at="d"))
    with pytest.raises(ValidationError):
        _claim(source=dict(title="t", url="u", page="p", excerpt="e", sha256="a", retrieved_at="d"))


def test_same_entity_requires_identifier_basis():
    kw = dict(predicate="SAME_ENTITY_AS", object={"kind": "kppp_supplier", "id": "123", "name": "X"}, subject={"kind": "company", "id": "co1", "name": "X"})
    with pytest.raises(ValidationError):
        _claim(**kw)
    with pytest.raises(ValidationError):
        _claim(**kw, identity_basis="name_match")
    assert _claim(**kw, identity_basis="GSTIN").identity_basis == "GSTIN"
