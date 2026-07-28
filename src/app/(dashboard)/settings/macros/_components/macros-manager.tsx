"use client";

import * as React from "react";
import {
  PlusIcon,
  TrashIcon,
  ZapIcon,
  Loader2Icon,
  PlayIcon,
  ChevronRightIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getAllMacros,
  createMacro,
  deleteMacro,
  type MacroData,
} from "@/actions/macro.actions";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
// Action type labels
// ============================================================

const ACTION_TYPE_LABELS: Record<string, string> = {
  UPDATE_STATUS: "Update Status",
  UPDATE_FIELD: "Update Field",
  CREATE_TASK: "Create Task",
  LOG_COMMUNICATION: "Log Communication",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  LEAD: "Leads",
  CONTACT: "Contacts",
  DEAL: "Deals",
  BOOKING: "Bookings",
};

const ENTITY_HUE: Record<string, Hue> = {
  LEAD: "blue",
  CONTACT: "purple",
  DEAL: "indigo",
  BOOKING: "amber",
};

// ============================================================
// Component
// ============================================================

export function MacrosManager() {
  const [macros, setMacros] = React.useState<MacroData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formEntityType, setFormEntityType] = React.useState<"LEAD" | "CONTACT" | "DEAL" | "BOOKING">("LEAD");
  const [formActionType, setFormActionType] = React.useState("UPDATE_STATUS");
  const [formActionConfig, setFormActionConfig] = React.useState<Record<string, string>>({});

  const fetchMacros = React.useCallback(async () => {
    const result = await getAllMacros();
    if (result.success) setMacros(result.data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchMacros();
  }, [fetchMacros]);

  async function handleCreate() {
    if (!formName.trim()) return;
    setSaving(true);

    const result = await createMacro({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      entityType: formEntityType,
      actions: [
        {
          type: formActionType as "UPDATE_STATUS" | "UPDATE_FIELD" | "CREATE_TASK" | "LOG_COMMUNICATION",
          config: formActionConfig,
        },
      ],
    });

    if (result.success) {
      toast.success("Macro created");
      setDialogOpen(false);
      resetForm();
      fetchMacros();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteMacro(id);
    if (result.success) {
      toast.success("Macro deleted");
      fetchMacros();
    } else {
      toast.error(result.error);
    }
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormEntityType("LEAD");
    setFormActionType("UPDATE_STATUS");
    setFormActionConfig({});
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

  const entityTypes = ["LEAD", "CONTACT", "DEAL", "BOOKING"];
  const macrosByEntity = entityTypes.reduce(
    (acc, et) => {
      acc[et] = macros.filter((m) => m.entityType === et);
      return acc;
    },
    {} as Record<string, MacroData[]>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          <span className="numeric font-medium text-foreground">
            {macros.length}
          </span>{" "}
          macro{macros.length !== 1 ? "s" : ""} configured
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon className="mr-2 size-4" />
          Add Macro
        </Button>
      </div>

      {macros.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card shadow-card">
          <EmptyState
            icon={<ZapIcon />}
            title="No macros yet"
            description="Think of the three-step routine your team does on every new enquiry. Turn it into a macro and it becomes a single click."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <PlusIcon className="mr-2 size-4" />
                Create first macro
              </Button>
            }
          />
        </div>
      ) : (
        <Tabs defaultValue="LEAD">
          <TabsList>
            {entityTypes.map((et) => (
              <TabsTrigger key={et} value={et}>
                {ENTITY_TYPE_LABELS[et]} ({macrosByEntity[et].length})
              </TabsTrigger>
            ))}
          </TabsList>
          {entityTypes.map((et) => (
            <TabsContent key={et} value={et} className="mt-4">
              {macrosByEntity[et].length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card shadow-card">
                  <EmptyState
                    icon={<ZapIcon />}
                    title={`No macros for ${ENTITY_TYPE_LABELS[et].toLowerCase()}`}
                    description="Macros are scoped to one record type. Add one here and it shows up as a one-click action on every record of this kind."
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {macrosByEntity[et].map((macro) => {
                    const actions = macro.actions as Array<{ type: string; config: Record<string, unknown> }>;
                    return (
                      <div
                        key={macro.id}
                        className="rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover"
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span
                                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                                  style={{ backgroundColor: macro.color + "1f", color: macro.color }}
                                  aria-hidden
                                >
                                  <ZapIcon className="size-4" />
                                </span>
                                <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
                                  {macro.name}
                                </h3>
                                <StatusPill
                                  label={macro.entityType}
                                  hue={ENTITY_HUE[macro.entityType] ?? "neutral"}
                                  size="xs"
                                />
                                {macro.isShared && (
                                  <StatusPill label="Shared" hue="slate" size="xs" />
                                )}
                              </div>

                              {macro.description && (
                                <p className="mt-1.5 text-[13px] text-muted-foreground">
                                  {macro.description}
                                </p>
                              )}

                              {/* Step chain */}
                              <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                                {actions.map((a, i) => (
                                  <React.Fragment key={`${macro.id}-step-${i}`}>
                                    {i > 0 && (
                                      <ChevronRightIcon
                                        className="size-3.5 shrink-0 text-muted-foreground"
                                        aria-hidden
                                      />
                                    )}
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[12.5px] font-medium">
                                      <PlayIcon className="size-2.5 text-muted-foreground" />
                                      {ACTION_TYPE_LABELS[a.type] || a.type}
                                    </span>
                                  </React.Fragment>
                                ))}
                              </div>

                              <p className="mt-2.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                                <span className="numeric font-medium text-foreground">
                                  {actions.length}
                                </span>{" "}
                                step{actions.length !== 1 ? "s" : ""} · one click
                              </p>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="Delete macro">
                                  <TrashIcon className="size-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Macro</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Delete &quot;{macro.name}&quot;? This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(macro.id)}
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
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Create Macro Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Macro</DialogTitle>
            <DialogDescription>
              Define a one-click action that runs multiple steps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Send Follow-up"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select value={formEntityType} onValueChange={(v) => setFormEntityType(v as "LEAD" | "CONTACT" | "DEAL" | "BOOKING")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="CONTACT">Contact</SelectItem>
                    <SelectItem value="DEAL">Deal</SelectItem>
                    <SelectItem value="BOOKING">Booking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select value={formActionType} onValueChange={setFormActionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPDATE_STATUS">Update Status</SelectItem>
                    <SelectItem value="UPDATE_FIELD">Update Field</SelectItem>
                    <SelectItem value="CREATE_TASK">Create Task</SelectItem>
                    <SelectItem value="LOG_COMMUNICATION">Log Communication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dynamic config based on action type */}
            {formActionType === "UPDATE_STATUS" && (
              <div className="space-y-2">
                <Label>New Status</Label>
                <Input
                  value={formActionConfig.status || ""}
                  onChange={(e) => setFormActionConfig({ ...formActionConfig, status: e.target.value })}
                  placeholder="e.g., CONTACTED, QUALIFIED"
                />
              </div>
            )}
            {formActionType === "CREATE_TASK" && (
              <div className="space-y-2">
                <Label>Task Title</Label>
                <Input
                  value={formActionConfig.title || ""}
                  onChange={(e) => setFormActionConfig({ ...formActionConfig, title: e.target.value })}
                  placeholder="e.g., Follow up with client"
                />
              </div>
            )}
            {formActionType === "LOG_COMMUNICATION" && (
              <div className="space-y-2">
                <Label>Note Content</Label>
                <Input
                  value={formActionConfig.content || ""}
                  onChange={(e) => setFormActionConfig({ ...formActionConfig, content: e.target.value })}
                  placeholder="e.g., Follow-up call scheduled"
                />
              </div>
            )}
            {formActionType === "UPDATE_FIELD" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Field</Label>
                  <Input
                    value={formActionConfig.field || ""}
                    onChange={(e) => setFormActionConfig({ ...formActionConfig, field: e.target.value })}
                    placeholder="Field name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    value={formActionConfig.value || ""}
                    onChange={(e) => setFormActionConfig({ ...formActionConfig, value: e.target.value })}
                    placeholder="New value"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || saving}>
              {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Create Macro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
