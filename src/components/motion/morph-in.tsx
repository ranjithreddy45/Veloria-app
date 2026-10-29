"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { takeMorph } from "@/lib/ui/morph";
import { animate, cssToken, prefersReducedMotion } from "@/lib/ui/motion";

/**
 * The landing end of a shared-element morph (see lib/ui/morph.ts). Renders
 * its children in place; if the previous page was left by clicking an
 * element marked data-morph={id}, they start where that element was and
 * glide here. Scale comes from the font sizes, so a one-line list title can
 * land on a heading that wraps.
 */
export function MorphIn({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    const from = takeMorph(id);
    if (!el || !from || prefersReducedMotion()) return;
    const to = el.getBoundingClientRect();
    const toFont = parseFloat(getComputedStyle(el).fontSize) || 16;
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    const scale = Math.min(4, Math.max(0.25, from.fontSize / toFont));
    animate(
      el,
      [
        { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: 480, easing: cssToken("--motion-spring-soft", "cubic-bezier(0.22, 1, 0.36, 1)") }
    );
  }, [id]);

  return (
    <span ref={ref} className={cn("inline-block max-w-full", className)}>
      {children}
    </span>
  );
}
