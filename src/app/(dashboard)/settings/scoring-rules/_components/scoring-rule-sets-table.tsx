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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const ENTITY_TYPE_STYLES: Record<string, string> = {
  LEAD: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CONTACT: "border-teal-200 bg-teal-50 text-teal-700",
  DEAL: "border-orange-200 bg-orange-50 text-orange-700",
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
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2Icon className="mr-2 size-5 animate-spin" /> Loading rule sets...
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {ruleSets.length} rule set{ruleSets.length !== 1 ? "s" : ""} configured
        </p>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-2 size-4" />
          Create Rule Set
        </Button>
      </div>

      {ruleSets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <TargetIcon className="mx-auto mb-3 size-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              No scoring rule sets yet. Create your first rule set to define
              custom scoring logic for leads, contacts, or deals.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {ruleSets.map((set) => (
            <Card
              key={set.id}
              className={cn(
                "border-zinc-200/80 shadow-sm",
                !set.isActive && "opacity-50"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/settings/scoring-rules/${set.id}`}
                        className="font-medium hover:underline"
                      >
                        {set.name}
                      </Link>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", ENTITY_TYPE_STYLES[set.entityType])}
                      >
                        {set.entityType}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          set.isActive
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-zinc-200 bg-zinc-50 text-zinc-500"
                        )}
                      >
                        {set.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
                      {set.description && (
                        <span className="truncate max-w-md">{set.description}</span>
                      )}
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                        Max: {set.maxScore} pts
                      </span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                        {set._count?.rules ?? 0} rule{(set._count?.rules ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link href={`/settings/scoring-rules/${set.id}`}>
                      <Button variant="ghost" size="sm" title="Manage rules">
                        <ExternalLinkIcon className="size-4 text-zinc-500" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(set)}
                      title="Edit rule set"
                    >
                      <PencilIcon className="size-4 text-zinc-500" />
                    </Button>
                    <Switch
                      checked={set.isActive}
                      onCheckedChange={() => handleToggle(set.id, set.isActive)}
                      size="sm"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <TrashIcon className="size-4 text-red-500" />
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
              </CardContent>
            </Card>
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
            <div className="grid grid-cols-2 gap-4">
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
