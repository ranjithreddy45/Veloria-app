"use client";

// ============================================================
// Getting Started checklist — a self-updating first-run guide on the dashboard.
// Steps come from real data (server). Auto-hides once every step is done, and
// can be dismissed (remembered in localStorage). Drives new-user adoption by
// always answering "what do I do next?".
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus, FileText, CalendarCheck, IndianRupee, Users, CreditCard,
  Check, ArrowRight, X, Sparkles, BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingStep } from "@/actions/onboarding.actions";

const ICONS: Record<string, typeof UserPlus> = {
  UserPlus, FileText, CalendarCheck, IndianRupee, Users, CreditCard,
};

const DISMISS_KEY = "vg_getting_started_dismissed_v1";

export function GettingStarted({ steps, doneCount, total }: { steps: OnboardingStep[]; doneCount: number; total: number }) {
  const [hidden, setHidden] = useState(true);

  // Read dismissal only on the client to avoid hydration mismatch.
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const nextStep = steps.find((s) => !s.done);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setHidden(true);
  };

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card">
      <div className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full bg-primary/10 blur-3xl" />
      <CardContent className="relative space-y-5 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">Getting started</h2>
              {/* Goal-gradient: as the gap shrinks, name the small remainder to pull it closed. */}
              <p className="text-[12.5px] text-muted-foreground">
                {doneCount === total
                  ? "You're all set — nicely done!"
                  : total - doneCount === 1
                  ? <span className="font-medium text-amber-600 dark:text-amber-400">🔥 Just 1 step left — you're almost there!</span>
                  : total - doneCount === 2
                  ? `${doneCount} of ${total} done · only 2 to go`
                  : `${doneCount} of ${total} done · a few steps to go`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
            aria-label="Dismiss getting started"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{pct}% complete</span>
            {nextStep && <span>Next: {nextStep.label}</span>}
          </div>
        </div>

        {/* Steps */}
        <ul className="grid gap-2 sm:grid-cols-2">
          {steps.map((s) => {
            const Icon = ICONS[s.icon] ?? FileText;
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border p-3 transition",
                    s.done
                      ? "border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03]"
                  )}
                >
                  <div className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    s.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    {s.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[13px] font-medium", s.done ? "text-muted-foreground line-through" : "text-foreground")}>
                      {s.label}
                    </p>
                    <p className="truncate text-[11.5px] text-muted-foreground">{s.hint}</p>
                  </div>
                  {!s.done && (
                    <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary opacity-0 transition group-hover:opacity-100">
                      {s.cta} <ArrowRight className="size-3.5" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
            <Link href="/playbook"><BookOpen className="size-3.5" /> Open the guided Playbook</Link>
          </Button>
          {doneCount === total && (
            <Button size="sm" className="h-8" onClick={dismiss}>Done, hide this</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
