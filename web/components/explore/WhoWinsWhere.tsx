"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Fact } from "@/lib/facts";
import { inr } from "@/lib/format";

const MIN_CONTRACTS = 15;

type Market = {
  division: string;
  buyer: string;
  n: number;
  suppliers: { id: number; wins: number; value: number }[];
  top3: number;
  effective: number;
};

/**
 * "Who wins where": for each division, how much of the work went to its top 3
 * contractors, and, on click, each contractor's share against an even split.
 */
export function WhoWinsWhere({ rows, names }: { rows: Fact[]; names: Record<string, string> }) {
  const markets = useMemo(() => {
    const by = new Map<string, Fact[]>();
    for (const r of rows) {
      if (r.selection == null || r.supplier == null) continue;
      const k = `${r.buyer}|${r.division}`;
      (by.get(k) ?? by.set(k, []).get(k)!).push(r);
    }
    const out: Market[] = [];
    for (const [k, rs] of by) {
      const [buyer, division] = k.split("|");
      const m = new Map<number, { wins: number; value: number }>();
      for (const r of rs) {
        const e = m.get(r.supplier!) ?? { wins: 0, value: 0 };
        e.wins += 1;
        e.value += r.bid ?? 0;
        m.set(r.supplier!, e);
      }
      const suppliers = [...m.entries()].map(([id, e]) => ({ id, ...e })).sort((a, b) => b.wins - a.wins);
      const n = rs.length;
      const shares = suppliers.map((s) => s.wins / n);
      const hhi = shares.reduce((a, s) => a + s * s, 0);
      out.push({ division, buyer, n, suppliers, top3: shares.slice(0, 3).reduce((a, b) => a + b, 0), effective: 1 / hhi });
    }
    return out.sort((a, b) => b.top3 - a.top3);
  }, [rows]);

  const big = markets.filter((m) => m.n >= MIN_CONTRACTS);
  const small = markets.length - big.length;
  const [selected, setSelected] = useState<string | null>(null);
  const sel = big.find((m) => `${m.buyer}|${m.division}` === selected) ?? big[0];

  if (!big.length)
    return (
      <p className="text-sm text-muted">
        No division has {MIN_CONTRACTS} or more awarded contracts in this selection yet, which is too few to say anything
        about how the work is shared.
      </p>
    );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <p className="text-xs text-muted mb-2">Share of contracts won by each area&apos;s top 3 contractors. Click an area.</p>
        <ul className="space-y-1 max-h-[420px] overflow-y-auto pr-1" role="listbox" aria-label="Areas">
          {big.map((m) => {
            const key = `${m.buyer}|${m.division}`;
            const active = sel && key === `${sel.buyer}|${sel.division}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={!!active}
                  onClick={() => setSelected(key)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-2 gap-y-1 rounded-md px-2 py-1.5 text-left text-sm sm:grid-cols-[minmax(0,1fr)_7rem_3rem] sm:py-1 ${active ? "bg-surface-2 ring-1 ring-[var(--accent)]" : "hover:bg-surface-2"}`}
                >
                  <span className="col-span-2 sm:col-span-1 sm:truncate" title={m.division}>
                    {m.division} <span className="text-xs text-muted">({m.n})</span>
                  </span>
                  <span className="h-3 rounded-r-[4px] bg-[var(--grid)]">
                    <span className="block h-3 rounded-r-[4px]" style={{ width: `${m.top3 * 100}%`, background: m.top3 >= 0.6 ? "var(--series-2)" : "var(--series-1)" }} />
                  </span>
                  <span className="tabular text-right">{Math.round(m.top3 * 100)}%</span>
                </button>
              </li>
            );
          })}
        </ul>
        {small > 0 && (
          <p className="text-xs text-muted mt-2">
            {small} smaller area{small === 1 ? "" : "s"} with fewer than {MIN_CONTRACTS} contracts not shown.
          </p>
        )}
      </div>
      {sel && <MarketDetail m={sel} names={names} />}
    </div>
  );
}

function MarketDetail({ m, names }: { m: Market; names: Record<string, string> }) {
  const even = 1 / m.suppliers.length;
  const top = m.suppliers.slice(0, 10);
  const rest = m.suppliers.slice(10);
  const restWins = rest.reduce((a, s) => a + s.wins, 0);
  const max = Math.max(...top.map((s) => s.wins / m.n), even);
  return (
    <div className="rounded-md border border-line p-4">
      <h3 className="text-title-m text-ink">{m.division}</h3>
      <p className="text-sm text-ink-2 mt-1">
        {m.n} contracts went to {m.suppliers.length} contractors. Shared evenly, each would have about{" "}
        <strong>{Math.round(even * 100)}%</strong>. The work behaved as if split among about{" "}
        <strong>{m.effective.toFixed(1)}</strong> equal contractors.
      </p>
      <ul className="mt-3 space-y-1.5">
        {top.map((s) => {
          const share = s.wins / m.n;
          return (
            <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-2 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_8rem_4.5rem]">
              <Link href={`/supplier/?id=${s.id}`} className="col-span-2 sm:col-span-1 sm:truncate" title={names[String(s.id)]}>
                {names[String(s.id)] ?? `Supplier ${s.id}`}
              </Link>
              <span className="relative h-3">
                <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${(share / max) * 100}%`, background: "var(--series-1)" }} />
                <span className="absolute -top-1 -bottom-1 w-px bg-[var(--ink-2)]" style={{ left: `${(even / max) * 100}%` }} />
              </span>
              <span className="tabular text-right text-xs">
                {s.wins} · {Math.round(share * 100)}%
              </span>
            </li>
          );
        })}
        {restWins > 0 && (
          <li className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2 text-sm text-muted sm:grid-cols-[minmax(0,1fr)_8rem_4.5rem]">
            <span>{rest.length} others</span>
            <span className="hidden sm:block" />
            <span className="tabular text-right text-xs">
              {restWins} · {Math.round((restWins / m.n) * 100)}%
            </span>
          </li>
        )}
      </ul>
      <p className="text-xs text-muted mt-3">
        Thin vertical line: an even share. Bars show the number of contracts won, not their value; the top contractor&apos;s
        winning bids total {inr(top[0]?.value)}. Winning often is not wrongdoing: local markets for small civil works can be
        genuinely thin.
      </p>
    </div>
  );
}
