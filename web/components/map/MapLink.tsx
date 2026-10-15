"use client";

import Link from "next/link";

import { SCROLL_TO_MAP_KEY } from "../CommandPalette";

/** A link to the home page's map that brings the map into view once it has loaded there. */
export function MapLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try {
          sessionStorage.setItem(SCROLL_TO_MAP_KEY, "1");
        } catch {
          /* storage blocked: the page just opens at the top */
        }
      }}
    >
      {children}
    </Link>
  );
}
