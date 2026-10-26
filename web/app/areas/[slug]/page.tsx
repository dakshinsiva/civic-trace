import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaceOverview } from "@/components/PlaceOverview";
import { inr, num } from "@/lib/format";
import { areaSlugs, getArea } from "@/lib/placeData";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return areaSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = getArea((await params).slug);
  if (!p) return {};
  const s = p.stat;
  return pageMetadata({
    feed: { url: `${p.area.href}feed.xml`, title: `New tenders in ${p.area.name}` },
    title: `${p.name}, Bengaluru: public works contracts and tenders`,
    description: s
      ? `${num(s.tenders)} public works tenders in ${p.name} constituency, Bengaluru (Bangalore), since May 2023: ${inr(s.spend)} in winning bids, who won them, how many companies competed, and warning signs. From public KPPP records.`
      : `Public works tenders in ${p.name} constituency, Bengaluru (Bangalore): who won them and what they cost. From public KPPP records.`,
    path: p.area.href,
    geo: { place: `${p.name}, Bengaluru, Karnataka, India`, lat: p.lat, lon: p.lon },
  });
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = getArea((await params).slug);
  if (!p) notFound();
  return <PlaceOverview p={p} />;
}
