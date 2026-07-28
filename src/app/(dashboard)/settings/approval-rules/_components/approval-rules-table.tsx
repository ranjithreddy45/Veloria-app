"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrashIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  Loader2Icon,
  ShieldCheckIcon,
  PencilIcon,
  ArrowRightIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteApprovalRule,
  toggleApprovalRule,
  type ApprovalRuleData,
} from "@/actions/approval.actions";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ============================================================
// Entity Type Hues
// ============================================================

const ENTITY_TYPE_HUE: Record<string, Hue> = {
  QUOTE: "purple",
  DEAL: "blue",
  BOOKING: "emerald",
};

// ============================================================
// Condition → plain English
// ============================================================

const OPERATOR_LABEL: Record<string, string> = {
  equals: "is",
  contains: "contains",
  in: "is one of",
  notIn: "is not one of",
  gt: "is over",
  lt: "is under",
  gte: "is at least",
  lte: "is at most",
};

/** camelCase / snake_case field key → "Title Case" label. */
function humanizeField(field: string): string {
  return field
    .replace(/[_.]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatValue(value: string | number | string[]): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return value.toLocaleString("en-IN");
  return value;
}

// ============================================================
// Props
// ============================================================

interface ApprovalRulesTableProps {
  initialRules: ApprovalRuleData[];
}

// ============================================================
// Component
// ============================================================

export function ApprovalRulesTable({ initialRules }: ApprovalRulesTableProps) {
  const [rules, setRules] = React.useState(initialRules);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  async function handleToggle(id: string, isActive: boolean) {
    setTogglingId(id);
    const result = await toggleApprovalRule(id, !isActive);
    if (result.success) {
      toast.success(isActive ? "Rule disabled" : "Rule enabled");
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: !isActive } : r))
      );
    } else {
      toast.error(result.error);
    }
    setTogglingId(null);
  }

  async function handleDelete(id: string) {
    const result = await deleteApprovalRule(id);
    if (result.success) {
      toast.success("Rule deleted");
      setRules((prev) => prev.filter((r) => r.id !== id));
    } else {
      toast.error(result.error);
    }
  }

  if (rules.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card shadow-card">
        <EmptyState
          icon={<ShieldCheckIcon />}
          title="No approval rules yet"
          description="Nothing needs a sign-off right now — quotes, deals and bookings go straight through. Add a rule to route the high-value ones past a reviewer first."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        <span className="numeric font-medium text-foreground">
          {rules.length}
        </span>{" "}
        rule{rules.length !== 1 ? "s" : ""} configured · evaluated highest
        priority first
      </p>

      {rules.map((rule) => {
        const conditions = rule.conditions ?? [];
        const chainLength = rule.approverChain?.length ?? 0;
        const isToggling = togglingId === rule.id;

        return (
          <div
            key={rule.id}
            className={cn(
              "rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover",
              !rule.isActive && "opacity-65"
            )}
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/settings/approval-rules/${rule.id}`}
                      className="text-[15px] font-semibold tracking-[-0.01em] hover:underline"
                    >
                      {rule.name}
                    </Link>
                    <StatusPill
                      label={rule.entityType}
                      hue={ENTITY_TYPE_HUE[rule.entityType] ?? "neutral"}
                      size="xs"
                    />
                    <StatusPill
                      label={rule.isActive ? "Active" : "Disabled"}
                      hue={rule.isActive ? "emerald" : "slate"}
                      size="xs"
                    />
                  </div>

                  {rule.description && (
                    <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
                      {rule.description}
                    </p>
                  )}

                  {/* Condition → action summary */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
                    {conditions.length === 0 ? (
                      <span className="text-muted-foreground">
                        Applies to every {rule.entityType.toLowerCase()}
                      </span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">When</span>
                        {conditions.map((c, i) => (
                          <React.Fragment key={`${rule.id}-cond-${i}`}>
                            {i > 0 && (
                              <span className="text-muted-foreground">and</span>
                            )}
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[12.5px]">
                              <span className="font-medium text-foreground">
                                {humanizeField(c.field)}
                              </span>{" "}
                              <span className="text-muted-foreground">
                                {OPERATOR_LABEL[c.operator] ?? c.operator}
                              </span>{" "}
                              <span className="numeric font-medium text-foreground">
                                {formatValue(c.value)}
                              </span>
                            </span>
                          </React.Fragment>
                        ))}
                      </>
                    )}
                    <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[12.5px] font-medium">
                      <UsersIcon className="size-3.5 text-muted-foreground" />
                      {chainLength === 0
                        ? "No approvers yet"
                        : `${chainLength} approval step${chainLength !== 1 ? "s" : ""}`}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <span>
                      Priority{" "}
                      <span className="numeric font-medium text-foreground">
                        {rule.priority}
                      </span>
                    </span>
                    <span aria-hidden className="text-border">
                      ·
                    </span>
                    <span>
                      <span className="numeric font-medium text-foreground">
                        {conditions.length}
                      </span>{" "}
                      condition{conditions.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {/* Edit */}
                  <Button variant="ghost" size="sm" asChild title="Edit rule">
                    <Link href={`/settings/approval-rules/${rule.id}`}>
                      <PencilIcon className="size-4 text-muted-foreground" />
                    </Link>
                  </Button>

                  {/* Toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(rule.id, rule.isActive)}
                    disabled={isToggling}
                    title={rule.isActive ? "Disable" : "Enable"}
                  >
                    {isToggling ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : rule.isActive ? (
                      <ToggleRightIcon className="size-4 text-emerald-600" />
                    ) : (
                      <ToggleLeftIcon className="size-4 text-muted-foreground" />
                    )}
                  </Button>

                  {/* Delete */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" title="Delete rule">
                        <TrashIcon className="size-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Approval Rule</AlertDialogTitle>
                        <AlertDialogDescription>
                          Delete &quot;{rule.name}&quot;? This will also remove
                          all associated chain steps. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(rule.id)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
