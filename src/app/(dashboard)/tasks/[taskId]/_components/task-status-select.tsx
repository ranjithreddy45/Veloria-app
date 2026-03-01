"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTaskStatus } from "@/actions/task.actions";

// ============================================================
// Status Options
// ============================================================

const STATUS_OPTIONS = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
];

const STATUS_DOT_COLORS: Record<string, string> = {
  TODO: "bg-zinc-400",
  IN_PROGRESS: "bg-blue-500",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-green-500",
};

// ============================================================
// Props
// ============================================================

interface TaskStatusSelectProps {
  taskId: string;
  currentStatus: string;
}

// ============================================================
// Component
// ============================================================

export function TaskStatusSelect({
  taskId,
  currentStatus,
}: TaskStatusSelectProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState(currentStatus);

  const handleStatusChange = async (newStatus: string) => {
    const prevStatus = status;
    setStatus(newStatus); // Optimistic

    const result = await updateTaskStatus(taskId, newStatus);

    if (result.success) {
      if (newStatus === "DONE") {
        toast.success("Task marked as done!");
      } else {
        toast.success("Status updated");
      }
      router.refresh();
    } else {
      setStatus(prevStatus); // Revert
      toast.error(result.error);
    }
  };

  return (
    <Select value={status} onValueChange={handleStatusChange}>
      <SelectTrigger className="w-[160px] h-8 text-sm">
        <div className="flex items-center gap-2">
          <div
            className={`size-2 rounded-full ${STATUS_DOT_COLORS[status] ?? "bg-zinc-400"}`}
          />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <div className="flex items-center gap-2">
              <div
                className={`size-2 rounded-full ${STATUS_DOT_COLORS[opt.value]}`}
              />
              {opt.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
