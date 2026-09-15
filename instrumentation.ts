import * as Sentry from "@sentry/nextjs";

// ============================================================
// Next.js instrumentation hook (server + edge). Loads the matching Sentry
// config for the runtime that is booting, and forwards request errors
// (server components, route handlers, server actions) to Sentry.
//
// Everything is a no-op when NEXT_PUBLIC_SENTRY_DSN is unset: register()
// returns before importing anything and onRequestError drops the error, so a
// deployment without Sentry behaves exactly as it did before this file.
// ============================================================

const enabled = (): boolean => Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export async function register(): Promise<void> {
  if (!enabled()) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: typeof Sentry.captureRequestError = (error, request, context) => {
  if (!enabled()) return;
  Sentry.captureRequestError(error, request, context);
};
