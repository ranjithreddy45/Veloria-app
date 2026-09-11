"use client";

import * as React from "react";

/**
 * v4 parallax header: the hero drifts at ~0.45× scroll speed and grows on
 * rubber-band overscroll, the way a native detail screen behaves. rAF-throttled,
 * passive listener, and inert under prefers-reduced-motion.
 */
export function ParallaxHero({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const scale = y < 0 ? 1 + Math.min(0.35, -y / 320) : 1;
        el.style.transform = `translate3d(0, ${Math.max(0, y) * 0.45}px, 0) scale(${scale})`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); if (raf) window.cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className={className} style={{ transformOrigin: "50% 100%", willChange: "transform" }}>{children}</div>;
}
