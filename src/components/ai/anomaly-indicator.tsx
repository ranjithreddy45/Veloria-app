"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { getActiveHighCriticalCount } from "@/actions/anomaly.actions";

// ============================================================
// Anomaly Indicator
// ============================================================
// Compact badge for the dashboard header showing active
// HIGH/CRITICAL anomaly count. Shows nothing if zero.

interface AnomalyIndicatorProps {
  /** Pre-fetched count (optional). If not provided, fetches on mount. */
  initialCount?: number;
}

export function AnomalyIndicator({ initialCount }: AnomalyIndicatorProps) {
  const [count, setCount] = React.useState(initialCount ?? 0);
  const [loaded, setLoaded] = React.useState(initialCount !== undefined);

  React.useEffect(() => {
    if (initialCount !== undefined) return;

    let cancelled = false;

    async function fetchCount() {
      try {
        const result = await getActiveHighCriticalCount();
        if (!cancelled && result.success) {
          setCount(result.data);
          setLoaded(true);
        }
      } catch {
        // Silently fail — indicator is non-critical UI
      }
    }

    fetchCount();

    // Refresh every 5 minutes
    const interval = setInterval(fetchCount, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [initialCount]);

  // Don't render anything if no active alerts or not yet loaded
  if (!loaded || count === 0) return null;

  return (
    <Link
      href="/analytics/anomalies"
      className="relative inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950"
    >
      {/* Pulsing dot */}
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-red-500" />
      </span>

      <AlertTriangleIcon className="size-3.5" />
      <span>
        {count} {count === 1 ? "Alert" : "Alerts"}
      </span>
    </Link>
  );
}
