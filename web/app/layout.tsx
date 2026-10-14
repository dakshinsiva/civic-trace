import type { Metadata } from "next";
import Link from "next/link";

import { getMeta, hasData, relationshipsEnabled } from "@/lib/data";
import { date } from "@/lib/format";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CivicTrace · Bengaluru procurement risk indicators", template: "%s · CivicTrace" },
  description:
    "Open-source, evidence-backed procurement risk indicators for Bengaluru's municipal tenders, built from the Karnataka Public Procurement Portal. Indicators are not findings of wrongdoing.",
};

const NAV = [
  { href: "/", label: "Explore" },
  { href: "/flags/", label: "Warning signs" },
  { href: "/tenders/", label: "All tenders" },
  { href: "/buyers/", label: "Departments" },
  { href: "/patterns/", label: "How manipulation works" },
  { href: "/methodology/", label: "How we check" },
  { href: "/glossary/", label: "Glossary" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const meta = hasData() ? getMeta() : null;
  const rel = relationshipsEnabled();
  return (
    <html lang="en-IN">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="font-semibold text-ink no-underline hover:no-underline">
              CivicTrace <span className="font-normal text-muted">· Bengaluru</span>
            </Link>
            <nav aria-label="Main" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink-2">
                  {n.label}
                </Link>
              ))}
              {rel && (
                <Link href="/connections/" className="text-ink-2">
                  Documented connections
                </Link>
              )}
            </nav>
          </div>
        </header>
        <div role="note" className="border-b border-notice-border bg-notice-bg text-notice-ink">
          <p className="mx-auto max-w-6xl px-4 py-2 text-sm">
            <strong>Warning signs are not proof.</strong> They mark patterns in public records that may deserve a closer
            look, and each comes with the innocent explanations that could account for it. Nothing here accuses any person
            or company of wrongdoing.{" "}
            <Link href="/corrections/" className="underline text-notice-ink">
              Report an error
            </Link>
            .
          </p>
        </div>
        {rel && (
          <div role="note" className="border-b border-line bg-surface-2">
            <p className="mx-auto max-w-6xl px-4 py-2 text-sm text-ink-2">
              Internal relationship build: includes the documented-connections layer. Do not deploy this build publicly.
            </p>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted space-y-1">
            <p>
              Source: Karnataka Public Procurement Portal (kppp.karnataka.gov.in), reproduced with acknowledgement under the
              portal&apos;s copyright policy. Data are shown as published; errors in the source carry through.
            </p>
            {meta && (
              <p className="tabular">
                Data release {meta.data_version} · records observed up to {date(meta.as_of)} · generated {date(meta.generated_at)} ·
                pipeline v{meta.pipeline_version}
              </p>
            )}
            <p>
              Open source (MIT). <Link href="/coverage/">Data coverage</Link> · <Link href="/corrections/">Corrections &amp; right of reply</Link>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
