"use client";

import { useId, useState } from "react";

import { GLOSSARY } from "@/lib/glossary";

/** A word with a plain-language definition on hover, focus or tap. */
export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: React.ReactNode }) {
  const g = GLOSSARY[k];
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!g) return <>{children}</>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="cursor-help border-b border-dotted border-[var(--ink-2)] text-inherit"
      >
        {children ?? g.term}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-line bg-surface p-3 text-left text-xs font-normal leading-relaxed text-ink shadow-lg"
        >
          <span className="block font-semibold mb-0.5">{g.term}</span>
          {g.plain}
        </span>
      )}
    </span>
  );
}
