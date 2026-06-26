"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createChartSchema,
  updateChartSchema,
  addTableSchema,
  updateTableSchema,
  assignGuestSchema,
  type CreateChartInput,
  type UpdateChartInput,
  type AddTableInput,
  type UpdateTableInput,
  type AssignGuestInput,
} from "@/schemas/seating.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Get Seating Chart (with tables and guests)
// ============================================================

export async function getChart(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const chart = await prisma.seatingChart.findUnique({
      where: { bookingId },
      include: {
        tables: {
          orderBy: [{ gridRow: "asc" }, { gridCol: "asc" }],
          include: {
            guests: {
              orderBy: { name: "asc" },
            },
          },
        },
      },
    });

    if (!chart) {
      return { success: true as const, data: null };
    }

    return { success: true as const, data: serialize(chart) };
  } catch (error) {
    console.error("[GET_CHART_ERROR]", error);
    return { success: false as const, error: "Failed to fetch seating chart" };
  }
}

// ============================================================
// Create Seating Chart
// ============================================================

export async function createChart(bookingId: string, data: CreateChartInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createChartSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, bookingNumber: true },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Check if chart already exists
    const existing = await prisma.seatingChart.findUnique({
      where: { bookingId },
    });

    if (existing) {
      return { success: false as const, error: "Seating chart already exists for this booking" };
    }

    const chart = await prisma.seatingChart.create({
      data: {
        bookingId,
        name: parsed.data.name,
        rows: parsed.data.rows,
        columns: parsed.data.columns,
      },
      include: {
        tables: {
          include: { guests: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "SeatingChart",
      entityId: chart.id,
      changes: { bookingId, name: parsed.data.name },
    });

    revalidatePath(`/bookings/${bookingId}/seating`);
    return { success: true as const, data: serialize(chart) };
  } catch (error) {
    console.error("[CREATE_CHART_ERROR]", error);
    return { success: false as const, error: "Failed to create seating chart" };
  }
}

// ============================================================
// Update Seating Chart
// ============================================================

export async function updateChart(chartId: string, data: UpdateChartInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateChartSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.seatingChart.findUnique({
      where: { id: chartId },
      select: { id: true, bookingId: true },
    });

    if (!existing) {
      return { success: false as const, error: "Seating chart not found" };
    }

    const chart = await prisma.seatingChart.update({
      where: { id: chartId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.rows !== undefined && { rows: parsed.data.rows }),
        ...(parsed.data.columns !== undefined && { columns: parsed.data.columns }),
      },
      include: {
        tables: {
          orderBy: [{ gridRow: "asc" }, { gridCol: "asc" }],
          include: { guests: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "SeatingChart",
      entityId: chartId,
      changes: parsed.data,
    });

    revalidatePath(`/bookings/${existing.bookingId}/seating`);
    return { success: true as const, data: serialize(chart) };
  } catch (error) {
    console.error("[UPDATE_CHART_ERROR]", error);
    return { success: false as const, error: "Failed to update seating chart" };
  }
}

// ============================================================
// Add Table
// ============================================================

export async function addTable(chartId: string, data: AddTableInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = addTableSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify chart exists and get bounds
    const chart = await prisma.seatingChart.findUnique({
      where: { id: chartId },
      select: { id: true, bookingId: true, rows: true, columns: true },
    });

    if (!chart) {
      return { success: false as const, error: "Seating chart not found" };
    }

    // Validate grid position is within bounds
    if (parsed.data.gridRow > chart.rows || parsed.data.gridCol > chart.columns) {
      return {
        success: false as const,
        error: `Position (${parsed.data.gridRow}, ${parsed.data.gridCol}) is outside the grid (${chart.rows}x${chart.columns})`,
      };
    }

    // Check for duplicate position
    const conflict = await prisma.seatingTable.findFirst({
      where: {
        chartId,
        gridRow: parsed.data.gridRow,
        gridCol: parsed.data.gridCol,
      },
    });

    if (conflict) {
      return {
        success: false as const,
        error: `Position (${parsed.data.gridRow}, ${parsed.data.gridCol}) is already occupied by "${conflict.label}"`,
      };
    }

    const table = await prisma.seatingTable.create({
      data: {
        chartId,
        label: parsed.data.label,
        gridRow: parsed.data.gridRow,
        gridCol: parsed.data.gridCol,
        capacity: parsed.data.capacity,
        shape: parsed.data.shape,
        notes: parsed.data.notes || null,
      },
      include: { guests: true },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "SeatingTable",
      entityId: table.id,
      changes: { chartId, label: parsed.data.label },
    });

    revalidatePath(`/bookings/${chart.bookingId}/seating`);
    return { success: true as const, data: serialize(table) };
  } catch (error) {
    console.error("[ADD_TABLE_ERROR]", error);
    return { success: false as const, error: "Failed to add table" };
  }
}

// ============================================================
// Update Table
// ============================================================

export async function updateTable(tableId: string, data: UpdateTableInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateTableSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.seatingTable.findUnique({
      where: { id: tableId },
      include: {
        chart: { select: { id: true, bookingId: true, rows: true, columns: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Table not found" };
    }

    const newRow = parsed.data.gridRow ?? existing.gridRow;
    const newCol = parsed.data.gridCol ?? existing.gridCol;

    // Validate grid position is within bounds
    if (newRow > existing.chart.rows || newCol > existing.chart.columns) {
      return {
        success: false as const,
        error: `Position (${newRow}, ${newCol}) is outside the grid (${existing.chart.rows}x${existing.chart.columns})`,
      };
    }

    // Check for duplicate position (exclude self)
    if (parsed.data.gridRow !== undefined || parsed.data.gridCol !== undefined) {
      const conflict = await prisma.seatingTable.findFirst({
        where: {
          chartId: existing.chartId,
          gridRow: newRow,
          gridCol: newCol,
          id: { not: tableId },
        },
      });

      if (conflict) {
        return {
          success: false as const,
          error: `Position (${newRow}, ${newCol}) is already occupied by "${conflict.label}"`,
        };
      }
    }

    const table = await prisma.seatingTable.update({
      where: { id: tableId },
      data: {
        ...(parsed.data.label !== undefined && { label: parsed.data.label }),
        ...(parsed.data.gridRow !== undefined && { gridRow: parsed.data.gridRow }),
        ...(parsed.data.gridCol !== undefined && { gridCol: parsed.data.gridCol }),
        ...(parsed.data.capacity !== undefined && { capacity: parsed.data.capacity }),
        ...(parsed.data.shape !== undefined && { shape: parsed.data.shape }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
      },
      include: { guests: true },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "SeatingTable",
      entityId: tableId,
    });

    revalidatePath(`/bookings/${existing.chart.bookingId}/seating`);
    return { success: true as const, data: serialize(table) };
  } catch (error) {
    console.error("[UPDATE_TABLE_ERROR]", error);
    return { success: false as const, error: "Failed to update table" };
  }
}

// ============================================================
// Remove Table (and all its guests)
// ============================================================

export async function removeTable(tableId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.seatingTable.findUnique({
      where: { id: tableId },
      include: {
        chart: { select: { id: true, bookingId: true } },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Table not found" };
    }

    // Cascade delete handles guests
    await prisma.seatingTable.delete({ where: { id: tableId } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "SeatingTable",
      entityId: tableId,
      changes: { label: existing.label },
    });

    revalidatePath(`/bookings/${existing.chart.bookingId}/seating`);
    return { success: true as const, data: { id: tableId } };
  } catch (error) {
    console.error("[REMOVE_TABLE_ERROR]", error);
    return { success: false as const, error: "Failed to remove table" };
  }
}

// ============================================================
// Assign Guest to Table
// ============================================================

export async function assignGuest(tableId: string, data: AssignGuestInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = assignGuestSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Verify table exists and check capacity
    const table = await prisma.seatingTable.findUnique({
      where: { id: tableId },
      include: {
        chart: { select: { bookingId: true } },
        _count: { select: { guests: true } },
      },
    });

    if (!table) {
      return { success: false as const, error: "Table not found" };
    }

    if (table._count.guests >= table.capacity) {
      return {
        success: false as const,
        error: `Table "${table.label}" is at full capacity (${table.capacity})`,
      };
    }

    const guest = await prisma.seatingGuest.create({
      data: {
        tableId,
        name: parsed.data.name,
        category: parsed.data.category || null,
        seatNumber: parsed.data.seatNumber ?? null,
        notes: parsed.data.notes || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "SeatingGuest",
      entityId: guest.id,
      changes: { tableId, guestName: parsed.data.name },
    });

    revalidatePath(`/bookings/${table.chart.bookingId}/seating`);
    return { success: true as const, data: serialize(guest) };
  } catch (error) {
    console.error("[ASSIGN_GUEST_ERROR]", error);
    return { success: false as const, error: "Failed to assign guest" };
  }
}

// ============================================================
// Remove Guest from Table
// ============================================================

export async function removeGuest(guestId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.seatingGuest.findUnique({
      where: { id: guestId },
      include: {
        table: {
          include: {
            chart: { select: { bookingId: true } },
          },
        },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Guest not found" };
    }

    await prisma.seatingGuest.delete({ where: { id: guestId } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "SeatingGuest",
      entityId: guestId,
      changes: { guestName: existing.name },
    });

    revalidatePath(`/bookings/${existing.table.chart.bookingId}/seating`);
    return { success: true as const, data: { id: guestId } };
  } catch (error) {
    console.error("[REMOVE_GUEST_ERROR]", error);
    return { success: false as const, error: "Failed to remove guest" };
  }
}

// ============================================================
// Move Guest Between Tables
// ============================================================

export async function moveGuest(guestId: string, newTableId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.seatingGuest.findUnique({
      where: { id: guestId },
      include: {
        table: {
          include: {
            chart: { select: { id: true, bookingId: true } },
          },
        },
      },
    });

    if (!existing) {
      return { success: false as const, error: "Guest not found" };
    }

    // Verify new table exists and belongs to same chart
    const newTable = await prisma.seatingTable.findUnique({
      where: { id: newTableId },
      include: {
        _count: { select: { guests: true } },
      },
    });

    if (!newTable) {
      return { success: false as const, error: "Destination table not found" };
    }

    if (newTable.chartId !== existing.table.chartId) {
      return { success: false as const, error: "Cannot move guest to a table in a different chart" };
    }

    if (newTable._count.guests >= newTable.capacity) {
      return {
        success: false as const,
        error: `Table "${newTable.label}" is at full capacity (${newTable.capacity})`,
      };
    }

    const guest = await prisma.seatingGuest.update({
      where: { id: guestId },
      data: { tableId: newTableId },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "SeatingGuest",
      entityId: guestId,
      changes: {
        guestName: existing.name,
        fromTable: existing.table.id,
        toTable: newTableId,
      },
    });

    revalidatePath(`/bookings/${existing.table.chart.bookingId}/seating`);
    return { success: true as const, data: serialize(guest) };
  } catch (error) {
    console.error("[MOVE_GUEST_ERROR]", error);
    return { success: false as const, error: "Failed to move guest" };
  }
}
