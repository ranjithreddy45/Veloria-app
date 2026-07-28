"use client";

import * as React from "react";
import {
  PlusIcon,
  TrashIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  Loader2Icon,
  ShieldCheckIcon,
  UsersIcon,
  ArrowRightIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getAssignmentRules,
  createAssignmentRule,
  deleteAssignmentRule,
  toggleAssignmentRule,
  type AssignmentRuleData,
} from "@/actions/assignment-rule.actions";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// ============================================================
// Component
// ============================================================

export function AssignmentRulesManager() {
  const [rules, setRules] = React.useState<AssignmentRuleData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formPriority, setFormPriority] = React.useState(0);
  const [formMethod, setFormMethod] = React.useState<"DIRECT" | "ROUND_ROBIN" | "SMART">("DIRECT");
  const [formConditionField, setFormConditionField] = React.useState("source");
  const [formConditionOperator, setFormConditionOperator] = React.useState("equals");
  const [formConditionValue, setFormConditionValue] = React.useState("");

  const fetchRules = React.useCallback(async () => {
    const result = await getAssignmentRules();
    if (result.success) setRules(result.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleCreate() {
    if (!formName.trim() || !formConditionValue.trim()) return;
    setSaving(true);

    const result = await createAssignmentRule({
      name: formName.trim(),
      priority: formPriority,
      assignmentMethod: formMethod,
      conditions: [
        {
          field: formConditionField,
          operator: formConditionOperator as "equals" | "contains" | "in" | "gt" | "lt" | "gte" | "lte" | "notIn",
          value: formConditionValue.includes(",")
            ? formConditionValue.split(",").map((v) => v.trim())
            : formConditionValue.trim(),
        },
      ],
    });

    if (result.success) {
      toast.success("Rule created");
      setDialogOpen(false);
      resetForm();
      fetchRules();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteAssignmentRule(id);
    if (result.success) {
      toast.success("Rule deleted");
      fetchRules();
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    const result = await toggleAssignmentRule(id, !isActive);
    if (result.success) {
      toast.success(isActive ? "Rule disabled" : "Rule enabled");
      fetchRules();
    } else {
      toast.error(result.error);
    }
  }

  function resetForm() {
    setFormName("");
    setFormPriority(0);
    setFormMethod("DIRECT");
    setFormConditionField("source");
    setFormConditionOperator("equals");
    setFormConditionValue("");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          <span className="numeric font-medium text-foreground">
            {rules.length}
          </span>{" "}
          rule{rules.length !== 1 ? "s" : ""} configured · evaluated highest
          priority first
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon className="mr-2 size-4" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card shadow-card">
          <EmptyState
            icon={<ShieldCheckIcon />}
            title="No assignment rules yet"
            description="New leads currently sit unassigned until someone claims them. Add a rule to send each one to the right rep the moment it arrives."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <PlusIcon className="mr-2 size-4" />
                Create first rule
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const conditions = rule.conditions as Array<{
              field: string;
              operator: string;
              value: string | string[];
            }>;
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
                        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
                          {rule.name}
                        </h3>
                        <StatusPill
                          label={rule.isActive ? "Active" : "Disabled"}
                          hue={rule.isActive ? "emerald" : "slate"}
                          size="xs"
                        />
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
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
                                {Array.isArray(c.value)
                                  ? c.value.join(", ")
                                  : String(c.value)}
                              </span>
                            </span>
                          </React.Fragment>
                        ))}
                        <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[12.5px] font-medium">
                          <UsersIcon className="size-3.5 text-muted-foreground" />
                          {rule.assignmentMethod === "DIRECT"
                            ? `Assign to ${rule.assignToUser?.name || "User"}`
                            : rule.assignmentMethod === "SMART"
                              ? "Smart routing"
                              : `Round-robin across ${rule.assignToTeam.length} member${rule.assignToTeam.length !== 1 ? "s" : ""}`}
                        </span>
                      </div>

                      <div className="mt-2.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Priority{" "}
                        <span className="numeric font-medium text-foreground">
                          {rule.priority}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(rule.id, rule.isActive)}
                        title={rule.isActive ? "Disable" : "Enable"}
                      >
                        {rule.isActive ? (
                          <ToggleRightIcon className="size-4 text-success" />
                        ) : (
                          <ToggleLeftIcon className="size-4 text-muted-foreground" />
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Delete rule">
                            <TrashIcon className="size-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete &quot;{rule.name}&quot;? This cannot be undone.
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
      )}

      {/* Create Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Assignment Rule</DialogTitle>
            <DialogDescription>
              When a new lead matches the conditions, it will be automatically
              assigned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Assign website leads to John"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  min={0}
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={formMethod} onValueChange={(v) => setFormMethod(v as "DIRECT" | "ROUND_ROBIN" | "SMART")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECT">Direct Assign</SelectItem>
                    <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                    <SelectItem value="SMART">Smart (auto)</SelectItem>
                  </SelectContent>
                </Select>
                {formMethod === "SMART" && (
                  <p className="text-xs text-muted-foreground">
                    Routes to the available, lightest-loaded, best-matched rep.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Select value={formConditionField} onValueChange={setFormConditionField}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source">Source</SelectItem>
                    <SelectItem value="eventType">Event Type</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="score">Score</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={formConditionOperator} onValueChange={setFormConditionOperator}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="in">In (comma-sep)</SelectItem>
                    <SelectItem value="gt">Greater than</SelectItem>
                    <SelectItem value="lt">Less than</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={formConditionValue}
                  onChange={(e) => setFormConditionValue(e.target.value)}
                  placeholder="Value"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || !formConditionValue.trim() || saving}>
              {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
