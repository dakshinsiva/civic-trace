"use client";

import { useEffect, useState } from "react";

type State<T> = { data: T | null; error: string | null; loading: boolean };
type Result = { path: string; data: unknown; error: string | null };

// Small in-memory cache so repeated hovers/navigation don't refetch the same file.
const cache = new Map<string, Result>();

/** Fetch a JSON file from the static data release (public/data). */
export function useJson<T>(path: string | null): State<T> {
  const [result, setResult] = useState<Result | null>(() => (path ? cache.get(path) ?? null : null));

  useEffect(() => {
    if (!path || cache.has(path)) return;
    let alive = true;
    fetch(`/data/${path}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Record not found in this data release." : `HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => ({ path, data, error: null }))
      .catch((e: Error) => ({ path, data: null, error: e.message }))
      .then((res) => {
        if (!res.error) cache.set(path, res);
        if (alive) setResult(res);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) return { data: null, error: "No record specified.", loading: false };
  const res = result?.path === path ? result : cache.get(path);
  if (!res) return { data: null, error: null, loading: true };
  return { data: res.data as T, error: res.error, loading: false };
}

// Per-record files are grouped into buckets by the exporter (pipeline/civictrace/export.py).
const BUCKETS = { tenders: 256, suppliers: 64 } as const;

export function recordPath(kind: "tenders" | "suppliers" | "flags", id: string): string {
  if (kind === "flags") return `flags/b${id.slice(0, 2)}.json`;
  return `${kind}/b${String(Number(id) % BUCKETS[kind]).padStart(3, "0")}.json`;
}

/** Load one tender, supplier or flag from its bucket file. */
export function useRecord<T>(kind: "tenders" | "suppliers" | "flags", id: string | null): State<T> {
  const st = useJson<Record<string, T>>(id ? recordPath(kind, id) : null);
  if (!id) return { data: null, error: "No record specified.", loading: false };
  if (st.loading || st.error) return { data: null, error: st.error, loading: st.loading };
  const rec = st.data?.[id];
  return rec ? { data: rec, error: null, loading: false } : { data: null, error: "Record not found in this data release.", loading: false };
}
