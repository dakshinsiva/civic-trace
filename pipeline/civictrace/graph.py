"""Documented-connections graph built only from published claims.

A person appears ONLY if a chain of published claims connects them to a KPPP
supplier that has at least one selection. Holding an office alone never adds a
person. Office claims are attached as context to people who already qualify.
"""

from __future__ import annotations

from collections import defaultdict

from .models import Claim

LINK_PREDICATES = {"DECLARED_SHAREHOLDING_IN", "DECLARED_GOVT_CONTRACT", "DIRECTOR_OF", "SAME_ENTITY_AS"}
CONTEXT_PREDICATES = {"HELD_OFFICE", "COURT_FINDING", "AUDIT_OBSERVATION"}


def _key(ref) -> str:
    return f"{ref.kind}:{ref.id}"


def build_graph(claims: list[Claim], supplier_ids_with_selections: set[int], statuses=("published",)) -> dict:
    usable = [c for c in claims if c.status in statuses]
    adj: dict[str, set[str]] = defaultdict(set)
    edges_by_pair: dict[tuple[str, str], list[Claim]] = defaultdict(list)
    names: dict[str, dict] = {}
    for c in usable:
        a, b = _key(c.subject), _key(c.object)
        names[a] = c.subject.model_dump()
        names[b] = c.object.model_dump()
        if c.predicate in LINK_PREDICATES:
            adj[a].add(b)
            adj[b].add(a)
            edges_by_pair[tuple(sorted((a, b)))].append(c)

    targets = {f"kppp_supplier:{sid}" for sid in supplier_ids_with_selections}

    # People qualify only via LINK predicates reaching a supplier with selections.
    qualified_nodes: set[str] = set()
    for start in [n for n in adj if n.startswith("person:")]:
        seen, stack, parent = {start}, [start], {start: None}
        while stack:
            cur = stack.pop()
            if cur in targets:
                node = cur
                while node is not None:
                    qualified_nodes.add(node)
                    node = parent[node]
            for nxt in adj[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    parent[nxt] = cur
                    stack.append(nxt)

    nodes, edges = [], []
    for n in sorted(qualified_nodes):
        nodes.append(_node(n, names.get(n)))
    for (a, b), cs in edges_by_pair.items():
        if a in qualified_nodes and b in qualified_nodes:
            for c in cs:
                edges.append(_edge(c))
    # Context claims (e.g. offices held) only for already-qualified people.
    for c in usable:
        if c.predicate in CONTEXT_PREDICATES and _key(c.subject) in qualified_nodes:
            obj = _key(c.object)
            if obj not in qualified_nodes:
                nodes.append(_node(obj, c.object.model_dump()))
                qualified_nodes.add(obj)
            edges.append(_edge(c))
    return {"nodes": nodes, "edges": edges}


def _node(key: str, ref: dict | None) -> dict:
    kind, entity_id = key.split(":", 1)
    ref = ref or {}
    return {"id": key, "kind": kind, "entity_id": entity_id, "name": ref.get("name", entity_id)}


def _edge(c: Claim) -> dict:
    return {
        "id": c.id,
        "source": _key(c.subject),
        "target": _key(c.object),
        "predicate": c.predicate,
        "qualifier": c.qualifier,
        "valid_from": c.valid_from,
        "valid_to": c.valid_to,
        "identity_basis": c.identity_basis,
        "evidence": c.source.model_dump(),
        "status": c.status,
        "reviewer": c.reviewer,
        "reviewed_at": c.reviewed_at,
    }
