"use client";

// ============================================================
// Payment gateway status card — one-click "Test connection" that tells you
// exactly why online collection is or isn't working, without exposing any
// secret. Managers only. Auto-runs once on mount, re-runnable on demand.
// ============================================================

import * as React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaymentGatewayHealth } from "@/actions/payment.actions";

type Health = Extract<
  Awaited<ReturnType<typeof getPaymentGatewayHealth>>,
  { success: true }
>;
type GatewayCheck = Health["checks"][number];

export function PaymentGatewayStatus() {
  const [health, setHealth] = React.useState<Health | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const run = React.useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await getPaymentGatewayHealth();
      if (res.success) setHealth(res);
      else setError(res.error);
    });
  }, []);

  React.useEffect(() => {
    run();
  }, [run]);

  const ok = health?.canCollect === true;
  const tone = !health
    ? "border-border/70 bg-card"
    : ok
      ? "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/20"
      : "border-amber-300/70 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20";

  return (
    <div className={`rounded-2xl border p-4 shadow-card transition-colors ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {pending && !health ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : ok ? (
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <PlugZap className="size-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              Payment gateway
              {health && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    health.mode === "live"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : health.mode === "test"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {health.mode === "live"
                    ? "LIVE"
                    : health.mode === "test"
                      ? "TEST MODE"
                      : "UNKNOWN"}
                </span>
              )}
            </div>
            <p className="mt-0.5 max-w-2xl text-[13px] text-muted-foreground">
              {error
                ? error
                : health
                  ? health.headline
                  : "Checking connection to Razorpay…"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={run} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Test connection
        </Button>
      </div>

      {health && (
        <ul className="mt-3 grid gap-1.5 border-t border-border/50 pt-3 sm:grid-cols-2">
          {health.checks.map((c: GatewayCheck) => (
            <li key={c.label} className="flex items-start gap-2 text-[12.5px]">
              {c.level === "pass" ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : c.level === "fail" ? (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <span>
                <span className="font-medium">{c.label}.</span>{" "}
                <span className="text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
