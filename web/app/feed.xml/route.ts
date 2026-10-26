import { getRecent } from "@/lib/data";
import { rss } from "@/lib/feed";

export const dynamic = "force-static";

/** Newly published Bengaluru public works tenders, citywide. */
export function GET() {
  const r = getRecent();
  return rss({
    title: "CivicTrace Bengaluru: new public works tenders",
    description: "Public works tenders newly published by BBMP, the Greater Bengaluru Authority and the city corporations on the Karnataka Public Procurement Portal.",
    path: "/",
    feedPath: "/feed.xml",
    items: r.tenders.slice(0, r.city_latest),
  });
}
