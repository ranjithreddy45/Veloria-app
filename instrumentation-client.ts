import * as Sentry from "@sentry/nextjs";
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/log-redact";

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
    // Messages and breadcrumbs can still carry a customer's phone or email
    // (an error string, a fetch URL): mask them before anything leaves (R1-8).
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubSentryBreadcrumb(breadcrumb),
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
