"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Loading, Section } from "@/components/ui";
import type { Graph } from "@/lib/types";
import { useJson } from "@/lib/useJson";

const PREDICATE_LABEL: Record<string, string> = {
  HELD_OFFICE: "held office",
  DECLARED_SHAREHOLDING_IN: "declared shareholding in",
  DECLARED_GOVT_CONTRACT: "declared government contract",
  DIRECTOR_OF: "director of",
  COURT_FINDING: "court finding",
  AUDIT_OBSERVATION: "audit observation",
  SAME_ENTITY_AS: "same legal entity as",
};

export function ConnectionsView() {
  const focus = useSearchParams().get("focus");
  const { data, loading, error } = useJson<Graph>("relationships/graph.json");
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!data || !ref.current || !data.nodes.length) return;
    let destroyed = false;
    let cy: { destroy: () => void } | null = null;
    import("cytoscape").then(({ default: cytoscape }) => {
      if (destroyed || !ref.current) return;
      const css = getComputedStyle(document.documentElement);
      const ink = css.getPropertyValue("--ink").trim();
      const s1 = css.getPropertyValue("--series-1").trim();
      const s2 = css.getPropertyValue("--series-2").trim();
      const axis = css.getPropertyValue("--axis").trim();
      const inst = cytoscape({
        container: ref.current,
        elements: [
          ...data.nodes.map((n) => ({ data: { id: n.id, label: n.name, kind: n.kind } })),
          ...data.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, label: PREDICATE_LABEL[e.predicate] ?? e.predicate } })),
        ],
        style: [
          { selector: "node", style: { label: "data(label)", color: ink, "font-size": 11, "text-valign": "bottom", "text-margin-y": 4, "background-color": axis, width: 14, height: 14 } },
          { selector: 'node[kind = "person"]', style: { "background-color": s2, shape: "ellipse" } },
          { selector: 'node[kind = "kppp_supplier"]', style: { "background-color": s1, shape: "round-rectangle" } },
          { selector: "edge", style: { label: "data(label)", "font-size": 9, color: ink, "curve-style": "bezier", width: 2, "line-color": axis, "target-arrow-shape": "triangle", "target-arrow-color": axis } },
          { selector: ":selected", style: { "border-width": 2, "border-color": ink } },
        ],
        layout: { name: "cose", animate: false },
      });
      inst.on("tap", "edge", (evt) => setSelected(evt.target.id()));
      if (focus) inst.getElementById(focus).select();
      cy = inst;
    });
    return () => {
      destroyed = true;
      cy?.destroy();
    };
  }, [data, focus]);

  if (loading) return <Loading what="graph" />;
  if (error) return <p className="text-sm text-muted">No relationships file in this build ({error}).</p>;
  if (!data || !data.nodes.length)
    return (
      <Section title="No published connections yet">
        <p className="text-sm text-ink-2">
          No claim has completed review, so nothing is shown. Claims are written by hand from official documents as YAML
          files in <code>data/claims/</code> (<code>civictrace claims new</code>), then validated and reviewed by a second
          person before publication.
        </p>
      </Section>
    );

  const edge = data.edges.find((e) => e.id === selected);
  const nameOf = (id: string) => data.nodes.find((n) => n.id === id)?.name ?? id.split(":")[1];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div ref={ref} className="card h-[560px]" aria-label="Documented connections graph" />
      <div className="space-y-3">
        <Section title={edge ? "Evidence for this link" : "Select a link"}>
          {edge ? (
            <dl className="text-sm space-y-1.5">
              <dt className="text-ink-2">Claim</dt>
              <dd>
                {nameOf(edge.source)} — {PREDICATE_LABEL[edge.predicate]} — {nameOf(edge.target)}
                {edge.qualifier && <div className="text-ink-2">{edge.qualifier}</div>}
              </dd>
              {(edge.valid_from || edge.valid_to) && (
                <>
                  <dt className="text-ink-2">Period</dt>
                  <dd>
                    {edge.valid_from ?? "?"} – {edge.valid_to ?? "present"}
                  </dd>
                </>
              )}
              {edge.identity_basis && (
                <>
                  <dt className="text-ink-2">Identity basis</dt>
                  <dd>{edge.identity_basis}</dd>
                </>
              )}
              <dt className="text-ink-2">Source</dt>
              <dd>
                <a href={edge.evidence.url} target="_blank" rel="noopener noreferrer">
                  {edge.evidence.title}
                </a>{" "}
                · {edge.evidence.page}
              </dd>
              <dt className="text-ink-2">Excerpt</dt>
              <dd className="italic">&ldquo;{edge.evidence.excerpt}&rdquo;</dd>
              <dt className="text-ink-2">Reviewed</dt>
              <dd>
                {edge.reviewer} · {edge.reviewed_at}
              </dd>
            </dl>
          ) : (
            <p className="text-sm text-muted">Click a link in the graph to see the document that supports it.</p>
          )}
        </Section>
        <Section title="All links">
          <ul className="text-sm space-y-1">
            {data.edges.map((e) => (
              <li key={e.id}>
                <button className="text-left text-accent hover:underline" onClick={() => setSelected(e.id)}>
                  {nameOf(e.source)} — {PREDICATE_LABEL[e.predicate]} — {nameOf(e.target)}
                </button>
                {e.target.startsWith("kppp_supplier:") && (
                  <Link className="ml-1 text-xs" href={`/supplier/?id=${e.target.split(":")[1]}`}>
                    supplier
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
