import { Suspense } from "react";

import { Loading } from "@/components/ui";

import { TenderView } from "./TenderView";

export const metadata = { title: "Tender" };

export default function TenderPage() {
  return (
    <Suspense fallback={<Loading what="tender" />}>
      <TenderView />
    </Suspense>
  );
}
