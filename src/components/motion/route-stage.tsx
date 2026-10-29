"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { animate, cssToken, prefersReducedMotion } from "@/lib/ui/motion";

/**
 * The page area of the dashboard. When the route changes, the new page
 * settles in (a short fade and rise) while the sidebar and header stay
 * still. It does not run on first load (an opacity entrance on first paint
 * ghosts the heading), nor when only the query string changes, so filtering
 * a list never makes it jump.
 *
 * Web Animations with no fill: the transform exists only while it plays, so
 * the wrapper does not stay the containing block of fixed bars inside pages.
 */
export function RouteStage({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const previous = React.useRef(pathname);

  React.useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    el.getAnimations().forEach((a) => a.cancel());
    animate(
      el,
      [
        { opacity: 0.35, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 260, easing: cssToken("--motion-ease-out", "cubic-bezier(0.22, 1, 0.36, 1)") }
    );
  }, [pathname]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
