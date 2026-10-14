import Link from "next/link";

import { PageTitle } from "@/components/ui";
import { getMeta, getOverview } from "@/lib/data";
import { num } from "@/lib/format";

export const metadata = { title: "Buyers" };

export default function BuyersPage() {
  const meta = getMeta();
  const o = getOverview();
  const byCode = Object.fromEntries(meta.buyers.map((b) => [b.code, b]));
  return (
    <>
      <PageTitle title="Buyers">
        <p>
          Procuring entities covered in this release. BBMP was replaced from 15 May 2025 by the Greater Bengaluru Authority
          and five city corporations; older tenders keep the BBMP name on the portal.
        </p>
      </PageTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {o.by_buyer.map((b) => (
          <Link key={b.code} href={`/buyers/${b.code}/`} className="card p-4 no-underline hover:no-underline hover:border-[var(--accent)]">
            <div className="font-semibold text-ink">
              {b.code} <span className="font-normal text-ink-2">· {b.name}</span>
            </div>
            <div className="text-sm text-muted mt-1 tabular">
              {num(b.calls)} tender calls · {num(b.selections)} selections · {num(b.suppliers)} suppliers
            </div>
            {byCode[b.code]?.note && <div className="text-xs text-muted mt-1">{byCode[b.code].note}</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
