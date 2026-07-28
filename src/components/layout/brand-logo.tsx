"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Brand logo — renders real artwork when it exists, the designed text/mark
// lockup otherwise.
// ------------------------------------------------------------
// Previously this defaulted to `/logo.png`, which is NOT in `public/`. The
// browser therefore requested a missing file and painted the broken-image glyph
// (plus alt text) before onError could swap in the fallback — a visible defect on
// the sign-in screen and on customer-facing invoices.
//
// Now we only mount an <img> when a logo is actually CONFIGURED — via the `src`
// prop or NEXT_PUBLIC_BRAND_LOGO_URL. With nothing configured we render the
// fallback lockup immediately: no network request, no flash, never broken.
//
// To use real artwork: drop the file in `public/` and set
// NEXT_PUBLIC_BRAND_LOGO_URL=/logo.png (or pass `src` directly).
// ============================================================

const CONFIGURED_LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO_URL?.trim() || "";

export function BrandLogo({
  className,
  fallback,
  alt = "Veloria Grand",
  src,
}: {
  className?: string;
  fallback: React.ReactNode;
  alt?: string;
  /** Explicit logo URL. Falls back to NEXT_PUBLIC_BRAND_LOGO_URL, else the lockup. */
  src?: string;
}) {
  const resolved = src?.trim() || CONFIGURED_LOGO;
  const [errored, setErrored] = useState(false);

  // No artwork configured (or it failed to load) → the designed lockup.
  if (!resolved || errored) return <>{fallback}</>;

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={resolved}
      alt={alt}
      className={cn(
        "select-none rounded-lg transition-opacity duration-200",
        className
      )}
      draggable={false}
      onError={() => setErrored(true)}
    />
  );
}
