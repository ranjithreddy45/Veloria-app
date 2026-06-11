"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { stampLeadResponded } from "@/lib/lead-pipeline";
import {
  logCallSchema,
  callFiltersSchema,
  type LogCallInput,
  type CallFiltersInput,
} from "@/schemas/call.schema";

// ============================================================
// Log Call
// ============================================================

export async function logCall(data: LogCallInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = logCallSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    // Look up the contact for follow-up task title
    const contact = await prisma.contact.findUnique({
      where: { id: parsed.data.contactId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    // Create the Communication record
    const communication = await prisma.communication.create({
      data: {
        type: "CALL",
        direction: parsed.data.direction,
        content: parsed.data.notes || "Call logged",
        contactId: parsed.data.contactId,
        bookingId: parsed.data.bookingId || null,
        createdById: session.user.id,
      },
    });

    // Create the linked CallLog record
    const callLog = await prisma.callLog.create({
      data: {
        disposition: parsed.data.disposition,
        durationSeconds: parsed.data.durationSeconds,
        recordingUrl: parsed.data.recordingUrl || null,
        externalCallId: parsed.data.externalCallId || null,
        notes: parsed.data.notes || null,
        tags: parsed.data.tags,
        followUpDate: parsed.data.followUpDate || null,
        followUpNotes: parsed.data.followUpNotes || null,
        communicationId: communication.id,
        contactId: parsed.data.contactId,
        agentId: session.user.id,
      },
    });

    // An outbound call = first response → stop the speed-to-lead SLA clock.
    if (parsed.data.direction === "OUTBOUND") {
      await stampLeadResponded(parsed.data.contactId);
    }

    // If follow-up date is set, create a follow-up task
    if (parsed.data.followUpDate) {
      await prisma.task.create({
        data: {
          title: `Follow up call: ${contact.firstName} ${contact.lastName}`,
          description: parsed.data.followUpNotes || "Follow-up call scheduled",
          dueDate: parsed.data.followUpDate,
          priority: "MEDIUM",
          status: "TODO",
          assigneeId: session.user.id,
          creatorId: session.user.id,
        },
      });
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "CallLog",
      entityId: callLog.id,
      changes: {
        disposition: parsed.data.disposition,
        direction: parsed.data.direction,
        contactId: parsed.data.contactId,
        durationSeconds: parsed.data.durationSeconds,
      },
    });

    revalidatePath("/crm/calls");

    return { success: true as const, data: { id: callLog.id } };
  } catch (error) {
    console.error("[LOG_CALL_ERROR]", error);
    return { success: false as const, error: "Failed to log call" };
  }
}

// ============================================================
// Get Call Logs (Paginated + Filtered)
// ============================================================

export async function getCallLogs(filters?: CallFiltersInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = filters
      ? callFiltersSchema.safeParse(filters)
      : { success: true as const, data: { page: 1, limit: 20 } };

    if (!parsed.success) {
      return {
        success: false as const,
        error: "Invalid filters",
        details: (parsed as { error: { flatten: () => { fieldErrors: Record<string, string[]> } } }).error.flatten().fieldErrors,
      };
    }

    const { page, limit, startDate, endDate, direction, disposition, agentId, contactId } =
      parsed.data as CallFiltersInput;

    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Date range filter on createdAt
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Direction filter (on the linked communication)
    if (direction) {
      where.communication = { direction };
    }

    // Disposition filter
    if (disposition) {
      where.disposition = disposition;
    }

    // Agent filter
    if (agentId) {
      where.agentId = agentId;
    }

    // Contact filter
    if (contactId) {
      where.contactId = contactId;
    }

    const [data, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          communication: {
            select: {
              type: true,
              direction: true,
              createdAt: true,
              bookingId: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          agent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.callLog.count({ where }),
    ]);

    return {
      success: true as const,
      data: serialize({
        data,
        total,
        page,
        limit,
      }),
    };
  } catch (error) {
    console.error("[GET_CALL_LOGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch call logs" };
  }
}

// ============================================================
// Get Call Analytics
// ============================================================

export async function getCallAnalytics(params?: {
  startDate?: Date;
  endDate?: Date;
  agentId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    if (params?.agentId) {
      where.agentId = params.agentId;
    }

    // Total calls count
    const totalCalls = await prisma.callLog.count({ where });

    // Average duration
    const avgDurationResult = await prisma.callLog.aggregate({
      where,
      _avg: { durationSeconds: true },
    });
    const avgDuration = avgDurationResult._avg.durationSeconds ?? 0;

    // Calls by disposition
    const callsByDisposition = await prisma.callLog.groupBy({
      by: ["disposition"],
      where,
      _count: { id: true },
    });

    // Calls by direction (from Communication where type = CALL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commWhere: any = { type: "CALL" };
    if (params?.startDate || params?.endDate) {
      commWhere.createdAt = {};
      if (params?.startDate) commWhere.createdAt.gte = params.startDate;
      if (params?.endDate) commWhere.createdAt.lte = params.endDate;
    }

    const callsByDirection = await prisma.communication.groupBy({
      by: ["direction"],
      where: commWhere,
      _count: { id: true },
    });

    // Calls today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const callsToday = await prisma.callLog.count({
      where: {
        ...where,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // Calls by hour (using Prisma.sql for conditional WHERE clauses)
    const conditions = [Prisma.sql`1=1`];
    if (params?.startDate) {
      conditions.push(Prisma.sql`"createdAt" >= ${params.startDate}`);
    }
    if (params?.endDate) {
      conditions.push(Prisma.sql`"createdAt" <= ${params.endDate}`);
    }
    if (params?.agentId) {
      conditions.push(Prisma.sql`"agentId" = ${params.agentId}`);
    }
    const whereClause = Prisma.join(conditions, " AND ");

    const callsByHour = await prisma.$queryRaw<
      { hour: number; count: bigint }[]
    >`
      SELECT EXTRACT(HOUR FROM "createdAt") as hour, COUNT(*)::bigint as count
      FROM "CallLog"
      WHERE ${whereClause}
      GROUP BY hour
      ORDER BY hour
    `;

    return {
      success: true as const,
      data: serialize({
        totalCalls,
        avgDuration,
        callsByDisposition: callsByDisposition.map((d) => ({
          disposition: d.disposition,
          count: d._count.id,
        })),
        callsByDirection: callsByDirection.map((d) => ({
          direction: d.direction,
          count: d._count.id,
        })),
        callsToday,
        callsByHour: callsByHour.map((h) => ({
          hour: Number(h.hour),
          count: Number(h.count),
        })),
      }),
    };
  } catch (error) {
    console.error("[GET_CALL_ANALYTICS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch call analytics" };
  }
}

// ============================================================
// Delete Call Log
// ============================================================

export async function deleteCallLog(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const callLog = await prisma.callLog.findUnique({
      where: { id },
      select: { id: true, communicationId: true, contactId: true },
    });

    if (!callLog) {
      return { success: false as const, error: "Call log not found" };
    }

    // Delete the CallLog first (it references Communication)
    await prisma.callLog.delete({ where: { id } });

    // Delete the linked Communication
    await prisma.communication.delete({
      where: { id: callLog.communicationId },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "CallLog",
      entityId: id,
    });

    revalidatePath("/crm/calls");

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_CALL_LOG_ERROR]", error);
    return { success: false as const, error: "Failed to delete call log" };
  }
}
