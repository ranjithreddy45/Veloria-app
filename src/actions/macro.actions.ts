"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { macroSchema, type MacroInput, type MacroAction } from "@/schemas/macro.schema";

// Allowlist of fields that macros can modify — prevents privilege escalation
const ALLOWED_LEAD_FIELDS = new Set(["status", "source", "priority", "score", "estimatedValue", "eventType", "eventDate", "guestCount", "description", "tags"]);
const ALLOWED_CONTACT_FIELDS = new Set(["type", "company", "city", "state", "country", "tags", "source"]);

// ============================================================
// Types
// ============================================================

export interface MacroData {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  icon: string;
  color: string;
  actions: MacroAction[];
  isShared: boolean;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CRUD
// ============================================================

export async function getMacros(
  entityType?: string
): Promise<
  | { success: true; data: MacroData[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const macros = await prisma.macro.findMany({
      where: {
        isActive: true,
        ...(entityType && { entityType }),
        OR: [
          { isShared: true },
          { createdById: session.user.id },
        ],
      },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(macros) as unknown as MacroData[] };
  } catch (error) {
    console.error("getMacros error:", error);
    return { success: false as const, error: "Failed to load macros" };
  }
}

export async function getAllMacros(): Promise<
  | { success: true; data: MacroData[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const macros = await prisma.macro.findMany({
      orderBy: [{ entityType: "asc" }, { name: "asc" }],
    });

    return { success: true as const, data: serialize(macros) as unknown as MacroData[] };
  } catch (error) {
    console.error("getAllMacros error:", error);
    return { success: false as const, error: "Failed to load macros" };
  }
}

export async function createMacro(
  input: MacroInput
): Promise<
  | { success: true; data: MacroData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = macroSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const macro = await prisma.macro.create({
      data: {
        name: data.name,
        description: data.description,
        entityType: data.entityType,
        icon: data.icon,
        color: data.color,
        actions: data.actions as unknown as object,
        isShared: data.isShared,
        isActive: data.isActive,
        createdById: session.user.id,
      },
    });

    logActivity({
      action: "CREATE_MACRO",
      entityType: "macro",
      entityId: macro.id,
      changes: { name: macro.name },
      userId: session.user.id,
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return { success: true as const, data: serialize(macro) as unknown as MacroData };
  } catch (error) {
    console.error("createMacro error:", error);
    return { success: false as const, error: "Failed to create macro" };
  }
}

export async function updateMacro(
  id: string,
  input: MacroInput
): Promise<
  | { success: true; data: MacroData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = macroSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    const macro = await prisma.macro.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        entityType: data.entityType,
        icon: data.icon,
        color: data.color,
        actions: data.actions as unknown as object,
        isShared: data.isShared,
        isActive: data.isActive,
      },
    });

    return { success: true as const, data: serialize(macro) as unknown as MacroData };
  } catch (error) {
    console.error("updateMacro error:", error);
    return { success: false as const, error: "Failed to update macro" };
  }
}

export async function deleteMacro(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.macro.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("deleteMacro error:", error);
    return { success: false as const, error: "Failed to delete macro" };
  }
}

// ============================================================
// Execute Macro
// ============================================================

export async function executeMacro(
  macroId: string,
  entityId: string
): Promise<
  | { success: true; data: { executedActions: number } }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const macro = await prisma.macro.findUnique({ where: { id: macroId } });
    if (!macro) {
      return { success: false as const, error: "Macro not found" };
    }

    const actions = macro.actions as unknown as MacroAction[];
    let executedCount = 0;

    for (const action of actions) {
      try {
        switch (action.type) {
          case "UPDATE_STATUS": {
            const status = action.config.status as string;
            if (macro.entityType === "LEAD") {
              await prisma.lead.update({
                where: { id: entityId },
                data: { status: status as "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST" },
              });
            }
            executedCount++;
            break;
          }
          case "UPDATE_FIELD": {
            const field = action.config.field as string;
            const value = action.config.value;
            // Validate field against allowlist to prevent privilege escalation
            if (macro.entityType === "LEAD") {
              if (!ALLOWED_LEAD_FIELDS.has(field)) {
                console.warn(`[MACRO] Blocked update to disallowed lead field: ${field}`);
                break;
              }
              await prisma.lead.update({
                where: { id: entityId },
                data: { [field]: value },
              });
            } else if (macro.entityType === "CONTACT") {
              if (!ALLOWED_CONTACT_FIELDS.has(field)) {
                console.warn(`[MACRO] Blocked update to disallowed contact field: ${field}`);
                break;
              }
              await prisma.contact.update({
                where: { id: entityId },
                data: { [field]: value },
              });
            }
            executedCount++;
            break;
          }
          case "CREATE_TASK": {
            const title = action.config.title as string;
            const priority = (action.config.priority as string) || "MEDIUM";
            const dueDaysFromNow = (action.config.dueDays as number) || 3;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + dueDaysFromNow);

            // Find the booking associated with the entity if it's a lead
            let bookingId: string | undefined;
            if (macro.entityType === "LEAD") {
              const lead = await prisma.lead.findUnique({
                where: { id: entityId },
                select: { deal: { select: { booking: { select: { id: true } } } } },
              });
              bookingId = lead?.deal?.booking?.id ?? undefined;
            }

            await prisma.task.create({
              data: {
                title,
                priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                dueDate,
                creatorId: session.user.id,
                assigneeId: session.user.id,
                ...(bookingId && { bookingId }),
              },
            });
            executedCount++;
            break;
          }
          case "LOG_COMMUNICATION": {
            const commType = (action.config.commType as string) || "NOTE";
            const content = (action.config.content as string) || `Macro: ${macro.name}`;

            // Get contactId based on entity type
            let contactId: string | undefined;
            if (macro.entityType === "CONTACT") {
              contactId = entityId;
            } else if (macro.entityType === "LEAD") {
              const lead = await prisma.lead.findUnique({
                where: { id: entityId },
                select: { contactId: true },
              });
              contactId = lead?.contactId;
            }

            if (contactId) {
              await prisma.communication.create({
                data: {
                  type: commType as "NOTE" | "CALL" | "EMAIL" | "SMS" | "MEETING" | "WHATSAPP",
                  content,
                  subject: `Macro: ${macro.name}`,
                  contactId,
                  createdById: session.user.id,
                },
              });
            }
            executedCount++;
            break;
          }
        }
      } catch (actionError) {
        console.error(`Macro action ${action.type} failed:`, actionError);
      }
    }

    logActivity({
      action: "EXECUTE_MACRO",
      entityType: macro.entityType.toLowerCase(),
      entityId,
      changes: { macroName: macro.name, executedActions: executedCount },
      userId: session.user.id,
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return { success: true as const, data: { executedActions: executedCount } };
  } catch (error) {
    console.error("executeMacro error:", error);
    return { success: false as const, error: "Failed to execute macro" };
  }
}
