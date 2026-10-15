"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { inr } from "@/lib/format";
import { areaHref, matchesPlace, wardHref } from "@/lib/places";
import type { Meta, Overview, TenderStub } from "@/lib/types";
import { useJson } from "@/lib/useJson";

import { Icon, type IconName } from "./Icon";

/** Ask the palette to open (the header's search button sends this). */
export const OPEN_SEARCH_EVENT = "civictrace:search";
/** Set before navigating to the home map from another page (see MapLink), so the map scrolls into view once it is there. */
export const SCROLL_TO_MAP_KEY = "civictrace:scroll-to-map";

type Geo<P> = { features: { properties: P }[] };
type Item = { group: string; icon: IconName; title: string; sub?: string; href: string };

const PAGES: Item[] = [
  { group: "Pages", icon: "map", title: "Explore the map", sub: "Where the money goes, area by area", href: "/" },
  { group: "Pages", icon: "map-pin", title: "All areas and wards", sub: "An overview page for every part of the city", href: "/areas/" },
  { group: "Pages", icon: "chart-spline", title: "How widespread is it?", sub: "Findings across all tenders", href: "/findings/" },
  { group: "Pages", icon: "flag", title: "Warning signs", sub: "Every pattern found, with evidence", href: "/flags/" },
  { group: "Pages", icon: "scroll-text", title: "All tenders", sub: "Search and filter every tender", href: "/tenders/" },
  { group: "Pages", icon: "landmark", title: "Departments", sub: "BBMP, GBA and the city corporations", href: "/buyers/" },
  { group: "Pages", icon: "lightbulb", title: "How manipulation works", href: "/patterns/" },
  { group: "Pages", icon: "list-checks", title: "How we check", href: "/methodology/" },
  { group: "Pages", icon: "book-open", title: "Glossary", href: "/glossary/" },
  { group: "Pages", icon: "database", title: "Data coverage", href: "/coverage/" },
  { group: "Pages", icon: "message-square-warning", title: "Report an error", href: "/corrections/" },
];

const GROUP_LIMIT: Record<string, number> = { Places: 5, Pages: 4, "Warning signs": 3, Departments: 3, Contractors: 5, Tenders: 6 };

/** Every word typed must appear (case-insensitive). */
function hasWords(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.every((w) => t.includes(w));
}

/** Site-wide search, opened with ⌘K / Ctrl+K, "/" or the header button. */
export function CommandPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [opened, setOpened] = useState(false); // load the indexes only once someone has opened search
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const { data: wards } = useJson<Geo<{ key: string; name: string; name_kn?: string; ac_no: number; ac: string }>>(opened ? "geo/wards.geojson" : null);
  const { data: areas } = useJson<Geo<{ ac_no: number; name: string; wards: number }>>(opened ? "geo/areas.geojson" : null);
  const { data: meta } = useJson<Meta>(opened ? "meta.json" : null);
  const { data: overview } = useJson<Overview>(opened ? "overview.json" : null);
  const { data: suppliers } = useJson<{ supplier_id: number; name: string; selections: number }[]>(opened ? "suppliers-index.json" : null);
  const { data: tenders, loading: tendersLoading } = useJson<TenderStub[]>(opened ? "tenders-index.json" : null);

  const hide = () => dialog.current?.close();

  // ⌘K / Ctrl+K anywhere; "/" when not already typing; the header button's event.
  useEffect(() => {
    const show = () => {
      setOpened(true);
      setActive(0);
      if (!dialog.current?.open) dialog.current?.showModal();
      requestAnimationFrame(() => input.current?.select());
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else show();
      } else if (e.key === "/" && !typing && !dialog.current?.open) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, []);

  const query = q.trim();
  const results = useMemo<Item[]>(() => {
    if (!query) return PAGES.slice(0, 6);
    const words = query.toLowerCase().split(/\s+/);
    const out: Item[] = [];
    for (const f of areas?.features ?? []) {
      const p = f.properties;
      if (matchesPlace(p.name, query))
        out.push({ group: "Places", icon: "map", title: p.name, sub: `Constituency area · ${p.wards} wards`, href: areaHref(p.name) });
    }
    for (const f of wards?.features ?? []) {
      const p = f.properties;
      if (matchesPlace(p.name, query) || p.name_kn?.includes(query))
        out.push({
          group: "Places",
          icon: "map-pin",
          title: p.name_kn ? `${p.name}  ${p.name_kn}` : p.name,
          sub: `Ward in ${p.ac}`,
          href: wardHref(p.name, p.key),
        });
    }
    for (const page of PAGES) if (hasWords(`${page.title} ${page.sub ?? ""}`, words)) out.push(page);
    for (const r of overview?.rules ?? [])
      if (r.enabled && hasWords(`${r.plain_name} ${r.plain_question ?? ""}`, words))
        out.push({ group: "Warning signs", icon: "flag", title: r.plain_name, sub: `${r.flags.toLocaleString("en-IN")} found`, href: `/flags/?rule=${r.rule_id}` });
    for (const b of meta?.buyers ?? [])
      if (hasWords(`${b.code} ${b.name}`, words)) out.push({ group: "Departments", icon: "landmark", title: b.name, sub: b.code, href: `/buyers/${b.code}/` });
    for (const s of suppliers ?? [])
      if (hasWords(s.name, words))
        out.push({ group: "Contractors", icon: "users", title: s.name, sub: `${s.selections} contract${s.selections === 1 ? "" : "s"} won`, href: `/supplier/?id=${s.supplier_id}` });
    if (query.length >= 3)
      for (const t of tenders ?? []) {
        if (!hasWords(`${t.title} ${t.tender_number} ${t.division}`, words)) continue;
        out.push({
          group: "Tenders",
          icon: "scroll-text",
          title: t.title || t.tender_number,
          sub: [t.buyer, t.division, t.bid_value ? `won at ${inr(t.bid_value)}` : null].filter(Boolean).join(" · "),
          href: `/tender/?id=${t.nit_id}`,
        });
        if (out.filter((i) => i.group === "Tenders").length >= GROUP_LIMIT.Tenders) break;
      }
    // Keep each group short, in a fixed order
    const order = Object.keys(GROUP_LIMIT);
    return order.flatMap((g) => {
      const t = query.toLowerCase();
      const items = out.filter((i) => i.group === g);
      items.sort((a, b) => Number(!a.title.toLowerCase().startsWith(t)) - Number(!b.title.toLowerCase().startsWith(t)));
      return items.slice(0, GROUP_LIMIT[g]);
    });
  }, [query, areas, wards, overview, meta, suppliers, tenders]);

  const go = (item: Item) => {
    hide();
    setQ("");
    router.push(item.href);
  };

  const groups = [...new Set(results.map((r) => r.group))];
  let n = -1;
  return (
    <dialog
      ref={dialog}
      aria-label="Search CivicTrace"
      className="m-0 mx-auto mt-[12vh] w-[min(40rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-lg border border-line-strong bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && hide()}
      onClose={() => setQ("")}
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Icon name="search" size={18} className="text-accent" />
        <input
          ref={input}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
          aria-label="Search places, tenders, contractors and pages"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              go(results[active]);
            }
          }}
          placeholder="Search a ward, tender, contractor or page…"
          className="h-14 flex-1 bg-transparent text-body-l text-ink outline-none placeholder:text-muted"
        />
        <kbd className="label-mono rounded-xs border border-line px-1.5 py-0.5 text-muted">Esc</kbd>
      </div>

      <div id={listId} role="listbox" aria-label="Results" className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
        {!query && <p className="label-mono px-2 pb-1 pt-2 text-muted">Jump to</p>}
        {groups.map((g) => (
          <div key={g} role="group" aria-label={g}>
            {query && <p className="label-mono px-2 pb-1 pt-3 text-muted">{g}</p>}
            {results
              .filter((r) => r.group === g)
              .map((r) => {
                const i = ++n;
                return (
                  <div
                    key={`${g}-${r.href}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(r)}
                    className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 ${i === active ? "bg-accent-soft" : ""}`}
                  >
                    <span className={`avatar h-8 w-8 ${i === active ? "border-accent" : ""}`}>
                      <Icon name={r.icon} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-m text-ink">{r.title}</span>
                      {r.sub && <span className="block truncate text-body-s text-muted">{r.sub}</span>}
                    </span>
                    {i === active && <Icon name="arrow-right" size={16} className="text-accent" />}
                  </div>
                );
              })}
          </div>
        ))}
        {query && !results.length && (
          <p className="px-3 py-6 text-center text-body-m text-ink-2">
            Nothing matches &ldquo;{query}&rdquo;.{" "}
            {tendersLoading ? "Still loading the tender list…" : "Try a ward, a contractor's name, or words from a tender's title."}
          </p>
        )}
        {query.length > 0 && query.length < 3 && <p className="px-3 pb-2 pt-1 text-body-s text-muted">Type 3 or more letters to search tenders too.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-body-s text-muted">
        <span>
          <kbd className="font-mono">↑ ↓</kbd> move
        </span>
        <span>
          <kbd className="font-mono">↵</kbd> open
        </span>
        <span>
          <kbd className="font-mono">esc</kbd> close
        </span>
        <span className="ml-auto">{tendersLoading && opened ? "Loading tenders…" : `${(tenders?.length ?? 0).toLocaleString("en-IN")} tenders searchable`}</span>
      </div>
    </dialog>
  );
}
