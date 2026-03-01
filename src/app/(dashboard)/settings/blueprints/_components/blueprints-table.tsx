"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon,
  Loader2Icon,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteBlueprint,
  toggleBlueprint,
  createBlueprint,
} from "@/actions/blueprint.actions";
import { BlueprintForm } from "./blueprint-form";
import { formatDate } from "@/lib/utils";
import type { BlueprintInput } from "@/schemas/blueprint.schema";

// ============================================================
// Blueprint Type
// ============================================================

interface Blueprint {
  id: string;
  name: string;
  entityType: string;
  description: string | null;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null; email: string };
  _count: { transitions: number };
}

// ============================================================
// Entity Type Badge Colors
// ============================================================

const ENTITY_TYPE_COLORS: Record<string, string> = {
  LEAD: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DEAL: "bg-orange-100 text-orange-800 border-orange-200",
  BOOKING: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

// ============================================================
// Active Toggle Cell
// ============================================================

function ActiveToggle({ blueprint }: { blueprint: Blueprint }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleToggle = async () => {
    setPending(true);
    try {
      const result = await toggleBlueprint(blueprint.id, !blueprint.isActive);
      if (result.success) {
        toast.success(
          !blueprint.isActive
            ? "Blueprint activated. Other blueprints for the same entity type have been deactivated."
            : "Blueprint deactivated"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to toggle blueprint");
    } finally {
      setPending(false);
    }
  };

  return (
    <Switch
      checked={blueprint.isActive}
      onCheckedChange={handleToggle}
      disabled={pending}
      aria-label={
        blueprint.isActive ? "Deactivate blueprint" : "Activate blueprint"
      }
    />
  );
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ blueprint }: { blueprint: Blueprint }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteBlueprint(blueprint.id);
    if (result.success) {
      toast.success("Blueprint deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs">
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/settings/blueprints/${blueprint.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View & Edit Transitions
            </Link>
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
          <AlertDialogTitle>Delete Blueprint</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{blueprint.name}</span>? This action
            cannot be undone. All transitions and transition logs will also be
            deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// BlueprintsTable Component
// ============================================================

interface BlueprintsTableProps {
  data: Blueprint[];
}

export function BlueprintsTable({ data }: BlueprintsTableProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const handleCreate = async (input: BlueprintInput) => {
    setIsPending(true);
    try {
      const result = await createBlueprint(input);
      if (result.success) {
        toast.success("Blueprint created successfully");
        setCreateOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Process Blueprints</CardTitle>
          <CardDescription>
            Define allowed status transitions and their requirements.
          </CardDescription>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 size-4" />
              New Blueprint
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Blueprint</DialogTitle>
            </DialogHeader>
            <BlueprintForm
              onSubmit={handleCreate}
              isPending={isPending}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No blueprints created yet. Create your first blueprint to start
              enforcing process flows.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Transitions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((blueprint) => (
                  <TableRow key={blueprint.id}>
                    <TableCell>
                      <Link
                        href={`/settings/blueprints/${blueprint.id}`}
                        className="font-medium hover:underline"
                      >
                        {blueprint.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          ENTITY_TYPE_COLORS[blueprint.entityType] ??
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {blueprint.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {blueprint._count.transitions} transition
                        {blueprint._count.transitions !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {blueprint.isPublished ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200"
                          >
                            Published
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-yellow-50 text-yellow-700 border-yellow-200"
                          >
                            Draft
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ActiveToggle blueprint={blueprint} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(blueprint.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ActionsCell blueprint={blueprint} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
