import { Suspense } from "react";

import { Loading, PageTitle } from "@/components/ui";
import { getMeta, getOverview } from "@/lib/data";

import { FlagsExplorer } from "./FlagsExplorer";

export const metadata = { title: "Warning signs" };

export default function FlagsPage() {
  const meta = getMeta();
  const overview = getOverview();
  return (
    <>
      <PageTitle title="Warning signs">
        <p>
          Every warning sign found so far. Open one to see exactly what was found, what it was compared with, where the
          data comes from, and the innocent explanations. A warning sign is a reason to look closer, never proof.
        </p>
      </PageTitle>
      <Suspense fallback={<Loading what="indicators" />}>
        <FlagsExplorer rules={overview.rules} buyers={meta.buyers.map((b) => b.code)} />
      </Suspense>
    </>
  );
}
