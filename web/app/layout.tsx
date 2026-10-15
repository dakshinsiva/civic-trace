import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { AppBar } from "@/components/AppBar";
import { Icon } from "@/components/Icon";
import { LogoMark } from "@/components/Logo";
import { getMeta, hasData, relationshipsEnabled } from "@/lib/data";
import { date } from "@/lib/format";

import "./globals.css";

export const metadata: Metadata = {
  // Absolute base for the share image and other URL metadata (the site is built locally, not on Vercel).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://civictrace-bengaluru.vercel.app"),
  title: { default: "CivicTrace · Bengaluru procurement risk indicators", template: "%s · CivicTrace" },
  description:
    "Open-source, evidence-backed procurement risk indicators for Bengaluru's municipal tenders, built from the Karnataka Public Procurement Portal. Indicators are not findings of wrongdoing.",
};

// Geist and Geist Mono, self-hosted at build time (no request to Google from visitors' browsers).
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const REPO = "https://github.com/dakshinsiva/civic-trace";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const meta = hasData() ? getMeta() : null;
  const rel = relationshipsEnabled();
  return (
    <html lang="en-IN" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased text-body-l">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary">
          Skip to content
        </a>
        <AppBar relationships={rel} />
        <div role="note" className="border-b border-notice-border bg-notice-bg">
          <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2 text-body-s text-ink-2">
            <span className="label-mono mt-px shrink-0 text-notice-ink">Note</span>
            <p>
              <strong className="font-medium text-ink">Warning signs are not proof.</strong> They mark patterns in public records that
              may deserve a closer look, and each comes with the innocent explanations that could account for it. Nothing here
              accuses any person or company of wrongdoing.{" "}
              <Link href="/corrections/" className="text-notice-ink underline">
                Report an error
              </Link>
            </p>
          </div>
        </div>
        {rel && (
          <div role="note" className="bg-critical-soft text-critical">
            <p className="mx-auto max-w-6xl px-4 py-2 text-body-m">
              Internal relationship build: includes the documented-connections layer. Do not deploy this build publicly.
            </p>
          </div>
        )}
        <main id="main" className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
        <footer className="mt-12 border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-body-m text-ink-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-title-m text-ink">
                <LogoMark size={22} />
                CivicTrace
                <span className="label-mono text-muted">Bengaluru</span>
              </p>
              <p className="max-w-2xl">
                Source: Karnataka Public Procurement Portal (kppp.karnataka.gov.in), reproduced with acknowledgement under the
                portal&apos;s copyright policy. Data are shown as published; errors in the source carry through.
              </p>
              {meta && (
                <p className="label-mono normal-case tracking-normal text-muted">
                  Data release {meta.data_version} · records observed up to {date(meta.as_of)} · generated {date(meta.generated_at)}{" "}
                  · pipeline v{meta.pipeline_version}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-end">
              <a href={REPO} className="btn-outline">
                <Icon name="github" size={16} />
                Open source · MIT
              </a>
              <Link href="/coverage/" className="btn-ghost">
                Data coverage
              </Link>
              <Link href="/corrections/" className="btn-ghost">
                Corrections &amp; right of reply
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
