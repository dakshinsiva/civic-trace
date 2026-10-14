import { Suspense } from "react";

import { Loading, PageTitle } from "@/components/ui";
import { getMeta } from "@/lib/data";

import { TendersExplorer } from "./TendersExplorer";

export const metadata = { title: "Tenders" };

export default function TendersPage() {
  const meta = getMeta();
  return (
    <>
      <PageTitle title="Tenders">
        <p>
          Every tender call in this release, as published on KPPP. A re-tendered work appears once per call. Selected
          suppliers are named exactly as the portal names them.
        </p>
      </PageTitle>
      <Suspense fallback={<Loading what="tenders" />}>
        <TendersExplorer buyers={meta.buyers.map((b) => b.code)} />
      </Suspense>
    </>
  );
}
