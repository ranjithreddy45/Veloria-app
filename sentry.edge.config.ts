import * as Sentry from "@sentry/nextjs";

// ============================================================
// Sentry — Edge runtime (middleware, edge route handlers). Same gating and
// settings as sentry.server.config.ts; kept separate because the edge bundle
// must not pull in Node-only code.
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
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    debug: false,
  });
}
