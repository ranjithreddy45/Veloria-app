import * as Sentry from "@sentry/nextjs";

// ============================================================
// Sentry — Node.js runtime (server components, route handlers, server
// actions, crons). Loaded by instrumentation.ts only when a DSN exists, and
// guarded again here so importing this file directly is still a no-op.
//
// Release: SENTRY_RELEASE wins (set it at build time on the VPS), then the git
// SHA env the CI/host provides. Environment: NODE_ENV unless overridden — the
// override lets beta.theveloriagrand.com report as "beta" instead of
// "production" while both run the same image.
// ============================================================

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release:
      process.env.SENTRY_RELEASE ||
      process.env.GIT_COMMIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      undefined,
    // Low: this is an error monitor, not an APM. 10% of transactions is enough
    // to see slow routes without paying for every request.
    tracesSampleRate: 0.1,
    // Never attach request bodies / user IPs by default — the app handles
    // customer PII and payment data.
    sendDefaultPii: false,
    debug: false,
  });
}
