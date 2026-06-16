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
  bulkEnrollCadenceSchema,
  bulkChangeLeadStatusSchema,
  type BulkUpdateContactsInput,
  type BulkDeleteInput,
  type BulkUpdateLeadsInput,
  type BulkAssignLeadsInput,
  type BulkEnrollCadenceInput,
  type BulkChangeLeadStatusInput,
} from "@/schemas/bulk.schema";
import { revalidatePath } from "next/cache";

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

    if (!hasPermission(session.user.role, "contacts:update")) {
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

    // Soft-delete (set deletedAt) rather than a hard deleteMany: contacts are
    // referenced by leads/bookings/invoices via FKs, so a hard delete throws a
    // constraint violation ("Failed to delete contacts"). Soft-delete is
    // reversible from Trash and never orphans a referencing row. Only touch
    // rows not already trashed so the count is accurate.
    const result = await prisma.contact.updateMany({
      where: { id: { in: parsed.data.ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    for (const id of parsed.data.ids) {
      logActivity({
        action: "BULK_DELETE",
        entityType: "contact",
        entityId: id,
        userId: session.user.id,
      });
    }

    revalidatePath("/contacts");
    revalidatePath("/settings/trash");
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

    if (!hasPermission(session.user.role, "leads:update")) {
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

    if (!hasPermission(session.user.role, "leads:assign")) {
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

    // Soft-delete (set deletedAt) rather than a hard deleteMany: leads are
    // referenced by deals/quotations/activities via FKs, so a hard delete
    // throws a constraint violation ("Failed to delete leads"). Soft-delete is
    // reversible from Trash and matches the single-row deleteLead path.
    const result = await prisma.lead.updateMany({
      where: { id: { in: parsed.data.ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    for (const id of parsed.data.ids) {
      logActivity({
        action: "BULK_DELETE",
        entityType: "lead",
        entityId: id,
        userId: session.user.id,
      });
    }

    revalidatePath("/leads");
    revalidatePath("/settings/trash");
    return { success: true as const, data: { count: result.count } };
  } catch (error) {
    console.error("bulkDeleteLeads error:", error);
    return { success: false as const, error: "Failed to delete leads" };
  }
}

// ============================================================
// Bulk Enroll Leads in Cadence
// ============================================================

export async function bulkEnrollInCadence(
  input: BulkEnrollCadenceInput
): Promise<{ success: true; data: { count: number } } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkEnrollCadenceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const { ids, cadenceId } = parsed.data;

    // Verify cadence exists
    const cadence = await prisma.cadence.findUnique({
      where: { id: cadenceId },
      select: { id: true, name: true },
    });

    if (!cadence) {
      return { success: false as const, error: "Cadence not found" };
    }

    // Get leads with their contacts
    const leads = await prisma.lead.findMany({
      where: { id: { in: ids } },
      select: { id: true, contactId: true },
    });

    // Create cadence enrollments for each lead's contact
    let enrolledCount = 0;
    for (const lead of leads) {
      try {
        // Check if already enrolled
        const existing = await prisma.cadenceEnrollment.findFirst({
          where: {
            cadenceId,
            entityId: lead.contactId,
            status: { in: ["ACTIVE", "PAUSED"] },
          },
        });

        if (!existing) {
          await prisma.cadenceEnrollment.create({
            data: {
              cadenceId,
              entityId: lead.contactId,
              enrolledById: session.user.id,
              status: "ACTIVE",
              currentStepOrder: 0,
            },
          });
          enrolledCount++;
        }
      } catch {
        // Skip individual enrollment failures
      }
    }

    for (const id of ids) {
      logActivity({
        action: "BULK_ENROLL_CADENCE",
        entityType: "lead",
        entityId: id,
        changes: { cadenceId, cadenceName: cadence.name },
        userId: session.user.id,
      });
    }

    revalidatePath("/leads");
    return { success: true as const, data: { count: enrolledCount } };
  } catch (error) {
    console.error("bulkEnrollInCadence error:", error);
    return { success: false as const, error: "Failed to enroll in cadence" };
  }
}

// ============================================================
// Bulk Change Lead Status
// ============================================================

export async function bulkChangeLeadStatus(
  input: BulkChangeLeadStatusInput
): Promise<{ success: true; data: { count: number } } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkChangeLeadStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const { ids, status } = parsed.data;

    const result = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { status: status as any },
    });

    for (const id of ids) {
      logActivity({
        action: "BULK_STATUS_CHANGE",
        entityType: "lead",
        entityId: id,
        changes: { status },
        userId: session.user.id,
      });
    }

    revalidatePath("/leads");
    return { success: true as const, data: { count: result.count } };
  } catch (error) {
    console.error("bulkChangeLeadStatus error:", error);
    return { success: false as const, error: "Failed to change lead status" };
  }
}
