"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Renders the Veloria Grand logo from /logo.png. If the file isn't present
// (or fails to load) it gracefully falls back to the text/mark passed in, so
// the UI never shows a broken image. Drop the brand artwork at
// `public/logo.png` and it appears everywhere this component is used.
export function BrandLogo({
  className,
  fallback,
  alt = "Veloria Grand",
  src = "/logo.png",
}: {
  className?: string;
  fallback: React.ReactNode;
  alt?: string;
  src?: string;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
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
