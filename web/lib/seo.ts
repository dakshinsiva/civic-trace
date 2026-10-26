// Search and sharing metadata shared by every page: title, description, canonical URL, Open Graph, Twitter and
// geo tags. Child segments replace (not merge) openGraph/twitter/other, so each page gets the full set from here.
import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civictrace-bengaluru.vercel.app";
export const SITE_NAME = "CivicTrace Bengaluru";
export const AUTHOR = {
  name: "Dakshin Raj Siva",
  email: "dakshinrajsiva@gmail.com",
  linkedin: "https://www.linkedin.com/in/dakshinsiva/",
  github: "https://github.com/dakshinsiva",
};
export const REPO = "https://github.com/dakshinsiva/civic-trace";
/** City centre, for pages that are about the whole city. */
export const BENGALURU = { place: "Bengaluru, Karnataka, India", lat: 12.9716, lon: 77.5946 };

export type Geo = { place: string; lat: number; lon: number };

// The share card (app/opengraph-image.png). Set explicitly: a page that defines its own openGraph block would
// otherwise lose the file-based image.
const SHARE_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "CivicTrace Bengaluru: see who gets the public works contracts in your area of Bengaluru.",
};

/** geo.region / geo.placename / geo.position / ICBM meta tags. */
export function geoTags(g: Geo = BENGALURU): Record<string, string> {
  const lat = g.lat.toFixed(5);
  const lon = g.lon.toFixed(5);
  return { "geo.region": "IN-KA", "geo.placename": g.place, "geo.position": `${lat};${lon}`, ICBM: `${lat}, ${lon}` };
}

export function pageMetadata({
  title,
  description,
  path,
  geo,
  robots,
  feed = { url: "/feed.xml", title: "New public works tenders in Bengaluru" },
}: {
  title: string;
  description: string;
  /** Canonical path, e.g. "/wards/horamavu-east-2/". */
  path: string;
  geo?: Geo;
  robots?: Metadata["robots"];
  /** RSS feed for this page (defaults to the citywide feed of new tenders). */
  feed?: { url: string; title: string };
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path, types: { "application/rss+xml": [feed] } },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", url: path, title, description, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
    other: geoTags(geo),
    ...(robots ? { robots } : {}),
  };
}

/** Schema.org author, reused in structured data. */
export const authorLd = {
  "@type": "Person",
  name: AUTHOR.name,
  email: `mailto:${AUTHOR.email}`,
  url: AUTHOR.github,
  sameAs: [AUTHOR.linkedin, AUTHOR.github],
};
