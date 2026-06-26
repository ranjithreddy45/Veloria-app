"use client";

import { useEffect, useRef, useState } from "react";
import { SocialProofStrip } from "@/components/public/social-proof-strip";
import { getSocialProofAction } from "@/actions/public-social-proof.actions";
import { EMPTY_SOCIAL_PROOF, type SocialProofData } from "@/lib/public/social-proof-types";

// ============================================================
// SocialProofAside — configurator live proof (PUBLIC, client).
// ------------------------------------------------------------
// The configurator is a client component whose occasion/venueId change as the
// customer builds their quote. This thin wrapper re-queries matched proof via
// the no-auth getSocialProofAction (debounced) so the strip stays event-type-
// matched at the decision moment, then renders <SocialProofStrip variant="inline">.
//
// Best-effort: on any failure it keeps the last good data (or empty) — it
// never blocks or errors the configurator. Stale responses are dropped via a
// monotonically-increasing request token.
// ============================================================

export function SocialProofAside({
  occasion,
  venueId,
}: {
  occasion?: string;
  venueId?: string | null;
}) {
  const [data, setData] = useState<SocialProofData>(EMPTY_SOCIAL_PROOF);
  const reqRef = useRef(0);

  useEffect(() => {
    const myReq = ++reqRef.current;
    const t = setTimeout(() => {
      getSocialProofAction({
        eventType: occasion || undefined,
        venueId: venueId || undefined,
      })
        .then((res) => {
          // Drop stale responses (only the latest request wins).
          if (reqRef.current === myReq) setData(res);
        })
        .catch(() => {
          /* best-effort — keep last good data */
        });
    }, 400); // debounce rapid occasion/venue changes

    return () => clearTimeout(t);
  }, [occasion, venueId]);

  return (
    <SocialProofStrip data={data} variant="inline" heading="Recent celebrations here" />
  );
}
