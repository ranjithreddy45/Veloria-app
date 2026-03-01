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
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteApprovalRule,
  toggleApprovalRule,
  type ApprovalRuleData,
} from "@/actions/approval.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
// Entity Type Colors
// ============================================================

const ENTITY_TYPE_COLORS: Record<string, string> = {
  QUOTE: "bg-purple-100 text-purple-700 border-purple-200",
  DEAL: "bg-blue-100 text-blue-700 border-blue-200",
  BOOKING: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

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
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <ShieldCheckIcon className="mx-auto mb-3 size-10 text-zinc-300" />
          <p className="text-sm text-zinc-500">
            No approval rules configured yet. Create your first rule to enable
            approval workflows for quotes, deals, and bookings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
      </p>

      {rules.map((rule) => {
        const conditions = rule.conditions ?? [];
        const chainLength = rule.approverChain?.length ?? 0;
        const isToggling = togglingId === rule.id;

        return (
          <Card
            key={rule.id}
            className={cn(
              "border-zinc-200/80 shadow-sm",
              !rule.isActive && "opacity-50"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/settings/approval-rules/${rule.id}`}
                      className="font-medium hover:underline"
                    >
                      {rule.name}
                    </Link>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs border font-medium",
                        ENTITY_TYPE_COLORS[rule.entityType] ??
                          "bg-gray-100 text-gray-700 border-gray-200"
                      )}
                    >
                      {rule.entityType}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        rule.isActive
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500"
                      )}
                    >
                      {rule.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span>
                      Priority: <span className="font-medium">{rule.priority}</span>
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                      {chainLength} step{chainLength !== 1 ? "s" : ""} in chain
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                      {conditions.length} condition{conditions.length !== 1 ? "s" : ""}
                    </span>
                    {rule.description && (
                      <span className="text-zinc-400 truncate max-w-xs">
                        {rule.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Edit */}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/settings/approval-rules/${rule.id}`}>
                      <PencilIcon className="size-4 text-zinc-500" />
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
                      <ToggleRightIcon className="size-4 text-green-600" />
                    ) : (
                      <ToggleLeftIcon className="size-4 text-zinc-400" />
                    )}
                  </Button>

                  {/* Delete */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <TrashIcon className="size-4 text-red-500" />
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
