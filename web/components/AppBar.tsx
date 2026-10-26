"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CommandPalette, OPEN_SEARCH_EVENT } from "./CommandPalette";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";

const REPO = "https://github.com/dakshinsiva/civic-trace";

type NavItem = { href: string; label: string; icon: IconName; also?: string[] };

const PRIMARY: NavItem[] = [
  { href: "/", label: "Explore", icon: "map" },
  { href: "/areas/", label: "Areas", icon: "map-pin", also: ["/wards/"] },
  { href: "/findings/", label: "How widespread?", icon: "chart-spline" },
  { href: "/flags/", label: "Warning signs", icon: "flag", also: ["/flag/"] },
  { href: "/tenders/", label: "All tenders", icon: "scroll-text", also: ["/tender/", "/supplier/"] },
  { href: "/buyers/", label: "Departments", icon: "landmark" },
];

const LEARN: NavItem[] = [
  { href: "/patterns/", label: "How manipulation works", icon: "lightbulb" },
  { href: "/methodology/", label: "How we check", icon: "list-checks" },
  { href: "/glossary/", label: "Glossary", icon: "book-open" },
  { href: "/open-data/", label: "Open data", icon: "download" },
  { href: "/coverage/", label: "Data coverage", icon: "database" },
  { href: "/corrections/", label: "Report an error", icon: "message-square-warning" },
];

const INTERNAL: NavItem = { href: "/connections/", label: "Documented connections", icon: "network" };

function isActive(path: string, item: NavItem): boolean {
  const p = path.replace(/\/?$/, "/");
  if (item.href === "/") return p === "/";
  return [item.href, ...(item.also ?? [])].some((h) => p.startsWith(h));
}

/** M3 top app bar. Wide screens show the main destinations; phones get a navigation drawer. */
export function AppBar({ relationships }: { relationships: boolean }) {
  const path = usePathname() ?? "/";
  const drawer = useRef<HTMLDialogElement>(null);
  const [learnOpen, setLearnOpen] = useState(false);
  const learnRef = useRef<HTMLDivElement>(null);
  const primary = relationships ? [...PRIMARY, INTERNAL] : PRIMARY;
  // Show the shortcut the visitor's keyboard actually has (server render assumes a Mac).
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );
  const learnActive = LEARN.some((i) => isActive(path, i));

  // Close the "Learn" menu on outside click or Escape
  useEffect(() => {
    if (!learnOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!learnRef.current?.contains(e.target as Node)) setLearnOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLearnOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [learnOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--page)_80%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-2 sm:px-4">
        <button type="button" className="icon-btn lg:hidden" aria-label="Open navigation" onClick={() => drawer.current?.showModal()}>
          <Icon name="menu" size={20} />
        </button>
        <Link href="/" className="mr-4 rounded-md no-underline hover:no-underline" aria-label="CivicTrace home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-0.5 lg:flex">
          {primary.map((item) => {
            const on = isActive(path, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`state flex h-8 items-center whitespace-nowrap rounded-md px-3 text-body-m no-underline hover:no-underline ${on ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="relative" ref={learnRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={learnOpen}
              onClick={() => setLearnOpen((o) => !o)}
              className={`state flex h-8 items-center gap-1 rounded-md pl-3 pr-2 text-body-m ${learnActive ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              Learn
              <Icon name="chevron-down" size={16} className={`transition-transform ${learnOpen ? "rotate-180" : ""}`} />
            </button>
            {learnOpen && (
              <div role="menu" className="tooltip absolute right-0 top-full mt-2 w-64 p-1.5">
                {LEARN.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={isActive(path, item) ? "page" : undefined}
                    onClick={() => setLearnOpen(false)}
                    className="state flex h-10 items-center gap-3 rounded-sm px-2.5 text-body-m text-ink no-underline hover:no-underline"
                  >
                    <Icon name={item.icon} size={16} className="text-accent" />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
          className="state ml-auto hidden h-8 items-center gap-2 rounded-md border border-line pl-2.5 pr-1.5 text-body-s text-muted hover:text-ink md:flex lg:ml-3"
          aria-label="Search the site"
        >
          <Icon name="search" size={14} />
          <span className="lg:hidden xl:inline">Search</span>
          <kbd className="label-mono rounded-xs border border-line px-1 text-muted">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
        <button type="button" className="icon-btn ml-auto md:hidden" aria-label="Search the site" onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}>
          <Icon name="search" size={18} />
        </button>
        <a href={REPO} className="icon-btn md:ml-1" aria-label="Source code on GitHub" title="Source code on GitHub">
          <Icon name="github" size={18} />
        </a>
      </div>

      <CommandPalette />

      {/* Navigation drawer (phones and tablets) */}
      <dialog
        ref={drawer}
        aria-label="Navigation"
        className="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none border-r border-line bg-page p-3 text-ink backdrop:bg-black/50 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && drawer.current?.close()}
      >
        <div className="flex items-center justify-between py-1.5 pl-2">
          <Logo city="" />
          <button type="button" className="icon-btn" aria-label="Close navigation" onClick={() => drawer.current?.close()}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <p className="label-mono px-2 pb-1 pt-5 text-muted">Explore</p>
        <DrawerList items={primary} path={path} onNavigate={() => drawer.current?.close()} />
        <p className="label-mono px-2 pb-1 pt-5 text-muted">Learn</p>
        <DrawerList items={LEARN} path={path} onNavigate={() => drawer.current?.close()} />
      </dialog>
    </header>
  );
}

function DrawerList({ items, path, onNavigate }: { items: NavItem[]; path: string; onNavigate: () => void }) {
  return (
    <ul>
      {items.map((item) => {
        const on = isActive(path, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={on ? "page" : undefined}
              onClick={onNavigate}
              className={`state flex h-11 items-center gap-3 rounded-md px-2 text-body-l no-underline hover:no-underline ${on ? "bg-accent-soft text-accent" : "text-ink"}`}
            >
              <Icon name={item.icon} size={18} className={on ? "" : "text-ink-2"} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
