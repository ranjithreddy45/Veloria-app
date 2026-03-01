"use client";

import * as React from "react";
import {
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  GripVerticalIcon,
  TargetIcon,
  PencilIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getScoringRuleSet,
  createScoringRule,
  updateScoringRule,
  deleteScoringRule,
  reorderScoringRules,
  updateScoringRuleSet,
  type ScoringRuleSetData,
  type ScoringRuleData,
} from "@/actions/scoring-rule.actions";
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
import { Switch } from "@/components/ui/switch";
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
// Constants
// ============================================================

const CATEGORY_STYLES: Record<string, string> = {
  FIELD_BASED: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVITY_BASED: "border-amber-200 bg-amber-50 text-amber-700",
  PROFILE_COMPLETENESS: "border-purple-200 bg-purple-50 text-purple-700",
  DECAY: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

const CATEGORY_LABELS: Record<string, string> = {
  FIELD_BASED: "Field Based",
  ACTIVITY_BASED: "Activity Based",
  PROFILE_COMPLETENESS: "Profile Completeness",
  DECAY: "Decay",
};

const ENTITY_TYPE_STYLES: Record<string, string> = {
  LEAD: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CONTACT: "border-teal-200 bg-teal-50 text-teal-700",
  DEAL: "border-orange-200 bg-orange-50 text-orange-700",
};

const LEAD_FIELDS = [
  { value: "status", label: "Status" },
  { value: "source", label: "Source" },
  { value: "eventType", label: "Event Type" },
  { value: "estimatedValue", label: "Estimated Value" },
  { value: "guestCount", label: "Guest Count" },
  { value: "score", label: "Score" },
];

const CONTACT_FIELDS = [
  { value: "type", label: "Type" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "company", label: "Company" },
  { value: "isActive", label: "Is Active" },
];

const DEAL_FIELDS = [
  { value: "value", label: "Deal Value" },
  { value: "probability", label: "Probability" },
  { value: "stageId", label: "Stage" },
];

const PROFILE_FIELDS_LEAD = [
  "email", "phone", "eventType", "guestCount", "estimatedValue", "eventDate", "followUpDate",
];

const PROFILE_FIELDS_CONTACT = [
  "email", "phone", "company", "designation", "address", "city", "state", "pincode",
];

const PROFILE_FIELDS_DEAL = [
  "value", "probability", "expectedCloseDate", "notes",
];

const DECAY_FIELDS = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "createdAt", label: "Created At" },
];

// ============================================================
// Component
// ============================================================

interface Props {
  ruleSet: ScoringRuleSetData;
}

export function ScoringRulesManager({ ruleSet: initialRuleSet }: Props) {
  const [ruleSet, setRuleSet] = React.useState<ScoringRuleSetData>(initialRuleSet);
  const [rules, setRules] = React.useState<ScoringRuleData[]>(initialRuleSet.rules ?? []);
  const [loading, setLoading] = React.useState(false);

  // Rule dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<ScoringRuleData | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Edit rule set dialog
  const [editSetDialogOpen, setEditSetDialogOpen] = React.useState(false);
  const [editSetName, setEditSetName] = React.useState(ruleSet.name);
  const [editSetDescription, setEditSetDescription] = React.useState(ruleSet.description ?? "");
  const [editSetMaxScore, setEditSetMaxScore] = React.useState(ruleSet.maxScore);

  // Rule form state
  const [formName, setFormName] = React.useState("");
  const [formCategory, setFormCategory] = React.useState<
    "FIELD_BASED" | "ACTIVITY_BASED" | "PROFILE_COMPLETENESS" | "DECAY"
  >("FIELD_BASED");
  const [formPoints, setFormPoints] = React.useState(10);
  const [formIsActive, setFormIsActive] = React.useState(true);

  // FIELD_BASED condition form
  const [condField, setCondField] = React.useState("source");
  const [condOperator, setCondOperator] = React.useState("equals");
  const [condValue, setCondValue] = React.useState("");

  // ACTIVITY_BASED condition form
  const [activityWithinDays, setActivityWithinDays] = React.useState(7);

  // PROFILE_COMPLETENESS condition form
  const [profileFields, setProfileFields] = React.useState<string[]>([]);

  // DECAY condition form
  const [decayField, setDecayField] = React.useState("updatedAt");
  const [decayIntervalDays, setDecayIntervalDays] = React.useState(7);

  const fetchRuleSet = React.useCallback(async () => {
    setLoading(true);
    const result = await getScoringRuleSet(ruleSet.id);
    if (result.success) {
      setRuleSet(result.data);
      setRules(result.data.rules ?? []);
    }
    setLoading(false);
  }, [ruleSet.id]);

  function getFieldsForEntityType() {
    switch (ruleSet.entityType) {
      case "LEAD": return LEAD_FIELDS;
      case "CONTACT": return CONTACT_FIELDS;
      case "DEAL": return DEAL_FIELDS;
      default: return LEAD_FIELDS;
    }
  }

  function getProfileFieldsForEntityType() {
    switch (ruleSet.entityType) {
      case "LEAD": return PROFILE_FIELDS_LEAD;
      case "CONTACT": return PROFILE_FIELDS_CONTACT;
      case "DEAL": return PROFILE_FIELDS_DEAL;
      default: return PROFILE_FIELDS_LEAD;
    }
  }

  function resetRuleForm() {
    setFormName("");
    setFormCategory("FIELD_BASED");
    setFormPoints(10);
    setFormIsActive(true);
    setCondField("source");
    setCondOperator("equals");
    setCondValue("");
    setActivityWithinDays(7);
    setProfileFields([]);
    setDecayField("updatedAt");
    setDecayIntervalDays(7);
    setEditingRule(null);
  }

  function openCreateDialog() {
    resetRuleForm();
    setRuleDialogOpen(true);
  }

  function openEditDialog(rule: ScoringRuleData) {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormCategory(
      rule.category as "FIELD_BASED" | "ACTIVITY_BASED" | "PROFILE_COMPLETENESS" | "DECAY"
    );
    setFormPoints(rule.points);
    setFormIsActive(rule.isActive);

    const conditions = (rule.conditions ?? []) as Record<string, unknown>[];
    const firstCond = conditions[0] ?? {};

    switch (rule.category) {
      case "FIELD_BASED":
        setCondField(String(firstCond.field ?? "source"));
        setCondOperator(String(firstCond.operator ?? "equals"));
        setCondValue(String(firstCond.value ?? ""));
        break;
      case "ACTIVITY_BASED":
        setActivityWithinDays(Number(firstCond.activityWithinDays ?? 7));
        break;
      case "PROFILE_COMPLETENESS":
        setProfileFields(
          Array.isArray(firstCond.fields) ? (firstCond.fields as string[]) : []
        );
        break;
      case "DECAY":
        setDecayField(String(firstCond.decayField ?? "updatedAt"));
        setDecayIntervalDays(Number(firstCond.decayIntervalDays ?? 7));
        break;
    }

    setRuleDialogOpen(true);
  }

  function buildConditions(): Record<string, unknown>[] {
    switch (formCategory) {
      case "FIELD_BASED":
        return [{ field: condField, operator: condOperator, value: condValue }];
      case "ACTIVITY_BASED":
        return [{ activityWithinDays }];
      case "PROFILE_COMPLETENESS":
        return [{ fields: profileFields }];
      case "DECAY":
        return [{ decayField, decayIntervalDays }];
      default:
        return [];
    }
  }

  async function handleSaveRule() {
    if (!formName.trim()) return;
    setSaving(true);

    const input = {
      name: formName.trim(),
      category: formCategory,
      points: formPoints,
      conditions: buildConditions(),
      isActive: formIsActive,
      order: editingRule?.order ?? rules.length,
    };

    if (editingRule) {
      const result = await updateScoringRule(editingRule.id, input);
      if (result.success) {
        toast.success("Rule updated");
        setRuleDialogOpen(false);
        resetRuleForm();
        fetchRuleSet();
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await createScoringRule(ruleSet.id, input);
      if (result.success) {
        toast.success("Rule created");
        setRuleDialogOpen(false);
        resetRuleForm();
        fetchRuleSet();
      } else {
        toast.error(result.error);
      }
    }

    setSaving(false);
  }

  async function handleDeleteRule(id: string) {
    const result = await deleteScoringRule(id);
    if (result.success) {
      toast.success("Rule deleted");
      fetchRuleSet();
    } else {
      toast.error(result.error);
    }
  }

  async function handleMoveRule(index: number, direction: "up" | "down") {
    const newRules = [...rules];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newRules.length) return;

    [newRules[index], newRules[swapIndex]] = [newRules[swapIndex], newRules[index]];
    setRules(newRules);

    const result = await reorderScoringRules(
      ruleSet.id,
      newRules.map((r) => r.id)
    );
    if (!result.success) {
      toast.error(result.error);
      fetchRuleSet();
    }
  }

  async function handleUpdateRuleSet() {
    setSaving(true);
    const result = await updateScoringRuleSet(ruleSet.id, {
      name: editSetName.trim(),
      entityType: ruleSet.entityType as "LEAD" | "CONTACT" | "DEAL",
      description: editSetDescription.trim() || undefined,
      maxScore: editSetMaxScore,
      isActive: ruleSet.isActive,
    });
    if (result.success) {
      toast.success("Rule set updated");
      setRuleSet(result.data);
      setEditSetDialogOpen(false);
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  function toggleProfileField(field: string) {
    setProfileFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  function formatConditionsSummary(rule: ScoringRuleData): string {
    const conditions = (rule.conditions ?? []) as Record<string, unknown>[];
    const first = conditions[0];
    if (!first) return "No conditions";

    switch (rule.category) {
      case "FIELD_BASED":
        return `${first.field} ${first.operator} "${first.value}"`;
      case "ACTIVITY_BASED":
        return `Activity within ${first.activityWithinDays} days`;
      case "PROFILE_COMPLETENESS": {
        const fields = Array.isArray(first.fields) ? first.fields : [];
        return `${fields.length} field${fields.length !== 1 ? "s" : ""}: ${(fields as string[]).join(", ")}`;
      }
      case "DECAY":
        return `${first.decayField} decay every ${first.decayIntervalDays} days`;
      default:
        return "Custom";
    }
  }

  return (
    <>
      {/* Rule Set Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">{ruleSet.name}</CardTitle>
              <Badge
                variant="outline"
                className={cn("text-xs", ENTITY_TYPE_STYLES[ruleSet.entityType])}
              >
                {ruleSet.entityType}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Max: {ruleSet.maxScore} pts
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditSetName(ruleSet.name);
                setEditSetDescription(ruleSet.description ?? "");
                setEditSetMaxScore(ruleSet.maxScore);
                setEditSetDialogOpen(true);
              }}
            >
              <PencilIcon className="mr-1 size-3.5" />
              Edit
            </Button>
          </div>
          {ruleSet.description && (
            <p className="text-sm text-zinc-500 mt-1">{ruleSet.description}</p>
          )}
        </CardHeader>
      </Card>

      {/* Rules List */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {rules.length} rule{rules.length !== 1 ? "s" : ""} in this set
        </p>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-2 size-4" />
          Add Rule
        </Button>
      </div>

      {loading && rules.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-zinc-500">
          <Loader2Icon className="mr-2 size-5 animate-spin" /> Loading rules...
        </div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <TargetIcon className="mx-auto mb-3 size-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              No rules yet. Add your first scoring rule to start evaluating{" "}
              {ruleSet.entityType.toLowerCase()}s.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <Card
              key={rule.id}
              className={cn(
                "border-zinc-200/80 shadow-sm",
                !rule.isActive && "opacity-50"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Reorder controls */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveRule(index, "up")}
                        disabled={index === 0}
                        className="text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                      >
                        <GripVerticalIcon className="size-4" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{rule.name}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", CATEGORY_STYLES[rule.category])}
                        >
                          {CATEGORY_LABELS[rule.category] ?? rule.category}
                        </Badge>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            rule.points >= 0 ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {rule.points >= 0 ? "+" : ""}
                          {rule.points} pts
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 truncate">
                        {formatConditionsSummary(rule)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(rule)}
                      title="Edit rule"
                    >
                      <PencilIcon className="size-4 text-zinc-500" />
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
                            onClick={() => handleDeleteRule(rule.id)}
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
          ))}
        </div>
      )}

      {/* Create / Edit Rule Dialog */}
      <Dialog
        open={ruleDialogOpen}
        onOpenChange={(open) => {
          setRuleDialogOpen(open);
          if (!open) resetRuleForm();
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Scoring Rule" : "Add Scoring Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the scoring rule configuration."
                : "Define how points are awarded or deducted."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., High budget lead bonus"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formCategory}
                  onValueChange={(v) =>
                    setFormCategory(
                      v as "FIELD_BASED" | "ACTIVITY_BASED" | "PROFILE_COMPLETENESS" | "DECAY"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD_BASED">Field Based</SelectItem>
                    <SelectItem value="ACTIVITY_BASED">Activity Based</SelectItem>
                    <SelectItem value="PROFILE_COMPLETENESS">Profile Completeness</SelectItem>
                    <SelectItem value="DECAY">Decay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Points{" "}
                  <span className="text-xs text-zinc-400">
                    ({formCategory === "DECAY" ? "negative per interval" : "awarded if matched"})
                  </span>
                </Label>
                <Input
                  type="number"
                  value={formPoints}
                  onChange={(e) => setFormPoints(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Condition Builder - changes based on category */}
            <div className="space-y-2 rounded-md border border-zinc-200 p-3">
              <Label className="text-sm font-medium text-zinc-700">Conditions</Label>

              {formCategory === "FIELD_BASED" && (
                <div className="grid grid-cols-3 gap-2">
                  <Select value={condField} onValueChange={setCondField}>
                    <SelectTrigger>
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFieldsForEntityType().map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={condOperator} onValueChange={setCondOperator}>
                    <SelectTrigger>
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="gt">Greater than</SelectItem>
                      <SelectItem value="gte">Greater or equal</SelectItem>
                      <SelectItem value="lt">Less than</SelectItem>
                      <SelectItem value="lte">Less or equal</SelectItem>
                      <SelectItem value="in">In (comma-sep)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={condValue}
                    onChange={(e) => setCondValue(e.target.value)}
                    placeholder="Value"
                  />
                </div>
              )}

              {formCategory === "ACTIVITY_BASED" && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">
                    Award points if the entity has communication activity within
                    the specified number of days.
                  </p>
                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap text-sm">Activity within</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={activityWithinDays}
                      onChange={(e) => setActivityWithinDays(Number(e.target.value))}
                    />
                    <span className="text-sm text-zinc-500">days</span>
                  </div>
                </div>
              )}

              {formCategory === "PROFILE_COMPLETENESS" && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">
                    Award proportional points based on how many of the selected
                    fields are filled in.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getProfileFieldsForEntityType().map((field) => (
                      <button
                        key={field}
                        type="button"
                        onClick={() => toggleProfileField(field)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs transition-colors",
                          profileFields.includes(field)
                            ? "border-purple-300 bg-purple-50 text-purple-700"
                            : "border-border bg-card text-zinc-600 hover:bg-zinc-50"
                        )}
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                  {profileFields.length > 0 && (
                    <p className="text-xs text-zinc-400">
                      {profileFields.length} field{profileFields.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              )}

              {formCategory === "DECAY" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    Deduct points for each interval that has passed since the
                    decay field&apos;s date. Set points to a negative number.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Decay Field</Label>
                      <Select value={decayField} onValueChange={setDecayField}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DECAY_FIELDS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Interval (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={decayIntervalDays}
                        onChange={(e) => setDecayIntervalDays(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRuleDialogOpen(false);
                resetRuleForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={!formName.trim() || saving}
            >
              {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              {editingRule ? "Save Changes" : "Add Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Set Dialog */}
      <Dialog open={editSetDialogOpen} onOpenChange={setEditSetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Rule Set</DialogTitle>
            <DialogDescription>
              Update the rule set name, description, or max score.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editSetName}
                onChange={(e) => setEditSetName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={editSetDescription}
                onChange={(e) => setEditSetDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Score</Label>
              <Input
                type="number"
                min={1}
                value={editSetMaxScore}
                onChange={(e) => setEditSetMaxScore(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRuleSet}
              disabled={!editSetName.trim() || saving}
            >
              {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
