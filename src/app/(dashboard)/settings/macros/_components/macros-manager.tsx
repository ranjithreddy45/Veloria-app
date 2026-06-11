"use client";

import * as React from "react";
import {
  PlusIcon,
  TrashIcon,
  ZapIcon,
  Loader2Icon,
  PlayIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getAllMacros,
  createMacro,
  deleteMacro,
  type MacroData,
} from "@/actions/macro.actions";
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
import { cn } from "@/lib/utils";

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

const ENTITY_COLORS: Record<string, string> = {
  LEAD: "border-blue-200 bg-blue-50 text-blue-700",
  CONTACT: "border-purple-200 bg-purple-50 text-purple-700",
  DEAL: "border-indigo-200 bg-indigo-50 text-indigo-700",
  BOOKING: "border-amber-200 bg-amber-50 text-amber-700",
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
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2Icon className="mr-2 size-5 animate-spin" /> Loading macros...
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {macros.length} macro{macros.length !== 1 ? "s" : ""} configured
        </p>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon className="mr-2 size-4" />
          Add Macro
        </Button>
      </div>

      {macros.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ZapIcon className="mx-auto mb-3 size-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              No macros yet. Create your first macro to automate repetitive CRM
              actions.
            </p>
          </CardContent>
        </Card>
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
                <p className="py-8 text-center text-sm text-zinc-400">
                  No macros for {ENTITY_TYPE_LABELS[et].toLowerCase()}
                </p>
              ) : (
                <div className="space-y-3">
                  {macrosByEntity[et].map((macro) => {
                    const actions = macro.actions as Array<{ type: string; config: Record<string, unknown> }>;
                    return (
                      <Card
                        key={macro.id}
                        className="border-zinc-200/80 shadow-sm"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex size-8 items-center justify-center rounded-lg"
                                  style={{ backgroundColor: macro.color + "20", color: macro.color }}
                                >
                                  <ZapIcon className="size-4" />
                                </div>
                                <div>
                                  <h3 className="font-medium">{macro.name}</h3>
                                  {macro.description && (
                                    <p className="text-xs text-zinc-500">
                                      {macro.description}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs", ENTITY_COLORS[macro.entityType])}
                                >
                                  {macro.entityType}
                                </Badge>
                                {macro.isShared && (
                                  <Badge variant="outline" className="text-xs">
                                    Shared
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {actions.map((a, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    <PlayIcon className="mr-1 size-2.5" />
                                    {ACTION_TYPE_LABELS[a.type] || a.type}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <TrashIcon className="size-4 text-red-500" />
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
                        </CardContent>
                      </Card>
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
