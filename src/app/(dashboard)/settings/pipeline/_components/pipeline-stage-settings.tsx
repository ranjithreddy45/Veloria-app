"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  Trophy,
  XCircle,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
} from "@/actions/pipeline.actions";

// ============================================================
// Types
// ============================================================

type StageItem = {
  id: string;
  name: string;
  order: number;
  color: string;
  isDefault: boolean;
  isWonStage: boolean;
  isLostStage: boolean;
  dealCount: number;
};

interface PipelineStageSettingsProps {
  initialStages: StageItem[];
}

// ============================================================
// Color Presets
// ============================================================

const COLOR_PRESETS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#22c55e", // Green
  "#eab308", // Yellow
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#ef4444", // Red
  "#ec4899", // Pink
  "#64748b", // Slate
];

// ============================================================
// Component
// ============================================================

export function PipelineStageSettings({
  initialStages,
}: PipelineStageSettingsProps) {
  const [stages, setStages] = useState<StageItem[]>(initialStages);
  const [isPending, startTransition] = useTransition();

  // Add stage dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");

  // Edit stage dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editStage, setEditStage] = useState<StageItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // ========================================
  // Create Stage
  // ========================================

  const handleCreateStage = () => {
    if (!newStageName.trim()) {
      toast.error("Please enter a stage name");
      return;
    }

    startTransition(async () => {
      const result = await createPipelineStage({
        name: newStageName.trim(),
        color: newStageColor,
      });

      if (result.success) {
        toast.success("Stage created successfully");
        setStages((prev) => [
          ...prev,
          {
            id: result.data.id,
            name: result.data.name,
            order: result.data.order,
            color: result.data.color,
            isDefault: result.data.isDefault,
            isWonStage: result.data.isWonStage,
            isLostStage: result.data.isLostStage,
            dealCount: 0,
          },
        ]);
        setNewStageName("");
        setNewStageColor("#6366f1");
        setAddDialogOpen(false);
      } else {
        toast.error("Failed to create stage", { description: result.error });
      }
    });
  };

  // ========================================
  // Edit Stage
  // ========================================

  const openEditDialog = (stage: StageItem) => {
    setEditStage(stage);
    setEditName(stage.name);
    setEditColor(stage.color);
    setEditDialogOpen(true);
  };

  const handleUpdateStage = () => {
    if (!editStage || !editName.trim()) return;

    startTransition(async () => {
      const result = await updatePipelineStage(editStage.id, {
        name: editName.trim(),
        color: editColor,
      });

      if (result.success) {
        toast.success("Stage updated successfully");
        setStages((prev) =>
          prev.map((s) =>
            s.id === editStage.id
              ? { ...s, name: editName.trim(), color: editColor }
              : s
          )
        );
        setEditDialogOpen(false);
        setEditStage(null);
      } else {
        toast.error("Failed to update stage", { description: result.error });
      }
    });
  };

  // ========================================
  // Delete Stage
  // ========================================

  const handleDeleteStage = (stage: StageItem) => {
    startTransition(async () => {
      const result = await deletePipelineStage(stage.id);

      if (result.success) {
        toast.success("Stage deleted successfully");
        setStages((prev) => prev.filter((s) => s.id !== stage.id));
      } else {
        toast.error("Failed to delete stage", { description: result.error });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Stage List */}
      <div className="rounded-xl border border-border bg-card">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              index !== stages.length - 1
                ? "border-b border-zinc-100"
                : ""
            }`}
          >
            {/* Drag Handle Placeholder */}
            <GripVertical className="size-4 text-zinc-300" />

            {/* Color indicator */}
            <div
              className="size-4 rounded-full shrink-0"
              style={{ backgroundColor: stage.color }}
            />

            {/* Stage Name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-800 truncate">
                  {stage.name}
                </span>
                {stage.isWonStage && (
                  <Badge className="bg-green-100 text-green-800 text-[10px] gap-1">
                    <Trophy className="size-2.5" />
                    Won Stage
                  </Badge>
                )}
                {stage.isLostStage && (
                  <Badge className="bg-red-100 text-red-800 text-[10px] gap-1">
                    <XCircle className="size-2.5" />
                    Lost Stage
                  </Badge>
                )}
                {stage.isDefault && (
                  <Badge variant="secondary" className="text-[10px]">
                    Default
                  </Badge>
                )}
              </div>
            </div>

            {/* Deal Count */}
            <span className="text-xs text-zinc-400 shrink-0">
              {stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                size="icon-xs"
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-700"
                onClick={() => openEditDialog(stage)}
              >
                <Pencil className="size-3.5" />
              </Button>

              {stage.isWonStage || stage.isLostStage ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-zinc-300 cursor-not-allowed"
                  disabled
                  title="System stages cannot be deleted"
                >
                  <Lock className="size-3.5" />
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-zinc-400 hover:text-red-600"
                      disabled={stage.dealCount > 0}
                      title={
                        stage.dealCount > 0
                          ? "Move deals before deleting"
                          : "Delete stage"
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete &quot;{stage.name}&quot;?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {stage.dealCount > 0
                          ? `This stage has ${stage.dealCount} deals. Move or delete them before removing this stage.`
                          : "This action cannot be undone. The stage will be permanently removed from your pipeline."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      {stage.dealCount === 0 && (
                        <AlertDialogAction
                          onClick={() => handleDeleteStage(stage)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      )}
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ))}

        {stages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-zinc-400">
              No pipeline stages configured yet.
            </p>
          </div>
        )}
      </div>

      {/* Add Stage Button */}
      <Button
        variant="outline"
        onClick={() => setAddDialogOpen(true)}
        className="gap-2"
      >
        <Plus className="size-4" />
        Add Stage
      </Button>

      {/* Add Stage Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Pipeline Stage</DialogTitle>
            <DialogDescription>
              Create a new stage for your sales pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-stage-name">Stage Name</Label>
              <Input
                id="new-stage-name"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="e.g., Proposal Sent"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`size-7 rounded-full border-2 transition-all ${
                      newStageColor === color
                        ? "border-zinc-900 scale-110"
                        : "border-transparent hover:border-zinc-300"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewStageColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="custom-color" className="text-xs text-zinc-500">
                  Custom:
                </Label>
                <Input
                  id="custom-color"
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="h-8 w-16 p-1"
                />
                <span className="text-xs text-zinc-400">{newStageColor}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStage}
              disabled={isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Stage"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stage Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
            <DialogDescription>
              Update the name or color of this pipeline stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-stage-name">Stage Name</Label>
              <Input
                id="edit-stage-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`size-7 rounded-full border-2 transition-all ${
                      editColor === color
                        ? "border-zinc-900 scale-110"
                        : "border-transparent hover:border-zinc-300"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label
                  htmlFor="edit-custom-color"
                  className="text-xs text-zinc-500"
                >
                  Custom:
                </Label>
                <Input
                  id="edit-custom-color"
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-8 w-16 p-1"
                />
                <span className="text-xs text-zinc-400">{editColor}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStage}
              disabled={isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
