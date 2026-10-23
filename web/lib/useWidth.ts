"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Width of an element in CSS pixels, kept up to date as it resizes. Charts draw their SVG at
 * this width (one unit = one pixel), so axis text stays at its real size on phones and wide
 * screens alike instead of shrinking with a fixed viewBox.
 */
export function useWidth<T extends HTMLElement = HTMLDivElement>(initial = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
