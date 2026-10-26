import { getRecent } from "@/lib/data";
import { rss } from "@/lib/feed";
import { areaSlugs, getArea } from "@/lib/placeData";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return areaSlugs().map((slug) => ({ slug }));
}

/** Newly published tenders for one constituency area. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = getArea(slug);
  const r = getRecent();
  const items = area ? r.tenders.filter((t) => String(t.ac) === area.id).slice(0, r.per_area) : [];
  return rss({
    title: `CivicTrace Bengaluru: new tenders in ${area?.name ?? slug}`,
    description: `Public works tenders newly published for the ${area?.name ?? slug} constituency area of Bengaluru, from the Karnataka Public Procurement Portal.`,
    path: area?.area.href ?? "/areas/",
    feedPath: `/areas/${slug}/feed.xml`,
    items,
  });
}
