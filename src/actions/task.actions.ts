"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { taskSchema, type TaskInput } from "@/schemas/task.schema";
import { velosOnTaskDone } from "@/lib/velos/triggers";

// Whitelist of valid task statuses (must match Prisma TaskStatus enum).
const TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
type TaskStatusValue = (typeof TASK_STATUSES)[number];

function isValidTaskStatus(value: string): value is TaskStatusValue {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

// ============================================================
// Get Tasks (Paginated + Search + Filters)
// ============================================================

export async function getTasks(params?: {
  search?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  bookingId?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      parentId: null, // Exclude subtasks from main listing
    };

    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.priority) {
      where.priority = params.priority;
    }

    if (params?.assigneeId) {
      where.assigneeId = params.assigneeId;
    }

    if (params?.bookingId) {
      where.bookingId = params.bookingId;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          assignee: {
            select: { id: true, name: true, email: true, image: true },
          },
          creator: {
            select: { id: true, name: true, email: true },
          },
          booking: {
            select: { id: true, eventName: true, bookingNumber: true },
          },
          _count: {
            select: { subtasks: true, checklistItems: true },
          },
          checklistItems: {
            select: { id: true, isCompleted: true },
          },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: tasks,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_TASKS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch tasks" };
  }
}

// ============================================================
// Get Single Task
// ============================================================

export async function getTask(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        booking: {
          select: { id: true, eventName: true, bookingNumber: true },
        },
        subtasks: {
          orderBy: { order: "asc" },
          include: {
            assignee: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        checklistItems: {
          orderBy: { order: "asc" },
        },
        parent: {
          select: { id: true, title: true },
        },
      },
    });

    if (!task) {
      return { success: false as const, error: "Task not found" };
    }

    return { success: true as const, data: task };
  } catch (error) {
    console.error("[GET_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to fetch task" };
  }
}

// ============================================================
// Create Task
// ============================================================

export async function createTask(data: TaskInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = taskSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const taskData = parsed.data;

    // Get the max order for TODO status
    const maxOrder = await prisma.task.aggregate({
      where: { status: "TODO", parentId: null },
      _max: { order: true },
    });

    const task = await prisma.task.create({
      data: {
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        dueDate: taskData.dueDate || null,
        assigneeId: taskData.assigneeId || null,
        bookingId: taskData.bookingId || null,
        creatorId: session.user.id,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    revalidatePath("/tasks");
    return { success: true as const, data: task };
  } catch (error) {
    console.error("[CREATE_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to create task" };
  }
}

// ============================================================
// Update Task
// ============================================================

export async function updateTask(id: string, data: TaskInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = taskSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Task not found" };
    }

    const taskData = parsed.data;

    const task = await prisma.task.update({
      where: { id },
      data: {
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        dueDate: taskData.dueDate || null,
        assigneeId: taskData.assigneeId || null,
        bookingId: taskData.bookingId || null,
      },
    });

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
    return { success: true as const, data: task };
  } catch (error) {
    console.error("[UPDATE_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to update task" };
  }
}

// ============================================================
// Delete Task
// ============================================================

export async function deleteTask(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: { _count: { select: { subtasks: true } } },
    });

    if (!task) {
      return { success: false as const, error: "Task not found" };
    }

    // Delete subtasks and checklist items first (cascade handles checklistItems)
    if (task._count.subtasks > 0) {
      await prisma.task.deleteMany({
        where: { parentId: id },
      });
    }

    await prisma.task.delete({ where: { id } });

    revalidatePath("/tasks");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to delete task" };
  }
}

// ============================================================
// Update Task Status
// ============================================================

export async function updateTaskStatus(id: string, status: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!isValidTaskStatus(status)) {
      return { success: false as const, error: "Invalid task status" };
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === "DONE" ? new Date() : null,
      },
    });

    if (status === "DONE") {
      const onTime = !task.dueDate || (task.completedAt ?? new Date()) <= task.dueDate;
      await velosOnTaskDone({ taskId: task.id, ownerId: task.assigneeId, priority: task.priority, onTime });
    }

    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
    return { success: true as const, data: task };
  } catch (error) {
    console.error("[UPDATE_TASK_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update task status" };
  }
}

// ============================================================
// Move Task (Kanban Drag-Drop)
// ============================================================

export async function moveTask(
  taskId: string,
  newStatus: string,
  newOrder: number
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!isValidTaskStatus(newStatus)) {
      return { success: false as const, error: "Invalid task status" };
    }

    if (!Number.isInteger(newOrder) || newOrder < 0) {
      return { success: false as const, error: "Invalid order value" };
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        order: newOrder,
        completedAt: newStatus === "DONE" ? new Date() : null,
      },
    });

    if (newStatus === "DONE") {
      const onTime = !task.dueDate || (task.completedAt ?? new Date()) <= task.dueDate;
      await velosOnTaskDone({ taskId: task.id, ownerId: task.assigneeId, priority: task.priority, onTime });
    }

    revalidatePath("/tasks");
    return { success: true as const, data: task };
  } catch (error) {
    console.error("[MOVE_TASK_ERROR]", error);
    return { success: false as const, error: "Failed to move task" };
  }
}

// ============================================================
// Create Subtask
// ============================================================

export async function createSubtask(
  parentId: string,
  data: { title: string; priority?: string }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parent = await prisma.task.findUnique({
      where: { id: parentId },
      select: { id: true, bookingId: true },
    });

    if (!parent) {
      return { success: false as const, error: "Parent task not found" };
    }

    const maxOrder = await prisma.task.aggregate({
      where: { parentId },
      _max: { order: true },
    });

    const subtask = await prisma.task.create({
      data: {
        title: data.title,
        priority: (data.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
        parentId,
        creatorId: session.user.id,
        bookingId: parent.bookingId,
        order: (maxOrder._max.order ?? -1) + 1,
      },
      include: {
        assignee: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    revalidatePath(`/tasks/${parentId}`);
    return { success: true as const, data: subtask };
  } catch (error) {
    console.error("[CREATE_SUBTASK_ERROR]", error);
    return { success: false as const, error: "Failed to create subtask" };
  }
}

// ============================================================
// Add Checklist Item
// ============================================================

export async function addChecklistItem(taskId: string, title: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const maxOrder = await prisma.checklistItem.aggregate({
      where: { taskId },
      _max: { order: true },
    });

    const item = await prisma.checklistItem.create({
      data: {
        title,
        taskId,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    revalidatePath(`/tasks/${taskId}`);
    return { success: true as const, data: item };
  } catch (error) {
    console.error("[ADD_CHECKLIST_ITEM_ERROR]", error);
    return { success: false as const, error: "Failed to add checklist item" };
  }
}

// ============================================================
// Toggle Checklist Item
// ============================================================

export async function toggleChecklistItem(itemId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const item = await prisma.checklistItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { success: false as const, error: "Checklist item not found" };
    }

    const updated = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        isCompleted: !item.isCompleted,
        completedAt: !item.isCompleted ? new Date() : null,
      },
    });

    revalidatePath(`/tasks/${item.taskId}`);
    return { success: true as const, data: updated };
  } catch (error) {
    console.error("[TOGGLE_CHECKLIST_ITEM_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to toggle checklist item",
    };
  }
}

// ============================================================
// Delete Checklist Item
// ============================================================

export async function deleteChecklistItem(itemId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const item = await prisma.checklistItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { success: false as const, error: "Checklist item not found" };
    }

    await prisma.checklistItem.delete({ where: { id: itemId } });

    revalidatePath(`/tasks/${item.taskId}`);
    return { success: true as const, data: { id: itemId } };
  } catch (error) {
    console.error("[DELETE_CHECKLIST_ITEM_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to delete checklist item",
    };
  }
}

// ============================================================
// Reorder Checklist Items
// ============================================================

export async function reorderChecklistItems(
  items: { id: string; order: number }[]
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.checklistItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );

    // Get the taskId for revalidation from the first item
    if (items.length > 0) {
      const firstItem = await prisma.checklistItem.findUnique({
        where: { id: items[0].id },
        select: { taskId: true },
      });
      if (firstItem) {
        revalidatePath(`/tasks/${firstItem.taskId}`);
      }
    }

    return { success: true as const, data: null };
  } catch (error) {
    console.error("[REORDER_CHECKLIST_ITEMS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to reorder checklist items",
    };
  }
}

// ============================================================
// Get Task Templates
// ============================================================

export async function getTaskTemplates() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const templates = await prisma.taskTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: templates };
  } catch (error) {
    console.error("[GET_TASK_TEMPLATES_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch task templates",
    };
  }
}

// ============================================================
// Create Task Template
// ============================================================

export async function createTaskTemplate(data: {
  name: string;
  description?: string;
  items: { title: string; priority?: string }[];
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!data.name.trim()) {
      return { success: false as const, error: "Template name is required" };
    }

    const template = await prisma.taskTemplate.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        items: data.items,
      },
    });

    revalidatePath("/tasks/templates");
    return { success: true as const, data: template };
  } catch (error) {
    console.error("[CREATE_TASK_TEMPLATE_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to create task template",
    };
  }
}

// ============================================================
// Apply Template (Create tasks from template)
// ============================================================

export async function applyTemplate(templateId: string, bookingId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const template = await prisma.taskTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return { success: false as const, error: "Template not found" };
    }

    const items = template.items as Array<{
      title: string;
      priority?: string;
    }>;

    const maxOrder = await prisma.task.aggregate({
      where: { status: "TODO", parentId: null },
      _max: { order: true },
    });

    let currentOrder = (maxOrder._max.order ?? -1) + 1;

    const tasks = await prisma.$transaction(
      items.map((item) => {
        const order = currentOrder++;
        return prisma.task.create({
          data: {
            title: item.title,
            priority:
              (item.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") ||
              "MEDIUM",
            creatorId: session.user!.id!,
            bookingId: bookingId || null,
            order,
          },
        });
      })
    );

    revalidatePath("/tasks");
    return { success: true as const, data: tasks };
  } catch (error) {
    console.error("[APPLY_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to apply template" };
  }
}

// ============================================================
// Get Team Members (for assignee select)
// ============================================================

export async function getTeamMembers() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const members = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: "CLIENT" },
      },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: members };
  } catch (error) {
    console.error("[GET_TEAM_MEMBERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch team members" };
  }
}

// ============================================================
// Get Bookings (for booking select)
// ============================================================

export async function getBookingsForSelect() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "tasks:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS"] },
      },
      select: { id: true, eventName: true, bookingNumber: true },
      orderBy: { date: "desc" },
      take: 100,
    });

    return { success: true as const, data: bookings };
  } catch (error) {
    console.error("[GET_BOOKINGS_FOR_SELECT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch bookings" };
  }
}
