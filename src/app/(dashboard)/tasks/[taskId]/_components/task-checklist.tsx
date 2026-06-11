"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, XIcon, Loader2Icon } from "lucide-react";

import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from "@/actions/task.actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface ChecklistItemData {
  id: string;
  title: string;
  isCompleted: boolean;
  order: number;
  completedAt: Date | null;
  createdAt: Date;
  taskId: string;
}

interface TaskChecklistProps {
  taskId: string;
  items: ChecklistItemData[];
}

// ============================================================
// Component
// ============================================================

export function TaskChecklist({ taskId, items }: TaskChecklistProps) {
  const router = useRouter();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Optimistic state
  const [optimisticItems, setOptimisticItems] = useState(items);

  // Sync with server data when items prop changes
  React.useEffect(() => {
    setOptimisticItems(items);
  }, [items]);

  const handleAddItem = async () => {
    const title = newItemTitle.trim();
    if (!title) return;

    setIsAdding(true);
    try {
      const result = await addChecklistItem(taskId, title);
      if (result.success) {
        setNewItemTitle("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to add item");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (itemId: string) => {
    setTogglingIds((prev) => new Set(prev).add(itemId));

    // Optimistic update
    setOptimisticItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, isCompleted: !item.isCompleted }
          : item
      )
    );

    startTransition(async () => {
      const result = await toggleChecklistItem(itemId);
      if (!result.success) {
        // Revert optimistic update
        setOptimisticItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, isCompleted: !item.isCompleted }
              : item
          )
        );
        toast.error(result.error);
      }
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      router.refresh();
    });
  };

  const handleDelete = async (itemId: string) => {
    setDeletingIds((prev) => new Set(prev).add(itemId));

    // Optimistic removal
    setOptimisticItems((prev) => prev.filter((item) => item.id !== itemId));

    startTransition(async () => {
      const result = await deleteChecklistItem(itemId);
      if (!result.success) {
        setOptimisticItems(items); // Revert
        toast.error(result.error);
      }
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      router.refresh();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="space-y-2">
      {/* Checklist Items */}
      {optimisticItems.length > 0 && (
        <div className="space-y-1">
          {optimisticItems.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-50 transition-colors"
            >
              <Checkbox
                checked={item.isCompleted}
                onCheckedChange={() => handleToggle(item.id)}
                disabled={togglingIds.has(item.id)}
                className="shrink-0"
              />
              <span
                className={cn(
                  "flex-1 text-sm transition-colors",
                  item.isCompleted
                    ? "line-through text-zinc-400"
                    : "text-zinc-700"
                )}
              >
                {item.title}
              </span>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingIds.has(item.id)}
                className="shrink-0 rounded p-0.5 text-zinc-300 opacity-100 [@media(hover:hover)]:opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {optimisticItems.length === 0 && (
        <p className="text-sm text-zinc-400 py-2">
          No checklist items yet. Add your first item below.
        </p>
      )}

      {/* Add New Item */}
      <div className="flex items-center gap-2 pt-2">
        <PlusIcon className="size-4 text-zinc-400 shrink-0" />
        <Input
          placeholder="Add a checklist item..."
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
          disabled={isAdding}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddItem}
          disabled={isAdding || !newItemTitle.trim()}
          className="h-8 shrink-0"
        >
          {isAdding ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            "Add"
          )}
        </Button>
      </div>
    </div>
  );
}
