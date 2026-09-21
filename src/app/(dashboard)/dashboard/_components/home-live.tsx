"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

// ============================================================
// HomeLive — keeps the server-rendered home current.
//
// The home is a server component, so "live" means re-running its loader, not
// polling from the browser with a second copy of the queries. router.refresh()
// re-renders the route on the server and bypasses the client router cache
// (staleTimes.dynamic would otherwise serve a 30s-old payload).
//
// Refreshes once a minute while the tab is visible, and immediately when the
// tab comes back into view: someone returning from the lead they just answered
// should not find it still listed.
// ============================================================

const REFRESH_MS = 60_000;

// `label` is formatted on the server and passed in: Node and the browser do not
// always agree on "6:30 pm" vs "6:30 PM", and formatting here would risk a
// hydration mismatch on every load.
export function HomeLive({ asOf, label }: { asOf: string; label: string }) {
  const router = useRouter();

  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return (
    <p className="text-detail inline-flex items-center gap-1.5 text-foreground/70">
      <span aria-hidden className="relative inline-flex size-1.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-success/60 motion-reduce:hidden" />
        <span className="relative size-1.5 rounded-full bg-success" />
      </span>
      <span>
        Live <span className="sr-only">figures, </span>· read at <time dateTime={asOf}>{label}</time>
      </span>
    </p>
  );
}
