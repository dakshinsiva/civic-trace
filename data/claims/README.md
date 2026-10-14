# Relationship claims

One YAML file per sourced statement, scaffolded with:

    cd pipeline && uv run civictrace claims new DECLARED_SHAREHOLDING_IN <short-id>

Rules (enforced by `civictrace claims validate` and the test suite):

- Only allowed predicates: HELD_OFFICE, DECLARED_SHAREHOLDING_IN, DECLARED_GOVT_CONTRACT, DIRECTOR_OF,
  COURT_FINDING, AUDIT_OBSERVATION, SAME_ENTITY_AS.
- A verbatim excerpt, a page/item locator, and evidence: a file committed under `data/evidence/` with a matching
  sha256, or a Wayback snapshot URL.
- SAME_ENTITY_AS needs an official identifier (CIN, LLPIN, GSTIN, registered address + name, or an official
  cross-reference). A similar name is never enough.
- `reviewed`/`published` requires a reviewer who is not the author.
- Never infer: no links from surname, party, constituency, hometown or co-occurrence. Criminal cases from affidavits are
  not recorded.

Published claims appear only in internal builds (`./tasks.sh internal`), never in the public site.
