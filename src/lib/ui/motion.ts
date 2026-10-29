// ============================================================
// The JS side of the motion system in globals.css ("Motion system").
// ------------------------------------------------------------
// Web Animations read the same curves and speeds as the CSS, straight from
// the custom properties, so there is one place to tune the feel of the app.
// Client-only (touches window/document).
// ============================================================

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A motion token from :root, e.g. cssToken("--motion-spring-soft"), or the fallback. */
export function cssToken(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Element.animate that tolerates a browser rejecting a `linear()` easing
 * (older engines throw on unknown timing functions) by retrying with an
 * ordinary curve. Returns null when nothing could run.
 */
export function animate(
  el: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Animation | null {
  try {
    return el.animate(keyframes, options);
  } catch {
    try {
      return el.animate(keyframes, { ...options, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    } catch {
      return null;
    }
  }
}
