"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, TrashIcon } from "lucide-react";

import { deleteTask } from "@/actions/task.actions";
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
// Props
// ============================================================

interface TaskDeleteButtonProps {
  taskId: string;
  taskTitle: string;
}

// ============================================================
// Component
// ============================================================

export function TaskDeleteButton({ taskId, taskTitle }: TaskDeleteButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const handleDelete = async () => {
    setIsPending(true);
    try {
      const result = await deleteTask(taskId);
      if (result.success) {
        toast.success("Task deleted successfully");
        router.push("/tasks");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <TrashIcon className="mr-2 size-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Task</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{taskTitle}&rdquo;? This will
            also delete all subtasks and checklist items. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive hover:bg-destructive"
            disabled={isPending}
          >
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
