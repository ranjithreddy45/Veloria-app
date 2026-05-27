"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";

// ============================================================
// Get Agent Activity Summary
// ============================================================

export async function getAgentActivity(params?: {
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const dateFilter: Record<string, unknown> = {};
    if (params?.startDate) {
      dateFilter.gte = params.startDate;
    }
    if (params?.endDate) {
      dateFilter.lte = params.endDate;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Get all active agents (SALES_EXEC, ADMIN, SUPER_ADMIN)
    const agents = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["SALES_EXEC", "ADMIN", "SUPER_ADMIN"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
      },
    });

    // Get activity stats per agent
    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const callLogWhere: Record<string, unknown> = { agentId: agent.id };
        if (hasDateFilter) callLogWhere.createdAt = dateFilter;

        const communicationWhere: Record<string, unknown> = { createdById: agent.id };
        if (hasDateFilter) communicationWhere.createdAt = dateFilter;

        const leadWhere: Record<string, unknown> = { assignedToId: agent.id };
        if (hasDateFilter) leadWhere.createdAt = dateFilter;

        const taskWhere: Record<string, unknown> = {
          assigneeId: agent.id,
          status: "DONE",
        };
        if (hasDateFilter) taskWhere.updatedAt = dateFilter;

        const [
          totalCalls,
          callDuration,
          totalCommunications,
          assignedLeads,
          completedTasks,
        ] = await Promise.all([
          prisma.callLog.count({ where: callLogWhere }),
          prisma.callLog.aggregate({
            where: callLogWhere,
            _avg: { durationSeconds: true },
            _sum: { durationSeconds: true },
          }),
          prisma.communication.count({ where: communicationWhere }),
          prisma.lead.count({ where: leadWhere }),
          prisma.task.count({ where: taskWhere }),
        ]);

        return {
          agent: {
            id: agent.id,
            name: agent.name,
            email: agent.email,
            role: agent.role,
            image: agent.image,
          },
          totalCalls,
          avgCallDuration: callDuration._avg.durationSeconds || 0,
          totalCallDuration: callDuration._sum.durationSeconds || 0,
          totalCommunications,
          assignedLeads,
          completedTasks,
        };
      })
    );

    // Sort by total calls desc
    agentStats.sort((a, b) => b.totalCalls - a.totalCalls);

    return { success: true as const, data: serialize(agentStats) };
  } catch (error) {
    console.error("getAgentActivity error:", error);
    return { success: false as const, error: "Failed to fetch agent activity" };
  }
}

// ============================================================
// Get Agent Activity Timeline
// ============================================================

export async function getAgentActivityTimeline(userId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "performance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get recent activity: calls, communications, tasks
    const [recentCalls, recentComms, recentTasks] = await Promise.all([
      prisma.callLog.findMany({
        where: { agentId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          communication: { select: { direction: true } },
        },
      }),
      prisma.communication.findMany({
        where: { createdById: userId, type: { not: "CALL" } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.task.findMany({
        where: { assigneeId: userId, status: "DONE" },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, title: true, updatedAt: true, status: true },
      }),
    ]);

    // Combine into a unified timeline
    const timeline = [
      ...recentCalls.map((c) => ({
        type: "CALL" as const,
        id: c.id,
        title: `${c.communication.direction === "INBOUND" ? "Received" : "Made"} call to ${c.contact.firstName} ${c.contact.lastName}`,
        subtitle: `${c.disposition} — ${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s`,
        date: c.createdAt,
      })),
      ...recentComms.map((c) => ({
        type: c.type as string,
        id: c.id,
        title: `${c.type} ${c.direction === "INBOUND" ? "from" : "to"} ${c.contact.firstName} ${c.contact.lastName}`,
        subtitle: c.subject || "",
        date: c.createdAt,
      })),
      ...recentTasks.map((t) => ({
        type: "TASK" as const,
        id: t.id,
        title: `Completed: ${t.title}`,
        subtitle: "",
        date: t.updatedAt,
      })),
    ];

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { success: true as const, data: serialize(timeline.slice(0, 30)) };
  } catch (error) {
    console.error("getAgentActivityTimeline error:", error);
    return { success: false as const, error: "Failed to fetch timeline" };
  }
}
