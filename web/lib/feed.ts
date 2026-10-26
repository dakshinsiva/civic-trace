// RSS 2.0 feeds of newly published tenders, rendered to static files at build time.
import "server-only";

import { getMeta, type RecentTender } from "./data";
import { date, inr, statusLabel } from "./format";
import { SITE_NAME, SITE_URL } from "./seo";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function rss({ title, description, path, feedPath, items }: { title: string; description: string; path: string; feedPath: string; items: RecentTender[] }): Response {
  const buyers = Object.fromEntries(getMeta().buyers.map((b) => [b.code, b.name]));
  const entry = (t: RecentTender) => {
    const url = `${SITE_URL}/tender/?id=${t.nit_id}`;
    const facts = [
      buyers[t.buyer] ?? t.buyer,
      t.division,
      t.work_category,
      t.ecv ? `estimate ${inr(t.ecv)}` : null,
      statusLabel(t.status),
      t.close_at ? `bids close ${date(t.close_at)}` : null,
    ].filter(Boolean);
    return [
      "    <item>",
      `      <title>${esc(t.title || t.tender_number)}</title>`,
      `      <link>${esc(url)}</link>`,
      `      <guid isPermaLink="true">${esc(url)}</guid>`,
      `      <pubDate>${new Date(t.published_at).toUTCString()}</pubDate>`,
      `      <category>${esc(t.work_category ?? "Works")}</category>`,
      `      <description>${esc(`${facts.join(" · ")}. Tender ${t.tender_number}.`)}</description>`,
      "    </item>",
    ].join("\n");
  };
  const newest = items[0]?.published_at;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${esc(title)}</title>`,
    `    <link>${esc(`${SITE_URL}${path}`)}</link>`,
    `    <atom:link href="${esc(`${SITE_URL}${feedPath}`)}" rel="self" type="application/rss+xml" />`,
    `    <description>${esc(description)}</description>`,
    "    <language>en-IN</language>",
    `    <generator>${esc(SITE_NAME)}</generator>`,
    newest ? `    <lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>` : "",
    ...items.map(entry),
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((l) => l !== "")
    .join("\n");
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
