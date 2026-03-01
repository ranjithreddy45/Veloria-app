"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

// ============================================================
// Global Error Boundary (App Root)
// Must be a Client Component with its own <html> and <body>.
// ============================================================

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GLOBAL_ERROR]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          {/* Decorative ambient blobs */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-red-500/5 blur-[100px]" />
            <div className="absolute -bottom-40 left-0 h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[100px]" />
          </div>

          <div className="relative flex max-w-md flex-col items-center gap-8 text-center">
            {/* Icon */}
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/50 dark:to-orange-950/50">
              <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>

            {/* Text */}
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">
                Something went wrong
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Unexpected Error
              </h1>
              <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                We encountered an unexpected error. Our team has been notified.
                Please try again or return to the dashboard.
              </p>
              {error.digest && (
                <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-violet-700 hover:shadow-xl"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </a>
            </div>

            {/* Branding */}
            <p className="text-xs text-zinc-400/50 dark:text-zinc-600">
              &copy; {new Date().getFullYear()} Veloria Grand
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
