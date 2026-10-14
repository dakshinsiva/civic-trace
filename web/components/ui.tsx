import Link from "next/link";

import { humanKey, inr, num, pct } from "@/lib/format";
import type { FlagStub } from "@/lib/types";

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="text-sm text-muted mb-1">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold text-ink text-balance">{title}</h1>
      {children && <div className="mt-2 max-w-3xl text-ink-2">{children}</div>}
    </div>
  );
}

export function Section({ n, title, children, id }: { n?: number; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="card p-5">
      <h2 className="text-base font-semibold text-ink mb-3">
        {n !== undefined && <span className="text-muted mr-2 tabular">{n}.</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold text-ink mt-0.5">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

const MONEY_KEYS = /value|ecv|estimate|bid$|amount/i;
const SHARE_KEYS = /share|rate$/i;

export function formatValue(k: string, v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (MONEY_KEYS.test(k) && !/ratio|share/i.test(k) && Math.abs(v) > 1000) return inr(v);
    if (SHARE_KEYS.test(k) && v <= 1) return pct(v, 1);
    if (/ratio/i.test(k)) return `${v.toFixed(3)}×`;
    if (/p_value|q_value/.test(k)) return v.toPrecision(3);
    return num(v, Number.isInteger(v) ? 0 : 2);
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === "object") {
      return (
        <ul className="space-y-0.5">
          {v.map((item, i) => (
            <li key={i}>
              {Object.entries(item as Record<string, unknown>)
                .map(([ik, iv]) => `${humanKey(ik)}: ${typeof iv === "number" && /share/.test(ik) ? pct(iv, 1) : String(iv)}`)
                .join(" · ")}
            </li>
          ))}
        </ul>
      );
    }
    return v.join(", ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  }
  return String(v);
}

export function KV({ data, skip = [] }: { data: Record<string, unknown>; skip?: string[] }) {
  const entries = Object.entries(data).filter(([k]) => !skip.includes(k));
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,16rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-2">{humanKey(k)}</dt>
          <dd className="text-ink tabular break-words">{formatValue(k, v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RuleBadge({ n, name }: { n: number; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-2 whitespace-nowrap">
      <span className="font-semibold tabular">R{n}</span>
      {name}
    </span>
  );
}

export function FlagList({ flags, empty = "No warning signs for this record." }: { flags: FlagStub[]; empty?: string }) {
  if (!flags.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {flags.map((f) => (
        <li key={f.flag_id} className="text-sm">
          <RuleBadge n={f.rule_number} name={f.rule_plain_name ?? f.rule_name} />{" "}
          <Link href={`/flag/?id=${f.flag_id}`}>{f.headline}</Link>
        </li>
      ))}
    </ul>
  );
}

export function Loading({ what }: { what: string }) {
  return <p className="text-muted">Loading {what}…</p>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="card p-4 text-sm">
      <p className="text-ink">{message}</p>
      <p className="text-muted mt-1">
        Records can disappear from a release when they are suppressed during a correction, or when a newer release has
        replaced them. See <Link href="/corrections/">corrections</Link>.
      </p>
    </div>
  );
}
