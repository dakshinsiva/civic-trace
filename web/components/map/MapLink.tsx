"use client";

import Link from "next/link";

import { SCROLL_TO_MAP_KEY } from "../CommandPalette";

/**
 * Bring the home page's map into view. On wide screens the place's profile sits beside the map, so the whole block is
 * lined up with the bottom of the window, clear of the sticky filters. On phones the profile is below the map, so the
 * map itself is centred: lining up the block's bottom would leave only the profile on screen.
 */
export function scrollToMap() {
  const target = () => {
    const block = document.getElementById("map");
    if (!block) return null;
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    return { el: wide ? block : ((block.firstElementChild as HTMLElement | null) ?? block), wide };
  };
  const go = () => {
    const t = target();
    t?.el.scrollIntoView({ behavior: "smooth", block: t.wide ? "end" : "center" });
  };
  if (!target()) {
    // The map is not on the page yet (its data is still loading): it scrolls itself into view when it appears.
    try {
      sessionStorage.setItem(SCROLL_TO_MAP_KEY, "1");
    } catch {
      /* storage blocked: the visitor scrolls down themselves */
    }
    return;
  }
  go();
  // On a first visit the page is still filling in above the map as the data arrives, which moves the map and can cut
  // the smooth scroll short. Once it settles, finish the job if the map is still mostly off screen, unless the
  // visitor has started scrolling on their own.
  let moved = false;
  const stop = () => (moved = true);
  const events = ["wheel", "touchmove", "keydown"] as const;
  for (const e of events) window.addEventListener(e, stop, { once: true, passive: true });
  setTimeout(() => {
    for (const e of events) window.removeEventListener(e, stop);
    const r = target()?.el.getBoundingClientRect();
    if (!r || moved) return;
    const visible = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    if (visible < r.height / 2) go();
  }, 900);
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
