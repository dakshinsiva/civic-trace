from __future__ import annotations

import hashlib

import yaml

from civictrace.claims import load_claims, scaffold
from civictrace.graph import build_graph
from civictrace.models import Claim


def _src():
    return dict(title="t", url="https://example.test", page="p. 1", excerpt="verbatim", sha256="a" * 64,
                wayback_url="https://web.archive.org/x", retrieved_at="2026-10-14")


def C(id, s, p, o, status="published", **kw):
    return Claim(id=id, subject=s, predicate=p, object=o, source=_src(), status=status, author="alice",
                 reviewer=None if status == "draft" else "bob", reviewed_at=None if status == "draft" else "2026-10-14", **kw)


P1 = {"kind": "person", "id": "p1", "name": "Official One"}
P2 = {"kind": "person", "id": "p2", "name": "Official Two"}
OFF = {"kind": "office", "id": "mla-x", "name": "MLA, Example constituency"}
CO = {"kind": "company", "id": "co1", "name": "Example Infra Pvt Ltd"}
SUP = {"kind": "kppp_supplier", "id": "555", "name": "EXAMPLE INFRA PVT LTD"}


def test_office_alone_never_creates_person():
    g = build_graph([C("c1", P2, "HELD_OFFICE", OFF)], {555})
    assert g["nodes"] == [] and g["edges"] == []


def test_complete_path_included_with_office_context():
    claims = [
        C("c1", P1, "DECLARED_SHAREHOLDING_IN", CO),
        C("c2", CO, "SAME_ENTITY_AS", SUP, identity_basis="GSTIN"),
        C("c3", P1, "HELD_OFFICE", OFF),
        C("c4", P2, "HELD_OFFICE", OFF),  # P2 has no path -> excluded
    ]
    g = build_graph(claims, {555})
    ids = {n["id"] for n in g["nodes"]}
    assert ids == {"person:p1", "company:co1", "kppp_supplier:555", "office:mla-x"}
    assert {e["id"] for e in g["edges"]} == {"c1", "c2", "c3"}


def test_supplier_without_selection_breaks_path():
    claims = [C("c1", P1, "DECLARED_SHAREHOLDING_IN", CO), C("c2", CO, "SAME_ENTITY_AS", SUP, identity_basis="GSTIN")]
    assert build_graph(claims, set())["nodes"] == []


def test_draft_and_reviewed_claims_excluded_from_published_graph():
    claims = [C("c1", P1, "DECLARED_SHAREHOLDING_IN", CO, status="reviewed"), C("c2", CO, "SAME_ENTITY_AS", SUP, identity_basis="GSTIN")]
    assert build_graph(claims, {555})["nodes"] == []


def test_validator_checks_evidence_hash(tmp_path):
    claims_dir = tmp_path / "data" / "claims"
    ev = tmp_path / "data" / "evidence" / "doc.txt"
    ev.parent.mkdir(parents=True)
    ev.write_bytes(b"evidence bytes")
    good = hashlib.sha256(b"evidence bytes").hexdigest()
    scaffold("DIRECTOR_OF", "ok", claims_dir)
    body = yaml.safe_load((claims_dir / "ok.yaml").read_text())
    body.update(subject=P1, object=CO, author="alice")
    body["source"].update(title="t", url="u", page="p", excerpt="e", evidence_path="data/evidence/doc.txt", sha256=good)
    (claims_dir / "ok.yaml").write_text(yaml.safe_dump(body))
    bad = dict(body, id="bad")
    bad["source"] = dict(body["source"], sha256="0" * 64)
    (claims_dir / "bad.yaml").write_text(yaml.safe_dump(bad))
    claims, errors = load_claims(claims_dir, tmp_path)
    assert [c.id for c in claims] == ["ok"]
    assert len(errors) == 1 and "sha256 mismatch" in errors[0]


def test_scaffold_rejects_unknown_predicate(tmp_path):
    import pytest

    with pytest.raises(ValueError):
        scaffold("SAME_SURNAME_AS", "x", tmp_path)
