"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  emergencyProtocolSchema,
  emergencyIncidentSchema,
  resolveIncidentSchema,
  type EmergencyProtocolInput,
  type EmergencyIncidentInput,
  type ResolveIncidentInput,
} from "@/schemas/emergency.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import type { Prisma } from "@prisma/client";

// ============================================================
// Get Emergency Protocols (Filtered)
// ============================================================

export async function getProtocols(params?: {
  venueId?: string;
  type?: string;
  search?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.type) {
      where.type = params.type;
    }

    if (params?.search?.trim()) {
      where.OR = [
        { name: { contains: params.search.trim(), mode: "insensitive" } },
        { procedures: { contains: params.search.trim(), mode: "insensitive" } },
      ];
    }

    const protocols = await prisma.emergencyProtocol.findMany({
      where,
      include: {
        _count: {
          select: { incidents: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(protocols) };
  } catch (error) {
    console.error("[GET_PROTOCOLS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch emergency protocols",
    };
  }
}

// ============================================================
// Get Single Protocol
// ============================================================

export async function getProtocol(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const protocol = await prisma.emergencyProtocol.findUnique({
      where: { id },
      include: {
        incidents: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!protocol) {
      return { success: false as const, error: "Protocol not found" };
    }

    return { success: true as const, data: serialize(protocol) };
  } catch (error) {
    console.error("[GET_PROTOCOL_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch emergency protocol",
    };
  }
}

// ============================================================
// Create Emergency Protocol
// ============================================================

export async function createProtocol(data: EmergencyProtocolInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = emergencyProtocolSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const protocolData = parsed.data;

    const protocol = await prisma.emergencyProtocol.create({
      data: {
        name: protocolData.name,
        type: protocolData.type,
        venueId: protocolData.venueId || null,
        procedures: protocolData.procedures,
        contactNumbers: protocolData.contactNumbers as Prisma.InputJsonValue,
        isActive: protocolData.isActive,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "EmergencyProtocol",
      entityId: protocol.id,
    });

    revalidatePath("/settings/emergency");
    return { success: true as const, data: serialize(protocol) };
  } catch (error) {
    console.error("[CREATE_PROTOCOL_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to create emergency protocol",
    };
  }
}

// ============================================================
// Update Emergency Protocol
// ============================================================

export async function updateProtocol(
  id: string,
  data: Partial<EmergencyProtocolInput>
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.emergencyProtocol.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Protocol not found" };
    }

    // For partial updates (e.g., toggling isActive), we only validate what's provided
    // For full updates, validate everything
    if (data.name !== undefined || data.type !== undefined || data.procedures !== undefined) {
      const parsed = emergencyProtocolSchema.safeParse(data);
      if (!parsed.success) {
        return {
          success: false as const,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.venueId !== undefined) updateData.venueId = data.venueId || null;
    if (data.procedures !== undefined) updateData.procedures = data.procedures;
    if (data.contactNumbers !== undefined) {
      updateData.contactNumbers = data.contactNumbers as Prisma.InputJsonValue;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const protocol = await prisma.emergencyProtocol.update({
      where: { id },
      data: updateData,
    });

    logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "EmergencyProtocol",
      entityId: protocol.id,
    });

    revalidatePath("/settings/emergency");
    return { success: true as const, data: serialize(protocol) };
  } catch (error) {
    console.error("[UPDATE_PROTOCOL_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to update emergency protocol",
    };
  }
}

// ============================================================
// Delete Emergency Protocol
// ============================================================

export async function deleteProtocol(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.emergencyProtocol.findUnique({
      where: { id },
      include: { _count: { select: { incidents: true } } },
    });
    if (!existing) {
      return { success: false as const, error: "Protocol not found" };
    }

    if (existing._count.incidents > 0) {
      return {
        success: false as const,
        error: "Cannot delete protocol with linked incidents. Deactivate it instead.",
      };
    }

    await prisma.emergencyProtocol.delete({ where: { id } });

    logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "EmergencyProtocol",
      entityId: id,
    });

    revalidatePath("/settings/emergency");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_PROTOCOL_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to delete emergency protocol",
    };
  }
}

// ============================================================
// Report Emergency Incident
// ============================================================

export async function reportIncident(data: EmergencyIncidentInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = emergencyIncidentSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const incidentData = parsed.data;

    const incident = await prisma.emergencyIncident.create({
      data: {
        bookingId: incidentData.bookingId || null,
        protocolId: incidentData.protocolId || null,
        type: incidentData.type,
        description: incidentData.description,
        severity: incidentData.severity,
        status: "OPEN",
        reportedById: session.user.id as string,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "EmergencyIncident",
      entityId: incident.id,
      changes: { type: incident.type, severity: incident.severity },
    });

    // Notify the reporter
    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Emergency Incident Reported",
      message: `A ${incident.severity} severity ${incident.type} incident has been reported.`,
      actionUrl: "/settings/emergency",
    });

    revalidatePath("/settings/emergency");
    return { success: true as const, data: serialize(incident) };
  } catch (error) {
    console.error("[REPORT_INCIDENT_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to report emergency incident",
    };
  }
}

// ============================================================
// Resolve Emergency Incident
// ============================================================

export async function resolveIncident(id: string, data?: ResolveIncidentInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.emergencyIncident.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Incident not found" };
    }

    if (existing.status === "RESOLVED") {
      return { success: false as const, error: "Incident is already resolved" };
    }

    let notes: string | null = null;
    if (data) {
      const parsed = resolveIncidentSchema.safeParse(data);
      if (!parsed.success) {
        return {
          success: false as const,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        };
      }
      notes = parsed.data.notes || null;
    }

    const incident = await prisma.emergencyIncident.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        notes,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "EmergencyIncident",
      entityId: id,
      changes: { status: "RESOLVED" },
    });

    revalidatePath("/settings/emergency");
    return { success: true as const, data: serialize(incident) };
  } catch (error) {
    console.error("[RESOLVE_INCIDENT_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to resolve emergency incident",
    };
  }
}

// ============================================================
// Get Emergency Incidents (Filtered)
// ============================================================

export async function getIncidents(params?: {
  status?: string;
  type?: string;
  bookingId?: string;
  severity?: string;
  search?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.type) {
      where.type = params.type;
    }

    if (params?.bookingId) {
      where.bookingId = params.bookingId;
    }

    if (params?.severity) {
      where.severity = params.severity;
    }

    if (params?.search?.trim()) {
      where.OR = [
        { description: { contains: params.search.trim(), mode: "insensitive" } },
        { notes: { contains: params.search.trim(), mode: "insensitive" } },
      ];
    }

    const incidents = await prisma.emergencyIncident.findMany({
      where,
      include: {
        protocol: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(incidents) };
  } catch (error) {
    console.error("[GET_INCIDENTS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch emergency incidents",
    };
  }
}

// ============================================================
// Get Active (Open/Responding) Incidents
// ============================================================

export async function getActiveIncidents() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "emergency:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const incidents = await prisma.emergencyIncident.findMany({
      where: {
        status: { in: ["OPEN", "RESPONDING"] },
      },
      include: {
        protocol: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    });

    return { success: true as const, data: serialize(incidents) };
  } catch (error) {
    console.error("[GET_ACTIVE_INCIDENTS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch active incidents",
    };
  }
}
