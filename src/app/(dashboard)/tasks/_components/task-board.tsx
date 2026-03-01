"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { moveTask } from "@/actions/task.actions";
import { TaskColumn } from "./task-column";
import { TaskCard } from "./task-card";

// ============================================================
// Types
// ============================================================

export type TaskAssignee = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type TaskCreator = {
  id: string;
  name: string | null;
  email: string;
};

export type TaskBooking = {
  id: string;
  eventName: string;
  bookingNumber: string;
};

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  assigneeId: string | null;
  creatorId: string;
  bookingId: string | null;
  parentId: string | null;
  assignee: TaskAssignee | null;
  creator: TaskCreator;
  booking: TaskBooking | null;
  _count: {
    subtasks: number;
    checklistItems: number;
  };
  checklistItems: {
    id: string;
    isCompleted: boolean;
  }[];
};

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

interface TaskBoardProps {
  initialTasksByStatus: Record<string, TaskItem[]>;
}

// ============================================================
// Component
// ============================================================

export function TaskBoard({ initialTasksByStatus }: TaskBoardProps) {
  const [tasksByStatus, setTasksByStatus] =
    useState<Record<string, TaskItem[]>>(initialTasksByStatus);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find the task being dragged
  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const status of TASK_STATUSES) {
      const task = tasksByStatus[status]?.find((t) => t.id === activeId);
      if (task) return task;
    }
    return null;
  }, [activeId, tasksByStatus]);

  // Sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // ========================================
  // Drag Handlers
  // ========================================

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeIdStr = active.id as string;
      const overIdStr = over.id as string;

      // Find source status
      let sourceStatus: string | null = null;
      let sourceIndex = -1;
      for (const status of TASK_STATUSES) {
        const idx = tasksByStatus[status]?.findIndex(
          (t) => t.id === activeIdStr
        );
        if (idx !== undefined && idx !== -1) {
          sourceStatus = status;
          sourceIndex = idx;
          break;
        }
      }

      if (!sourceStatus || sourceIndex === -1) return;

      // Determine target status
      let targetStatus: string | null = null;
      let targetIndex = -1;

      // Check if over is a column
      if (TASK_STATUSES.includes(overIdStr as TaskStatus)) {
        targetStatus = overIdStr;
        targetIndex = tasksByStatus[overIdStr]?.length ?? 0;
      } else {
        // Over is a task card
        for (const status of TASK_STATUSES) {
          const idx = tasksByStatus[status]?.findIndex(
            (t) => t.id === overIdStr
          );
          if (idx !== undefined && idx !== -1) {
            targetStatus = status;
            targetIndex = idx;
            break;
          }
        }
      }

      if (!targetStatus) return;
      if (sourceStatus === targetStatus) return; // Same column, handled by DragEnd

      // Move task between columns (optimistic)
      setTasksByStatus((prev) => {
        const updated = { ...prev };
        for (const status of TASK_STATUSES) {
          updated[status] = [...(prev[status] || [])];
        }

        const [movedTask] = updated[sourceStatus].splice(sourceIndex, 1);
        if (!movedTask) return prev;

        const insertIdx = Math.min(
          targetIndex,
          updated[targetStatus].length
        );
        updated[targetStatus].splice(insertIdx, 0, {
          ...movedTask,
          status: targetStatus,
        });

        return updated;
      });
    },
    [tasksByStatus]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);

      if (!over) return;

      const activeIdStr = active.id as string;
      const overIdStr = over.id as string;

      // Find current status and index
      let currentStatus: string | null = null;
      let currentIndex = -1;
      for (const status of TASK_STATUSES) {
        const idx = tasksByStatus[status]?.findIndex(
          (t) => t.id === activeIdStr
        );
        if (idx !== undefined && idx !== -1) {
          currentStatus = status;
          currentIndex = idx;
          break;
        }
      }

      if (!currentStatus || currentIndex === -1) return;

      // Determine target
      let targetStatus: string | null = null;
      let targetIndex = -1;

      if (TASK_STATUSES.includes(overIdStr as TaskStatus)) {
        targetStatus = overIdStr;
        targetIndex =
          tasksByStatus[overIdStr]?.findIndex((t) => t.id === activeIdStr) ??
          tasksByStatus[overIdStr]?.length ??
          0;
        if (targetIndex === -1) {
          targetIndex = tasksByStatus[overIdStr]?.length ?? 0;
        }
      } else {
        for (const status of TASK_STATUSES) {
          const idx = tasksByStatus[status]?.findIndex(
            (t) => t.id === overIdStr
          );
          if (idx !== undefined && idx !== -1) {
            targetStatus = status;
            targetIndex = idx;
            break;
          }
        }
      }

      if (!targetStatus) return;

      // If same status, handle reorder
      if (
        currentStatus === targetStatus &&
        activeIdStr !== overIdStr
      ) {
        const overIndex = tasksByStatus[currentStatus]?.findIndex(
          (t) => t.id === overIdStr
        );
        if (
          overIndex !== undefined &&
          overIndex !== -1 &&
          overIndex !== currentIndex
        ) {
          setTasksByStatus((prev) => ({
            ...prev,
            [currentStatus]: arrayMove(
              prev[currentStatus] || [],
              currentIndex,
              overIndex
            ),
          }));
          targetIndex = overIndex;
        }
      }

      // Persist the move
      const result = await moveTask(activeIdStr, targetStatus, targetIndex);

      if (result.success) {
        if (targetStatus === "DONE") {
          toast.success("Task completed!", {
            description: "The task has been marked as done.",
          });
        }
      } else {
        toast.error("Failed to move task", {
          description: result.error,
        });
        // Revert on failure
        setTasksByStatus(initialTasksByStatus);
      }
    },
    [tasksByStatus, initialTasksByStatus]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={scrollRef}
        className="flex h-full gap-4 overflow-x-auto pb-4"
        style={{ scrollbarGutter: "stable" }}
      >
        {TASK_STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status] || []}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="rotate-2 scale-105">
            <TaskCard task={activeTask} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
