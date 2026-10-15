import { Suspense } from "react";

import { Loading } from "@/components/ui";
import { getMeta } from "@/lib/data";

import { FlagView } from "./FlagView";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Warning sign",
  description:
    "A warning sign found in a Bengaluru public works tender, with its evidence, what it was compared with and the innocent explanations.",
  path: "/flag/",
});

export default function FlagPage() {
  const rules = getMeta().rules;
  return (
    <Suspense fallback={<Loading what="indicator" />}>
      <FlagView rules={rules} />
    </Suspense>
  );
}
