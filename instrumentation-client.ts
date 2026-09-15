import * as Sentry from "@sentry/nextjs";

// ============================================================
// Sentry — browser. This is the Next.js `instrumentation-client` convention
// (required for Turbopack; sentry.client.config.ts is deprecated there).
//
// NEXT_PUBLIC_SENTRY_DSN is inlined at BUILD time for this bundle, so on the
// VPS it must be passed as a Docker build arg — a runtime-only value in
// .env.production reaches the server side but not the browser.
// No DSN → no init, and the router hook below does nothing.
// ============================================================

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    // withSentryConfig also injects the release into the bundle when it can
    // determine one; this explicit value wins when set.
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    debug: false,
  });
}

export const onRouterTransitionStart: typeof Sentry.captureRouterTransitionStart = (
  href,
  navigationType
) => {
  if (!dsn) return;
  Sentry.captureRouterTransitionStart(href, navigationType);
};
