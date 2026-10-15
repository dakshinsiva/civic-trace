"use client";

import Link from "next/link";

import { SCROLL_TO_MAP_KEY } from "../CommandPalette";

/**
 * Bring the home page's map into view. On wide screens the place's profile sits beside the map, so the whole block is
 * lined up with the bottom of the window, clear of the sticky filters. On phones the profile is below the map, so the
 * map itself is centred: lining up the block's bottom would leave only the profile on screen.
 */
export function scrollToMap() {
  const block = document.getElementById("map");
  if (!block) return;
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  const target = wide ? block : ((block.firstElementChild as HTMLElement | null) ?? block);
  target.scrollIntoView({ behavior: "smooth", block: wide ? "end" : "center" });
}

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
