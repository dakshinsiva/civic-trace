import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaceOverview } from "@/components/PlaceOverview";
import { inr, num } from "@/lib/format";
import { getWard, wardSlugs } from "@/lib/placeData";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return wardSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getWard(slug);
  if (!p) return {};
  const s = p.stat;
  return pageMetadata({
    feed: { url: `${p.area.href}feed.xml`, title: `New tenders in ${p.area.name}` },
    title: `${p.name} ward, Bengaluru: public works contracts and tenders`,
    description: s
      ? `${num(s.tenders)} public works tenders naming ${p.name} ward (${p.area.name}, Bengaluru) since May 2023: ${inr(s.spend)} in winning bids, who won them and warning signs. From public KPPP records.`
      : `Public works in ${p.name} ward, ${p.area.name} constituency, Bengaluru (Bangalore): contracts, winners and warning signs from public KPPP records.`,
    path: `/wards/${slug}/`,
    geo: { place: `${p.name}, ${p.area.name}, Bengaluru, Karnataka, India`, lat: p.lat, lon: p.lon },
  });
}

export default async function WardPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = getWard((await params).slug);
  if (!p) notFound();
  return <PlaceOverview p={p} />;
}
