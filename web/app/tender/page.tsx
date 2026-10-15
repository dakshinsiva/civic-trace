import { Suspense } from "react";

import { Loading } from "@/components/ui";

import { TenderView } from "./TenderView";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Tender",
  description:
    "A Bengaluru public works tender: the official estimate, every company that bid and its price, the winner, the deadlines and any warning signs.",
  path: "/tender/",
});

export default function TenderPage() {
  return (
    <Suspense fallback={<Loading what="tender" />}>
      <TenderView />
    </Suspense>
  );
}
