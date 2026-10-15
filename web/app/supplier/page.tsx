import type { Metadata } from "next";
import { Suspense } from "react";

import { Loading } from "@/components/ui";
import { relationshipsEnabled } from "@/lib/data";

import { SupplierView } from "./SupplierView";
import { pageMetadata } from "@/lib/seo";

// Many contractors are sole proprietors whose firm name is a person's name:
// keep supplier pages out of search engines.
// Many contractors are individuals trading under their own names, so these pages stay out of search results.
export const metadata: Metadata = pageMetadata({
  title: "Contractor",
  description: "Public works contracts won by one contractor in Bengaluru, as published on the Karnataka procurement portal.",
  path: "/supplier/",
  robots: { index: false, follow: true },
});

export default function SupplierPage() {
  return (
    <Suspense fallback={<Loading what="supplier" />}>
      <SupplierView relationships={relationshipsEnabled()} />
    </Suspense>
  );
}
