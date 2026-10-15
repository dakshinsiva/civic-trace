import Link from "next/link";

import { PageTitle } from "@/components/ui";
import { inr, num } from "@/lib/format";
import { allAreas } from "@/lib/placeData";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Bengaluru wards and constituencies: public works by area",
  description:
    "Every Bengaluru (Bangalore) assembly constituency and ward, with the public works tenders, winning bids and contractors in each. From public KPPP records.",
  path: "/areas/",
});

export default function AreasPage() {
  const areas = allAreas();
  return (
    <>
      <PageTitle eyebrow="Areas and wards" title="Public works in every part of Bengaluru">
        <p>
          The city&apos;s 28 assembly constituencies and 369 wards on the 2025 ward map. Each page shows the contracts placed there,
          the money in winning bids, who won the work and any warning signs.
        </p>
      </PageTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {areas.map((a) => (
          <section key={a.href} className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-title-m">
                <Link href={a.href}>{a.name}</Link>
              </h2>
              <span className="whitespace-nowrap font-mono text-body-s text-ink-2">
                {num(a.tenders)} tenders · {inr(a.spend)}
              </span>
            </div>
            <p className="mt-0.5 text-body-s text-muted">
              {a.corporations.join(", ")} · {num(a.population)} residents · {a.wards.length} wards
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-body-s">
              {a.wards.map((w) => (
                <li key={w.href}>
                  <Link href={w.href} className={w.tenders ? "" : "text-muted"}>
                    {w.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
