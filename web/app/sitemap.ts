import type { MetadataRoute } from "next";

import { getOverview, hasData } from "@/lib/data";
import { areaSlugs, wardSlugs } from "@/lib/placeData";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civictrace-blr.vercel.app";

// Pages with their own address. Tender, contractor and warning-sign pages are read from the URL query in the browser,
// and contractor pages are kept out of search engines on purpose, so they are not listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/findings/", "/areas/", "/flags/", "/tenders/", "/buyers/", "/patterns/", "/methodology/", "/glossary/", "/coverage/", "/corrections/"];
  const out: MetadataRoute.Sitemap = pages.map((p) => ({ url: `${SITE}${p}`, changeFrequency: "weekly", priority: p === "/" ? 1 : 0.6 }));
  if (!hasData()) return out;
  for (const b of getOverview().by_buyer) out.push({ url: `${SITE}/buyers/${b.code}/`, changeFrequency: "weekly", priority: 0.5 });
  for (const s of areaSlugs()) out.push({ url: `${SITE}/areas/${s}/`, changeFrequency: "weekly", priority: 0.8 });
  for (const s of wardSlugs()) out.push({ url: `${SITE}/wards/${s}/`, changeFrequency: "weekly", priority: 0.7 });
  return out;
}
