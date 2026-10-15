import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civictrace-blr.vercel.app";

export default function robots(): MetadataRoute.Robots {
  // Contractor pages stay crawlable so search engines can see their noindex (deploy/vercel.json and the page
  // metadata); blocking them here would hide that instruction.
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: `${SITE}/sitemap.xml` };
}
