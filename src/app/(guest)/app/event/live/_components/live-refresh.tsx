"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-reads the live screen from the server on an interval while the tab is
 * visible, so check-ins and run-of-show statuses the team updates show up
 * without the host reloading. Rendered only on the event day.
 */
export function LiveRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
