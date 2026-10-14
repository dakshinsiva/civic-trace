import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Loading, PageTitle } from "@/components/ui";
import { relationshipsEnabled } from "@/lib/data";

import { ConnectionsView } from "./ConnectionsView";

export const metadata = { title: "Documented connections", robots: { index: false, follow: false } };

export default function ConnectionsPage() {
  // Public builds never include this page or its data (see export --include-relationships).
  if (!relationshipsEnabled()) notFound();
  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Internal build only" title="Documented connections">
        <p>
          Links between people, companies, offices and KPPP suppliers. Each link appears only when a cited official document
          states it explicitly and a second person has reviewed it. A person appears only if a complete chain of such links
          reaches a supplier with selected bids. Holding an office alone never puts anyone here.
        </p>
      </PageTitle>
      <div role="note" className="rounded-md border border-notice-border bg-notice-bg px-4 py-3 text-sm text-notice-ink">
        Each link is documented separately. Seeing them together does not show that any official influenced any award.
      </div>
      <Suspense fallback={<Loading what="graph" />}>
        <ConnectionsView />
      </Suspense>
    </div>
  );
}
