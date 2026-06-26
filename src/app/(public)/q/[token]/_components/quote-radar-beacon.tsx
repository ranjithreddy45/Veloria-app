"use client";

import { useEffect, useRef } from "react";
// Backend (quote-radar agent) public action — no-auth, best-effort view log.
// Imported as if exported; central wiring confirms the export.
import { recordQuoteView } from "@/actions/public-quote-radar.actions";

// ============================================================
// QuoteRadarBeacon — fires a single view event on mount.
// ------------------------------------------------------------
// Renders nothing. On first mount it records the open (referrer + which tier
// is focused), then on tab hide/unload it reports dwell time (durationMs) so
// the rep radar panel can show engagement depth. Device + ipHash are derived
// SERVER-SIDE from request headers inside recordQuoteView — never trusted from
// the client. recordQuoteView never throws and never blocks the render.
//
// Double-fire guarded with a ref (React 18 StrictMode double-invoke + remounts).
// ============================================================

export function QuoteRadarBeacon({
  token,
  viewedQuotationId,
}: {
  token: string;
  viewedQuotationId?: string;
}) {
  const firedRef = useRef(false);
  const mountedAtRef = useRef<number>(0);
  const dwellSentRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    mountedAtRef.current = Date.now();

    // Initial open — referrer from the document (server derives device/ipHash).
    void recordQuoteView({
      token,
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      viewedQuotationId,
    }).catch(() => {
      /* best-effort analytics — swallow */
    });

    const sendDwell = () => {
      if (dwellSentRef.current) return;
      dwellSentRef.current = true;
      const durationMs = Date.now() - mountedAtRef.current;
      void recordQuoteView({
        token,
        viewedQuotationId,
        durationMs,
      }).catch(() => {
        /* best-effort */
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") sendDwell();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", sendDwell);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", sendDwell);
    };
  }, [token, viewedQuotationId]);

  return null;
}
