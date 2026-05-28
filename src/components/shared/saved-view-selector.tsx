"use client";

import * as React from "react";
import {
  BookmarkIcon,
  ChevronDownIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  GlobeIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getSavedViews,
  createSavedView,
  deleteSavedView,
  setDefaultView,
  type SavedViewData,
} from "@/actions/saved-view.actions";
import type { SavedViewInput } from "@/schemas/saved-view.schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// ============================================================
// Props
// ============================================================

type EntityType = "CONTACT" | "LEAD" | "DEAL" | "TASK" | "INVOICE";

export interface SavedViewState {
  filters: Array<{ field: string; operator: string; value: unknown }>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  columns?: string[];
}

interface SavedViewSelectorProps {
  entityType: EntityType;
  onViewSelect?: (view: SavedViewData | null) => void;
  /**
   * Read current filter/sort state from the parent table so "Save current
   * view" actually captures something. Without this, saves are empty.
   */
  getCurrentState?: () => SavedViewState;
}

// ============================================================
// Component
// ============================================================

export function SavedViewSelector({
  entityType,
  onViewSelect,
  getCurrentState,
}: SavedViewSelectorProps) {
  const [views, setViews] = React.useState<SavedViewData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeView, setActiveView] = React.useState<SavedViewData | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [isShared, setIsShared] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fetchViews = React.useCallback(async () => {
    const result = await getSavedViews(entityType);
    if (result.success) {
      setViews(result.data);
      // Auto-select default view
      const defaultView = result.data.find((v) => v.isDefault);
      if (defaultView && !activeView) {
        setActiveView(defaultView);
        onViewSelect?.(defaultView);
      }
    }
    setLoading(false);
  }, [entityType, activeView, onViewSelect]);

  React.useEffect(() => {
    fetchViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  function handleSelect(view: SavedViewData | null) {
    setActiveView(view);
    onViewSelect?.(view);
  }

  async function handleSave() {
    if (!newName.trim()) return;
    setSaving(true);
    // Capture current filter/sort state from the parent table (if wired)
    const state = getCurrentState?.() ?? { filters: [] };
    const input: SavedViewInput = {
      name: newName.trim(),
      entityType,
      filters: state.filters as SavedViewInput["filters"],
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      columns: state.columns,
      isShared,
    };
    const result = await createSavedView(input);
    if (result.success) {
      toast.success("View saved");
      setDialogOpen(false);
      setNewName("");
      setIsShared(false);
      await fetchViews();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteSavedView(id);
    if (result.success) {
      toast.success("View deleted");
      if (activeView?.id === id) {
        setActiveView(null);
        onViewSelect?.(null);
      }
      await fetchViews();
    } else {
      toast.error(result.error);
    }
  }

  async function handleSetDefault(id: string) {
    const result = await setDefaultView(id, entityType);
    if (result.success) {
      toast.success("Default view updated");
      await fetchViews();
    } else {
      toast.error(result.error);
    }
  }

  const systemViews = views.filter((v) => v.isSystem);
  const myViews = views.filter((v) => !v.isSystem && !v.isShared);
  const sharedViews = views.filter((v) => !v.isSystem && v.isShared);

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        Views
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <BookmarkIcon className="mr-2 size-4" />
            {activeView ? activeView.name : "All Records"}
            <ChevronDownIcon className="ml-2 size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* All Records */}
          <DropdownMenuItem
            onClick={() => handleSelect(null)}
            className={cn(!activeView && "bg-accent")}
          >
            All Records
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {/* System Views */}
          {systemViews.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-zinc-400">
                System Views
              </DropdownMenuLabel>
              {systemViews.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => handleSelect(view)}
                  className={cn(activeView?.id === view.id && "bg-accent")}
                >
                  <BookmarkIcon className="mr-2 size-3.5 text-zinc-400" />
                  <span className="flex-1">{view.name}</span>
                  {view.isDefault && (
                    <StarIcon className="ml-1 size-3 fill-amber-400 text-amber-400" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}

          {/* My Views */}
          {myViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-zinc-400">
                  My Views
                </DropdownMenuLabel>
                {myViews.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    className={cn(
                      "group justify-between",
                      activeView?.id === view.id && "bg-accent"
                    )}
                    onClick={() => handleSelect(view)}
                  >
                    <span className="flex items-center gap-2">
                      <BookmarkIcon className="size-3.5 text-zinc-400" />
                      {view.name}
                    </span>
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetDefault(view.id);
                        }}
                        className="p-0.5 hover:text-amber-500"
                        title="Set as default"
                      >
                        <StarIcon className={cn("size-3", view.isDefault && "fill-amber-400 text-amber-400")} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(view.id);
                        }}
                        className="p-0.5 hover:text-red-500"
                        title="Delete view"
                      >
                        <TrashIcon className="size-3" />
                      </button>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}

          {/* Shared Views */}
          {sharedViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-zinc-400">
                  Shared Views
                </DropdownMenuLabel>
                {sharedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => handleSelect(view)}
                    className={cn(activeView?.id === view.id && "bg-accent")}
                  >
                    <GlobeIcon className="mr-2 size-3.5 text-zinc-400" />
                    {view.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}

          {/* Save Current View */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <PlusIcon className="mr-2 size-3.5" />
            Save Current View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save View Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Save the current filters and sorting as a named view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="viewName">View Name</Label>
              <Input
                id="viewName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Hot Leads, VIP Contacts"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="shared"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <Label htmlFor="shared" className="text-sm font-normal">
                Share with team
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!newName.trim() || saving}>
              {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
