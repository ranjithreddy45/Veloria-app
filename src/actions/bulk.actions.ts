"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import {
  bulkUpdateContactsSchema,
  bulkDeleteSchema,
  bulkUpdateLeadsSchema,
  bulkAssignLeadsSchema,
  type BulkUpdateContactsInput,
  type BulkDeleteInput,
  type BulkUpdateLeadsInput,
  type BulkAssignLeadsInput,
} from "@/schemas/bulk.schema";

// ============================================================
// Bulk Update Contacts
// ============================================================

export async function bulkUpdateContacts(
  input: BulkUpdateContactsInput
): Promise<{ success: true; data: { count: number } } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkUpdateContactsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const { ids, data } = parsed.data;

    const result = await prisma.contact.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    // Log activity for each
    for (const id of ids) {
      logActivity({
        action: "BULK_UPDATE",
        entityType: "contact",
        entityId: id,
        changes: data,
        userId: session.user.id,
      });
    }

    return { success: true as const, data: { count: result.count } };
  } catch (error) {
    console.error("bulkUpdateContacts error:", error);
    return { success: false as const, error: "Failed to update contacts" };
  }
}

// ============================================================
// Bulk Delete Contacts
// ============================================================

export async function bulkDeleteContacts(
  input: BulkDeleteInput
): Promise<{ success: true; data: { count: number } } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkDeleteSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const result = await prisma.contact.deleteMany({
      where: { id: { in: parsed.data.ids } },
    });

    for (const id of parsed.data.ids) {
      logActivity({
        action: "BULK_DELETE",
        entityType: "contact",
        entityId: id,
        userId: session.user.id,
      });
    }

    return { success: true as const, data: { count: result.count } };
  } catch (error) {
    console.error("bulkDeleteContacts error:", error);
    return { success: false as const, error: "Failed to delete contacts" };
  }
}

// ============================================================
// Bulk Update Leads
// ============================================================

export async function bulkUpdateLeads(
  input: BulkUpdateLeadsInput
): Promise<{ success: true; data: { count: number } } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkUpdateLeadsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const { ids, data } = parsed.data;

    const result = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
        ...(data.source !== undefined && { source: data.source }),
      },
    });

    for (const id of ids) {
      logActivity({
        action: "BULK_UPDATE",
        entityType: "lead",
        entityId: id,
        changes: data,
        userId: session.user.id,
      });
    }

    return { success: true as const, data: { count: result.count } };
  } catch (error) {
    console.error("bulkUpdateLeads error:", error);
    return { success: false as const, error: "Failed to update leads" };
  }
}

// ============================================================
// Bulk Assign Leads
// ============================================================

export async function bulkAssignLeads(
  input: BulkAssignLeadsInput
): Promise<{ success: true; data: { count: number } } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkAssignLeadsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const result = await prisma.lead.updateMany({
      where: { id: { in: parsed.data.ids } },
      data: { assignedToId: parsed.data.assignedToId },
    });

    for (const id of parsed.data.ids) {
      logActivity({
        action: "BULK_ASSIGN",
        entityType: "lead",
        entityId: id,
        changes: { assignedToId: parsed.data.assignedToId },
        userId: session.user.id,
      });
    }

    return { success: true as const, data: { count: result.count } };
  } catch (error) {
    console.error("bulkAssignLeads error:", error);
    return { success: false as const, error: "Failed to assign leads" };
  }
}

// ============================================================
// Bulk Delete Leads
// ============================================================

export async function bulkDeleteLeads(
  input: BulkDeleteInput
): Promise<{ success: true; data: { count: number } } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkDeleteSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const result = await prisma.lead.deleteMany({
      where: { id: { in: parsed.data.ids } },
    });

    for (const id of parsed.data.ids) {
      logActivity({
        action: "BULK_DELETE",
        entityType: "lead",
        entityId: id,
        userId: session.user.id,
      });
    }

    return { success: true as const, data: { count: result.count } };
  } catch (error) {
    console.error("bulkDeleteLeads error:", error);
    return { success: false as const, error: "Failed to delete leads" };
  }
}
