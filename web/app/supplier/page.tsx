import type { Metadata } from "next";
import { Suspense } from "react";

import { Loading } from "@/components/ui";
import { relationshipsEnabled } from "@/lib/data";

import { SupplierView } from "./SupplierView";

// Many contractors are sole proprietors whose firm name is a person's name:
// keep supplier pages out of search engines.
export const metadata: Metadata = { title: "Supplier", robots: { index: false, follow: true } };

export default function SupplierPage() {
  return (
    <Suspense fallback={<Loading what="supplier" />}>
      <SupplierView relationships={relationshipsEnabled()} />
    </Suspense>
  );
}
