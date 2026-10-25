"use client";

import { useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/Icon";

const noop = () => () => {};
const chip = "flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink hover:border-accent hover:text-accent";

/**
 * Share the page as it is: the address bar already holds the filters, so a shared link opens the
 * same view. Nothing is tracked; each button opens that service's own share page (or the phone's
 * share sheet), and the link itself carries no identifiers.
 */
export function ShareBar({ text, url }: { text: string; url?: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const href = () => url ?? window.location.href;
  const enc = encodeURIComponent;
  const open = (u: string) => window.open(u, "_blank", "noopener,noreferrer");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", href());
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Share this page">
      <span className="label-mono text-muted">Share</span>
      {canNativeShare && (
        <button type="button" className={chip} onClick={() => navigator.share({ title: text, url: href() }).catch(() => {})}>
          <Icon name="share-2" size={14} />
          Share…
        </button>
      )}
      <button type="button" className={chip} onClick={copy} aria-live="polite">
        <Icon name={copied ? "check" : "link"} size={14} />
        {copied ? "Link copied" : "Copy link"}
      </button>
      <button type="button" className={chip} onClick={() => open(`https://wa.me/?text=${enc(`${text} ${href()}`)}`)}>
        <Icon name="message-circle" size={14} />
        WhatsApp
      </button>
      <button type="button" className={chip} onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(href())}`)}>
        <Icon name="linkedin" size={14} />
        LinkedIn
      </button>
      <button type="button" className={chip} onClick={() => open(`https://x.com/intent/post?text=${enc(text)}&url=${enc(href())}`)}>
        X
      </button>
    </div>
  );
}
