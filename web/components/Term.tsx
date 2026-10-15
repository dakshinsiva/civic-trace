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
        // On touch screens the tap also focuses the button, so a toggle here would close it again: click only opens.
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="cursor-help border-b border-dotted border-current text-inherit"
      >
        {children ?? g.term}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="tooltip absolute left-0 top-full z-20 mt-1 w-72 px-4 py-3 text-left font-normal normal-case tracking-normal"
        >
          <span className="mb-1 block text-title-s text-ink">{g.term}</span>
          {g.plain}
        </span>
      )}
    </span>
  );
}
