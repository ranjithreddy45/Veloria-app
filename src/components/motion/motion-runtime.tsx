"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureMorphs } from "@/lib/ui/morph";

/** Fast navigations (cached pages) finish before the bar would be noticed; don't flash it. */
const SHOW_AFTER_MS = 120;
/** A navigation that never lands (offline, server error page) must not leave the bar up. */
const GIVE_UP_MS = 15000;

/** The URL a plain left-click on an internal link will navigate to, or null. */
function internalNavigation(e: MouseEvent): URL | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page, or only the #hash changes: nothing will load.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url;
}

/**
 * Page-level motion that needs a listener rather than a component:
 * - a thin emerald-to-gold progress line while the next page loads, so a
 *   click never feels dead (Next has no built-in indicator, and a route
 *   loading.tsx is off the table: vercel/next.js#98684, see the e2e guard);
 * - recording the clicked row for shared-element morphs (lib/ui/morph.ts).
 */
export function MotionRuntime() {
  return (
    <React.Suspense fallback={null}>
      <NavProgress />
    </React.Suspense>
  );
}

function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const barRef = React.useRef<HTMLDivElement>(null);
  const timers = React.useRef<{ show?: number; giveUp?: number }>({});
  const visible = React.useRef(false);

  const finish = React.useCallback(() => {
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.giveUp);
    const bar = barRef.current;
    if (!bar || !visible.current) return;
    visible.current = false;
    bar.style.transition = "transform 200ms ease-out, opacity 260ms ease 160ms";
    bar.style.transform = "scaleX(1)";
    bar.style.opacity = "0";
  }, []);

  const start = React.useCallback(() => {
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.giveUp);
    timers.current.show = window.setTimeout(() => {
      const bar = barRef.current;
      if (!bar) return;
      visible.current = true;
      bar.style.transition = "none";
      bar.style.opacity = "1";
      bar.style.transform = "scaleX(0)";
      void bar.offsetWidth; // commit the reset before travelling
      // Fast at first, then crawling: it never claims to be done before it is.
      bar.style.transition = "transform 8s cubic-bezier(0.1, 0.65, 0.2, 1), opacity 150ms ease";
      bar.style.transform = "scaleX(0.88)";
    }, SHOW_AFTER_MS);
    timers.current.giveUp = window.setTimeout(finish, GIVE_UP_MS);
  }, [finish]);

  // The new route (or query) has rendered.
  React.useEffect(finish, [pathname, search, finish]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element) captureMorphs(e.target);
      if (internalNavigation(e)) start();
    };
    const onPop = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, [start]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[max(var(--sat),0px)] z-[100] h-0.5">
      <div
        ref={barRef}
        className="h-full origin-left bg-[linear-gradient(90deg,var(--primary),var(--gold-bright))] shadow-[0_0_10px_var(--gold-bright)]"
        style={{ opacity: 0, transform: "scaleX(0)" }}
      />
    </div>
  );
}
