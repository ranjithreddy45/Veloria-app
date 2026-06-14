"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MoreHorizontalIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  FileTextIcon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createTransition,
  updateTransition,
  deleteTransition,
} from "@/actions/blueprint.actions";
import { TransitionForm } from "./transition-form";
import type { BlueprintTransitionInput } from "@/schemas/blueprint.schema";

// ============================================================
// Transition Type
// ============================================================

interface Transition {
  id: string;
  fromStatus: string;
  toStatus: string;
  name: string | null;
  requiredFields: unknown;
  requiredActions: unknown;
  allowedRoles: string[];
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Status Label Maps
// ============================================================

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  HOLD: "Hold",
  TENTATIVE: "Tentative",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SALES_EXEC: "Sales Exec",
  SALES_HEAD: "Sales Head",
  EVENT_COORDINATOR: "Event Coord.",
  FINANCE: "Finance",
  STAFF: "Staff",
};

// ============================================================
// Helper: Format status label
// ============================================================

function formatStatus(status: string, entityType: string): string {
  if (entityType === "LEAD") return LEAD_STATUS_LABELS[status] ?? status;
  if (entityType === "BOOKING") return BOOKING_STATUS_LABELS[status] ?? status;
  // DEAL uses pipeline stage IDs — just show the value as-is
  return status;
}

// ============================================================
// TransitionsList Props
// ============================================================

interface TransitionsListProps {
  blueprintId: string;
  entityType: string;
  transitions: Transition[];
}

// ============================================================
// TransitionsList Component
// ============================================================

export function TransitionsList({
  blueprintId,
  entityType,
  transitions,
}: TransitionsListProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingTransition, setEditingTransition] =
    React.useState<Transition | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const handleCreate = async (input: BlueprintTransitionInput) => {
    setIsPending(true);
    try {
      const result = await createTransition(blueprintId, input);
      if (result.success) {
        toast.success("Transition added successfully");
        setCreateOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsPending(false);
    }
  };

  const handleUpdate = async (input: BlueprintTransitionInput) => {
    if (!editingTransition) return;
    setIsPending(true);
    try {
      const result = await updateTransition(editingTransition.id, input);
      if (result.success) {
        toast.success("Transition updated successfully");
        setEditingTransition(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteTransition(id);
    if (result.success) {
      toast.success("Transition deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Transitions</CardTitle>
          <CardDescription>
            Define allowed status changes and their requirements.
          </CardDescription>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon className="mr-2 size-4" />
              Add Transition
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Transition</DialogTitle>
            </DialogHeader>
            <TransitionForm
              entityType={entityType}
              onSubmit={handleCreate}
              isPending={isPending}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {transitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No transitions defined. Add transitions to define your process
              flow.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transition</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transitions.map((transition) => {
                  const reqFields = (transition.requiredFields as string[]) ?? [];
                  const reqActions =
                    (transition.requiredActions as string[]) ?? [];

                  return (
                    <TableRow key={transition.id}>
                      {/* From -> To */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {formatStatus(transition.fromStatus, entityType)}
                          </Badge>
                          <ArrowRightIcon className="size-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">
                            {formatStatus(transition.toStatus, entityType)}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <span className="text-sm">
                          {transition.name || "--"}
                        </span>
                      </TableCell>

                      {/* Requirements */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {reqFields.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-xs gap-1"
                            >
                              <FileTextIcon className="size-3" />
                              {reqFields.length} field
                              {reqFields.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          {reqActions.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-xs gap-1"
                            >
                              <ZapIcon className="size-3" />
                              {reqActions.length} action
                              {reqActions.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          {reqFields.length === 0 &&
                            reqActions.length === 0 && (
                              <span className="text-sm text-muted-foreground">
                                None
                              </span>
                            )}
                        </div>
                      </TableCell>

                      {/* Allowed Roles */}
                      <TableCell>
                        {transition.allowedRoles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {transition.allowedRoles.slice(0, 2).map((role) => (
                              <Badge
                                key={role}
                                variant="outline"
                                className="text-xs gap-1"
                              >
                                <ShieldCheckIcon className="size-3" />
                                {ROLE_LABELS[role] ?? role}
                              </Badge>
                            ))}
                            {transition.allowedRoles.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{transition.allowedRoles.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            All roles
                          </span>
                        )}
                      </TableCell>

                      {/* Active */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            transition.isActive
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                          }
                        >
                          {transition.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-xs">
                                <MoreHorizontalIcon className="size-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setEditingTransition(transition)
                                }
                              >
                                <PencilIcon className="mr-2 size-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">
                                  <TrashIcon className="mr-2 size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Transition
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the transition
                                from{" "}
                                <span className="font-medium">
                                  {formatStatus(
                                    transition.fromStatus,
                                    entityType
                                  )}
                                </span>{" "}
                                to{" "}
                                <span className="font-medium">
                                  {formatStatus(
                                    transition.toStatus,
                                    entityType
                                  )}
                                </span>
                                ? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(transition.id)}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit Transition Dialog */}
      <Dialog
        open={!!editingTransition}
        onOpenChange={(open) => {
          if (!open) setEditingTransition(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Transition</DialogTitle>
          </DialogHeader>
          {editingTransition && (
            <TransitionForm
              entityType={entityType}
              defaultValues={{
                id: editingTransition.id,
                fromStatus: editingTransition.fromStatus,
                toStatus: editingTransition.toStatus,
                name: editingTransition.name ?? undefined,
                requiredFields:
                  (editingTransition.requiredFields as string[]) ?? [],
                requiredActions:
                  (editingTransition.requiredActions as string[]) ?? [],
                allowedRoles: editingTransition.allowedRoles,
                isActive: editingTransition.isActive,
                order: editingTransition.order,
              }}
              onSubmit={handleUpdate}
              isPending={isPending}
              onCancel={() => setEditingTransition(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
