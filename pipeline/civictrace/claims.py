"""Evidence-gated relationship claims (data/claims/*.yaml).

A claim is one sourced statement — e.g. "Person X declared a shareholding in
Company Y (affidavit p.12, item 7A(iii))". Claims are never inferred: each is
written by a person from a document, then reviewed by a *different* person.

Hard rules enforced here and in models.Claim:
- only predicates in ALLOWED_PREDICATES;
- verbatim excerpt + page locator + hashed evidence (committed file or Wayback);
- reviewer != author before `reviewed`/`published`;
- SAME_ENTITY_AS needs an official identifier basis — never a name match;
- evidence file hash must match when the file is committed.
"""

from __future__ import annotations

import hashlib
from datetime import date
from pathlib import Path

import yaml
from pydantic import ValidationError

from . import DATA_DIR, REPO_DIR
from .models import ALLOWED_PREDICATES, Claim

CLAIMS_DIR = DATA_DIR / "claims"


def load_claims(claims_dir: Path = CLAIMS_DIR, repo_dir: Path = REPO_DIR) -> tuple[list[Claim], list[str]]:
    claims: list[Claim] = []
    errors: list[str] = []
    seen: set[str] = set()
    for path in sorted(claims_dir.glob("*.yaml")):
        try:
            raw = yaml.safe_load(path.read_text())
            claim = Claim(**raw)
        except (ValidationError, TypeError, yaml.YAMLError) as exc:
            errors.append(f"{path.name}: {exc}")
            continue
        if claim.id in seen:
            errors.append(f"{path.name}: duplicate claim id {claim.id}")
            continue
        seen.add(claim.id)
        ev = claim.source.evidence_path
        if ev:
            ev_path = repo_dir / ev
            if not ev_path.exists():
                errors.append(f"{path.name}: evidence file missing: {ev}")
                continue
            digest = hashlib.sha256(ev_path.read_bytes()).hexdigest()
            if digest != claim.source.sha256:
                errors.append(f"{path.name}: evidence sha256 mismatch for {ev}")
                continue
        claims.append(claim)
    return claims, errors


TEMPLATE = """# Claim: one sourced statement. Fill every field from the document itself.
# Never infer: no relationships from surname, party, constituency, hometown or co-occurrence.
# Allowed predicates:
{predicates}
id: {claim_id}
subject: {{kind: person, id: "", name: ""}}       # kinds: person, company, office, kppp_supplier, tender_call, audit_report, court_case
predicate: {predicate}
object: {{kind: company, id: "", name: ""}}
valid_from: null        # YYYY-MM-DD if the source states a period
valid_to: null
identity_basis: null    # SAME_ENTITY_AS only: CIN, LLPIN, GSTIN, registered_address_and_name, official_cross_reference
qualifier: null         # e.g. office title, or the declared holding as written
source:
  title: ""             # e.g. "Form 26 affidavit, <constituency>, Karnataka Assembly 2023"
  url: ""               # official URL
  page: ""              # e.g. "p. 12, item 7A(iii)"
  excerpt: ""           # VERBATIM text that supports the claim
  evidence_path: null   # data/evidence/<file> (commit the file) ...
  wayback_url: null     # ... or a web.archive.org snapshot URL
  sha256: ""            # sha256 of the evidence file / snapshot bytes
  retrieved_at: "{today}"
status: draft           # draft -> reviewed -> published (reviewer must differ from author)
author: ""
reviewer: null
reviewed_at: null
notes: null
"""


def scaffold(predicate: str, claim_id: str, claims_dir: Path = CLAIMS_DIR) -> Path:
    if predicate not in ALLOWED_PREDICATES:
        raise ValueError(f"predicate must be one of {sorted(ALLOWED_PREDICATES)}")
    claims_dir.mkdir(parents=True, exist_ok=True)
    path = claims_dir / f"{claim_id}.yaml"
    if path.exists():
        raise FileExistsError(path)
    preds = "\n".join(f"#   {k}: {v}" for k, v in ALLOWED_PREDICATES.items())
    path.write_text(TEMPLATE.format(predicates=preds, claim_id=claim_id, predicate=predicate, today=date.today().isoformat()))
    return path
