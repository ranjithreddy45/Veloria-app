"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  PlusIcon,
  MoreHorizontalIcon,
  PlayIcon,
  PauseIcon,
  ArchiveIcon,
  Trash2Icon,
  PencilIcon,
} from "lucide-react";

import type { CadenceListItem } from "@/actions/cadence.actions";
import {
  createCadence,
  updateCadence,
  deleteCadence,
  toggleCadenceStatus,
} from "@/actions/cadence.actions";
import type { CadenceInput } from "@/schemas/cadence.schema";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CadenceForm } from "./cadence-form";

// ============================================================
// Constants
// ============================================================

const STATUS_BADGE_MAP: Record<string, string> = {
  DRAFT: "bg-muted text-foreground/80 border-border",
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  PAUSED: "bg-amber-100 text-amber-700 border-amber-200",
  ARCHIVED: "bg-slate-100 text-slate-700 border-slate-200",
};

const ENTITY_TYPE_BADGE_MAP: Record<string, string> = {
  LEAD: "bg-blue-100 text-blue-700 border-blue-200",
  CONTACT: "bg-purple-100 text-purple-700 border-purple-200",
};

// ============================================================
// Props
// ============================================================

interface CadencesTableProps {
  cadences: CadenceListItem[];
}

// ============================================================
// Component
// ============================================================

export function CadencesTable({ cadences }: CadencesTableProps) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<CadenceListItem | null>(null);
  const [deleting, setDeleting] = React.useState<CadenceListItem | null>(null);
  const [loading, setLoading] = React.useState(false);

  // ---- Create ----
  async function handleCreate(input: CadenceInput) {
    setLoading(true);
    const result = await createCadence(input);
    setLoading(false);

    if (result.success) {
      toast.success("Cadence created");
      setCreating(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ---- Update ----
  async function handleUpdate(input: CadenceInput) {
    if (!editing) return;
    setLoading(true);
    const result = await updateCadence(editing.id, input);
    setLoading(false);

    if (result.success) {
      toast.success("Cadence updated");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    if (!deleting) return;
    setLoading(true);
    const result = await deleteCadence(deleting.id);
    setLoading(false);

    if (result.success) {
      toast.success("Cadence deleted");
      setDeleting(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ---- Status Toggle ----
  async function handleStatusToggle(id: string, targetStatus: string) {
    const result = await toggleCadenceStatus(id, targetStatus);
    if (result.success) {
      toast.success(`Cadence status changed to ${targetStatus}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cadences</CardTitle>
            <CardDescription>
              {cadences.length} cadence{cadences.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Cadence
          </Button>
        </CardHeader>
        <CardContent>
          {cadences.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              No cadences yet. Create your first cadence to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead className="text-center">Steps</TableHead>
                  <TableHead className="text-center">Enrollments</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cadences.map((cadence) => (
                  <TableRow key={cadence.id}>
                    <TableCell>
                      <Link
                        href={`/crm/cadences/${cadence.id}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {cadence.name}
                      </Link>
                      {cadence.description && (
                        <p className="text-muted-foreground mt-0.5 text-xs line-clamp-1">
                          {cadence.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_MAP[cadence.status] ?? ""}
                      >
                        {cadence.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          ENTITY_TYPE_BADGE_MAP[cadence.entityType] ?? ""
                        }
                      >
                        {cadence.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {cadence._count.steps}
                    </TableCell>
                    <TableCell className="text-center">
                      {cadence._count.enrollments}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(cadence.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Edit (only DRAFT/PAUSED) */}
                          {["DRAFT", "PAUSED"].includes(cadence.status) && (
                            <DropdownMenuItem
                              onClick={() => setEditing(cadence)}
                            >
                              <PencilIcon className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}

                          {/* Status transitions */}
                          {cadence.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusToggle(cadence.id, "ACTIVE")
                              }
                            >
                              <PlayIcon className="mr-2 h-4 w-4" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          {cadence.status === "ACTIVE" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusToggle(cadence.id, "PAUSED")
                              }
                            >
                              <PauseIcon className="mr-2 h-4 w-4" />
                              Pause
                            </DropdownMenuItem>
                          )}
                          {cadence.status === "PAUSED" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusToggle(cadence.id, "ACTIVE")
                              }
                            >
                              <PlayIcon className="mr-2 h-4 w-4" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          {["ACTIVE", "PAUSED"].includes(cadence.status) && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusToggle(cadence.id, "ARCHIVED")
                              }
                            >
                              <ArchiveIcon className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          )}

                          {/* Delete (only DRAFT/ARCHIVED) */}
                          {["DRAFT", "ARCHIVED"].includes(cadence.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleting(cadence)}
                              >
                                <Trash2Icon className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Cadence</DialogTitle>
          </DialogHeader>
          <CadenceForm
            onSubmit={handleCreate}
            loading={loading}
            onCancel={() => setCreating(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Cadence</DialogTitle>
          </DialogHeader>
          {editing && (
            <CadenceForm
              defaultValues={{
                name: editing.name,
                description: editing.description ?? undefined,
                entityType: editing.entityType as "LEAD" | "CONTACT",
                exitCriteria: editing.exitCriteria ?? [],
                autoEnroll: editing.autoEnroll,
                autoEnrollCriteria:
                  (editing.autoEnrollCriteria as Array<{
                    field: string;
                    operator: "equals" | "contains" | "in" | "notIn" | "gt" | "lt" | "gte" | "lte";
                    value: string | number | string[];
                  }>) ?? undefined,
              }}
              onSubmit={handleUpdate}
              loading={loading}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cadence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleting?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
