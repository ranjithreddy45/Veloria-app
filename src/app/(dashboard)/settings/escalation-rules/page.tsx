import type { Metadata } from "next";
import Link from "next/link";
import {
  PlusIcon,
  ShieldAlertIcon,
  PencilIcon,
  ClockIcon,
  AlertTriangleIcon,
} from "lucide-react";

import { getEscalationRules } from "@/actions/escalation.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TASK_CATEGORY_LABELS,
  ESCALATION_LEVEL_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Escalation Rules | Veloria Grand" };

// ============================================================
// Escalation Level Colors
// ============================================================

const LEVEL_COLORS: Record<string, string> = {
  L1_SUPERVISOR:
    "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  L2_MANAGER:
    "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  L3_LEADERSHIP:
    "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
};

const CATEGORY_COLORS: Record<string, string> = {
  DECOR:
    "bg-pink-50 text-pink-700 border-pink-200/60 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-800/40",
  AV: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
  CATERING:
    "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40",
  HOUSEKEEPING:
    "bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800/40",
  GUEST_SEATING:
    "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/40",
  ENTERTAINMENT:
    "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800/40",
  LOGISTICS:
    "bg-cyan-50 text-cyan-700 border-cyan-200/60 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/40",
  SECURITY:
    "bg-slate-50 text-slate-700 border-slate-200/60 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40",
  GENERAL:
    "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40",
};

// ============================================================
// Escalation Rules List Page
// ============================================================

export default async function EscalationRulesPage() {
  const result = await getEscalationRules();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = result.success ? ((result.data ?? []) as any[]) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escalation Rules"
        description="Configure automatic escalation rules for overdue tasks."
      >
        <Button asChild>
          <Link href="/settings/escalation-rules/new">
            <PlusIcon className="mr-2 size-4" />
            New Rule
          </Link>
        </Button>
      </PageHeader>

      {rules.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ShieldAlertIcon className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No Escalation Rules</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Create your first escalation rule to automatically escalate
              overdue tasks to the right people.
            </p>
            <Button asChild className="mt-6">
              <Link href="/settings/escalation-rules/new">
                <PlusIcon className="mr-2 size-4" />
                Create Rule
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm flex flex-col"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{rule.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      rule.isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700/40"
                    }
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className={
                      CATEGORY_COLORS[rule.category] ?? CATEGORY_COLORS.GENERAL
                    }
                  >
                    {TASK_CATEGORY_LABELS[rule.category] ?? rule.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      TASK_PRIORITY_COLORS[rule.priority] ??
                      TASK_PRIORITY_COLORS.MEDIUM
                    }
                  >
                    {rule.priority}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      LEVEL_COLORS[rule.level] ?? LEVEL_COLORS.L1_SUPERVISOR
                    }
                  >
                    {ESCALATION_LEVEL_LABELS[rule.level] ?? rule.level}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" />
                    {rule.delayThresholdMinutes} min
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangleIcon className="size-3.5" />
                    {rule._count?.escalations ?? 0}{" "}
                    {(rule._count?.escalations ?? 0) === 1
                      ? "escalation"
                      : "escalations"}
                  </span>
                </div>
              </CardContent>

              <CardFooter className="border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full"
                >
                  <Link href={`/settings/escalation-rules/${rule.id}/edit`}>
                    <PencilIcon className="mr-2 size-4" />
                    Edit Rule
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
