"use client";

import * as React from "react";
import {
  XIcon,
  TrashIcon,
  UserIcon,
  TagIcon,
  Loader2Icon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

// ============================================================
// Types
// ============================================================

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive";
  requireConfirm?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  onClick: (selectedIds: string[]) => Promise<void>;
}

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  actions: BulkAction[];
  onClearSelection: () => void;
}

// ============================================================
// Component
// ============================================================

export function BulkActionBar({
  selectedCount,
  selectedIds,
  actions,
  onClearSelection,
}: BulkActionBarProps) {
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  if (selectedCount === 0) return null;

  async function handleAction(action: BulkAction) {
    setLoadingAction(action.id);
    try {
      await action.onClick(selectedIds);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg",
        "animate-in slide-in-from-bottom-4 fade-in duration-200"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {selectedCount}
        </span>
        <span className="text-sm font-medium text-muted-foreground">selected</span>
      </div>

      <div className="mx-1 h-6 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        {actions.map((action) => {
          if (action.requireConfirm) {
            return (
              <AlertDialog key={action.id}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant={action.variant === "destructive" ? "destructive" : "outline"}
                    size="sm"
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === action.id ? (
                      <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <action.icon className="mr-1.5 size-3.5" />
                    )}
                    {action.label}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {action.confirmTitle || "Confirm Action"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {action.confirmDescription ||
                        `Are you sure you want to ${action.label.toLowerCase()} ${selectedCount} record(s)? This action cannot be undone.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleAction(action)}
                      className={cn(
                        action.variant === "destructive" &&
                          "bg-destructive text-white hover:bg-destructive/90"
                      )}
                    >
                      {action.label}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            );
          }

          return (
            <Button
              key={action.id}
              variant={action.variant === "destructive" ? "destructive" : "outline"}
              size="sm"
              onClick={() => handleAction(action)}
              disabled={loadingAction !== null}
            >
              {loadingAction === action.id ? (
                <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <action.icon className="mr-1.5 size-3.5" />
              )}
              {action.label}
            </Button>
          );
        })}
      </div>

      <div className="mx-1 h-6 w-px bg-border" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="text-muted-foreground"
      >
        <XIcon className="mr-1 size-3.5" />
        Clear
      </Button>
    </div>
  );
}

// Re-export icons for convenience
export { TrashIcon, UserIcon, TagIcon };
