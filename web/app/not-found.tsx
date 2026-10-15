import Link from "next/link";

import { Icon } from "@/components/Icon";
import { LogoMark } from "@/components/Logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <LogoMark size={56} className="mx-auto text-ink" />
      <p className="label-mono mt-6 text-accent">404</p>
      <h1 className="mt-2 text-headline-m text-ink">This page isn&apos;t on the map</h1>
      <p className="mt-3 text-body-l text-ink-2">
        The link may be old, or the record may have moved in a newer data release. Start from the map, or search all tenders.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          <Icon name="map" size={16} />
          Back to the map
        </Link>
        <Link href="/tenders/" className="btn-outline">
          <Icon name="search" size={16} />
          Search all tenders
        </Link>
      </div>
    </div>
  );
}
