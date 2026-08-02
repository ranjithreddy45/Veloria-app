"use client";

import * as React from "react";
import Link from "next/link";
import {
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  TargetIcon,
  PencilIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getScoringRuleSets,
  createScoringRuleSet,
  deleteScoringRuleSet,
  toggleScoringRuleSet,
  updateScoringRuleSet,
  type ScoringRuleSetData,
} from "@/actions/scoring-rule.actions";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
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
// Helpers
// ============================================================

const ENTITY_TYPE_HUE: Record<string, Hue> = {
  LEAD: "indigo",
  CONTACT: "teal",
  DEAL: "orange",
};

// ============================================================
// Component
// ============================================================

interface Props {
  initialData: ScoringRuleSetData[];
}

export function ScoringRuleSetsTable({ initialData }: Props) {
  const [ruleSets, setRuleSets] = React.useState<ScoringRuleSetData[]>(initialData);
  const [loading, setLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingSet, setEditingSet] = React.useState<ScoringRuleSetData | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formEntityType, setFormEntityType] = React.useState<"LEAD" | "CONTACT" | "DEAL">("LEAD");
  const [formDescription, setFormDescription] = React.useState("");
  const [formMaxScore, setFormMaxScore] = React.useState(100);
  const [formIsActive, setFormIsActive] = React.useState(true);

  const fetchRuleSets = React.useCallback(async () => {
    setLoading(true);
    const result = await getScoringRuleSets();
    if (result.success) setRuleSets(result.data);
    setLoading(false);
  }, []);

  function resetForm() {
    setFormName("");
    setFormEntityType("LEAD");
    setFormDescription("");
    setFormMaxScore(100);
    setFormIsActive(true);
    setEditingSet(null);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(set: ScoringRuleSetData) {
    setEditingSet(set);
    setFormName(set.name);
    setFormEntityType(set.entityType as "LEAD" | "CONTACT" | "DEAL");
    setFormDescription(set.description ?? "");
    setFormMaxScore(set.maxScore);
    setFormIsActive(set.isActive);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    const input = {
      name: formName.trim(),
      entityType: formEntityType,
      description: formDescription.trim() || undefined,
      isActive: formIsActive,
      maxScore: formMaxScore,
    };

    if (editingSet) {
      const result = await updateScoringRuleSet(editingSet.id, input);
      if (result.success) {
        toast.success("Rule set updated");
        setDialogOpen(false);
        resetForm();
        fetchRuleSets();
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await createScoringRuleSet(input);
      if (result.success) {
        toast.success("Rule set created");
        setDialogOpen(false);
        resetForm();
        fetchRuleSets();
      } else {
        toast.error(result.error);
      }
    }

    setSaving(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteScoringRuleSet(id);
    if (result.success) {
      toast.success("Rule set deleted");
      fetchRuleSets();
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    const result = await toggleScoringRuleSet(id, !currentActive);
    if (result.success) {
      toast.success(currentActive ? "Rule set disabled" : "Rule set enabled");
      fetchRuleSets();
    } else {
      toast.error(result.error);
    }
  }

  if (loading && ruleSets.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="space-y-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">
          <span className="numeric font-medium text-foreground">
            {ruleSets.length}
          </span>{" "}
          rule set{ruleSets.length !== 1 ? "s" : ""} configured
        </p>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-2 size-4" />
          Create Rule Set
        </Button>
      </div>

      {ruleSets.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card shadow-card">
          <EmptyState
            icon={<TargetIcon />}
            title="No scoring rule sets yet"
            description="Every lead looks equally promising until you score them. Build a rule set to rank leads, contacts or deals by the signals that actually predict a win."
            action={
              <Button onClick={openCreateDialog}>
                <PlusIcon className="mr-2 size-4" />
                Create first rule set
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {ruleSets.map((set) => (
            <div
              key={set.id}
              className={cn(
                "rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover",
                !set.isActive && "opacity-65"
              )}
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/settings/scoring-rules/${set.id}`}
                        className="text-copy font-semibold tracking-[-0.01em] hover:underline"
                      >
                        {set.name}
                      </Link>
                      <StatusPill
                        label={set.entityType}
                        hue={ENTITY_TYPE_HUE[set.entityType] ?? "neutral"}
                        size="xs"
                      />
                      <StatusPill
                        label={set.isActive ? "Active" : "Disabled"}
                        hue={set.isActive ? "emerald" : "slate"}
                        size="xs"
                      />
                    </div>

                    {set.description && (
                      <p className="mt-1 line-clamp-1 text-body text-muted-foreground">
                        {set.description}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta uppercase tracking-wide text-muted-foreground">
                      <span>
                        <span className="numeric font-medium text-foreground">
                          {set._count?.rules ?? 0}
                        </span>{" "}
                        rule{(set._count?.rules ?? 0) !== 1 ? "s" : ""}
                      </span>
                      <span aria-hidden className="text-border">
                        ·
                      </span>
                      <span>
                        Capped at{" "}
                        <span className="numeric font-medium text-foreground">
                          {set.maxScore}
                        </span>{" "}
                        pts
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" asChild title="Manage rules">
                      <Link href={`/settings/scoring-rules/${set.id}`}>
                        <ExternalLinkIcon className="size-4 text-muted-foreground" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(set)}
                      title="Edit rule set"
                    >
                      <PencilIcon className="size-4 text-muted-foreground" />
                    </Button>
                    <Switch
                      checked={set.isActive}
                      onCheckedChange={() => handleToggle(set.id, set.isActive)}
                      size="sm"
                      aria-label={set.isActive ? "Disable rule set" : "Enable rule set"}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" title="Delete rule set">
                          <TrashIcon className="size-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Rule Set</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete &quot;{set.name}&quot; and all its rules? This
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(set.id)}
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
          ))}
        </div>
      )}

      {/* Create / Edit Rule Set Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSet ? "Edit Rule Set" : "Create Scoring Rule Set"}
            </DialogTitle>
            <DialogDescription>
              {editingSet
                ? "Update the scoring rule set configuration."
                : "Define a new set of scoring rules for an entity type."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Lead Qualification Score"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select
                  value={formEntityType}
                  onValueChange={(v) => setFormEntityType(v as "LEAD" | "CONTACT" | "DEAL")}
                  disabled={!!editingSet}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="CONTACT">Contact</SelectItem>
                    <SelectItem value="DEAL">Deal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Score</Label>
                <Input
                  type="number"
                  min={1}
                  value={formMaxScore}
                  onChange={(e) => setFormMaxScore(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the purpose of this rule set"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formName.trim() || saving}
            >
              {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              {editingSet ? "Save Changes" : "Create Rule Set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
