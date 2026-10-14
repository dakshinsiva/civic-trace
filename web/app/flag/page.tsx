import { Suspense } from "react";

import { Loading } from "@/components/ui";
import { getMeta } from "@/lib/data";

import { FlagView } from "./FlagView";

export const metadata = { title: "Warning sign" };

export default function FlagPage() {
  const rules = getMeta().rules;
  return (
    <Suspense fallback={<Loading what="indicator" />}>
      <FlagView rules={rules} />
    </Suspense>
  );
}
