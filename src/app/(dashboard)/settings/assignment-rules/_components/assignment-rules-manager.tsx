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
} from "lucide-react";
import { toast } from "sonner";

import {
  getAssignmentRules,
  createAssignmentRule,
  deleteAssignmentRule,
  toggleAssignmentRule,
  type AssignmentRuleData,
} from "@/actions/assignment-rule.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [formMethod, setFormMethod] = React.useState<"DIRECT" | "ROUND_ROBIN">("DIRECT");
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
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2Icon className="mr-2 size-5 animate-spin" /> Loading rules...
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon className="mr-2 size-4" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ShieldCheckIcon className="mx-auto mb-3 size-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              No assignment rules yet. Create your first rule to auto-assign
              incoming leads.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const conditions = rule.conditions as Array<{
              field: string;
              operator: string;
              value: string | string[];
            }>;
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
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{rule.name}</h3>
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
                        <Badge variant="outline" className="text-xs">
                          Priority: {rule.priority}
                        </Badge>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="font-medium">When:</span>
                        {conditions.map((c, i) => (
                          <span key={i} className="rounded bg-zinc-100 px-1.5 py-0.5">
                            {c.field} {c.operator}{" "}
                            {Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}
                          </span>
                        ))}
                        <span className="font-medium">→</span>
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">
                          {rule.assignmentMethod === "DIRECT"
                            ? `Assign to ${rule.assignToUser?.name || "User"}`
                            : `Round-robin (${rule.assignToTeam.length} members)`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(rule.id, rule.isActive)}
                        title={rule.isActive ? "Disable" : "Enable"}
                      >
                        {rule.isActive ? (
                          <ToggleRightIcon className="size-4 text-green-600" />
                        ) : (
                          <ToggleLeftIcon className="size-4 text-zinc-400" />
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <TrashIcon className="size-4 text-red-500" />
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
                </CardContent>
              </Card>
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
                <Select value={formMethod} onValueChange={(v) => setFormMethod(v as "DIRECT" | "ROUND_ROBIN")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECT">Direct Assign</SelectItem>
                    <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                  </SelectContent>
                </Select>
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
