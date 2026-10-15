import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/ui";
import { getMeta, getOverview } from "@/lib/data";
import { num } from "@/lib/format";

export const metadata = { title: "Departments" };

export default function BuyersPage() {
  const meta = getMeta();
  const o = getOverview();
  const byCode = Object.fromEntries(meta.buyers.map((b) => [b.code, b]));
  return (
    <>
      <PageTitle title="Departments">
        <p>
          Procuring entities covered in this release. BBMP was replaced from 15 May 2025 by the Greater Bengaluru Authority
          and five city corporations; older tenders keep the BBMP name on the portal.
        </p>
      </PageTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {o.by_buyer.map((b) => (
          <Link key={b.code} href={`/buyers/${b.code}/`} className="card state flex gap-4 p-4 text-ink no-underline hover:no-underline">
            <span className="avatar">
              <Icon name="landmark" size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-title-m text-ink">
                {b.code} <span className="text-ink-2">· {b.name}</span>
              </div>
              <div className="text-body-m text-muted mt-1 tabular">
                {num(b.calls)} tenders · {num(b.selections)} winners chosen · {num(b.suppliers)} {b.suppliers === 1 ? "contractor" : "contractors"}
              </div>
              {byCode[b.code]?.note && <div className="text-body-s text-muted mt-1">{byCode[b.code].note}</div>}
            </div>
            <Icon name="chevron-right" size={24} className="self-center text-ink-2" />
          </Link>
        ))}
      </div>
    </>
  );
}
