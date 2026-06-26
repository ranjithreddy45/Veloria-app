"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { Prisma } from "@prisma/client";
import { classifyIntent } from "@/lib/ai/intent";

// ============================================================
// Intent actions — read history, hot worklist, manual reclassify
// ============================================================
// All gate RBAC at the top and return Result<T>. MessageIntentClassification
// is internal-only (no public route reads it) so PII in rawText never leaks.

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface IntentClassificationData {
  id: string;
  whatsappMessageId: string | null;
  communicationId: string | null;
  contactId: string | null;
  leadId: string | null;
  intent: string;
  confidence: number;
  method: string;
  rawText: string | null;
  scoreBoostApplied: number;
  repNotifiedAt: string | null;
  createdAt: string;
}

export interface HotIntentLead {
  id: string;
  title: string | null;
  intent: string | null;
  intentAt: string | null;
  score: number;
  status: string;
  assignedToId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null } | null;
}

export async function getLeadIntentHistory(
  leadId: string
): Promise<Result<IntentClassificationData[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    if (!leadId) {
      return { success: false as const, error: "Lead is required" };
    }

    const rows = await prisma.messageIntentClassification.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      success: true as const,
      data: serialize(rows) as unknown as IntentClassificationData[],
    };
  } catch (error) {
    console.error("getLeadIntentHistory error:", error);
    return { success: false as const, error: "Failed to load intent history" };
  }
}

export async function getHotIntentLeads(): Promise<Result<HotIntentLead[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const leads = await prisma.lead.findMany({
      where: {
        intent: "READY_TO_BUY",
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"] },
      },
      orderBy: [{ intentAt: "desc" }, { score: "desc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        intent: true,
        intentAt: true,
        score: true,
        status: true,
        assignedToId: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      success: true as const,
      data: serialize(leads) as unknown as HotIntentLead[],
    };
  } catch (error) {
    console.error("getHotIntentLeads error:", error);
    return { success: false as const, error: "Failed to load hot leads" };
  }
}

export async function reclassifyMessage(
  classificationId: string
): Promise<Result<IntentClassificationData>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    if (!classificationId) {
      return { success: false as const, error: "Classification is required" };
    }

    const existing = await prisma.messageIntentClassification.findUnique({
      where: { id: classificationId },
      select: { id: true, rawText: true, leadId: true },
    });
    if (!existing) {
      return { success: false as const, error: "Classification not found" };
    }
    if (!existing.rawText) {
      return { success: false as const, error: "No stored text to reclassify" };
    }

    const result = await classifyIntent(existing.rawText);

    const updated = await prisma.messageIntentClassification.update({
      where: { id: classificationId },
      data: {
        intent: result.intent,
        confidence: new Prisma.Decimal(result.confidence.toFixed(3)),
        method: result.method,
      },
    });

    // Re-denormalize the lead's latest intent if this row is tied to one.
    if (existing.leadId) {
      await prisma.lead.update({
        where: { id: existing.leadId },
        data: { intent: result.intent, intentAt: new Date() },
      }).catch((e) => console.error("[reclassifyMessage] denorm error:", e));
    }

    return {
      success: true as const,
      data: serialize(updated) as unknown as IntentClassificationData,
    };
  } catch (error) {
    console.error("reclassifyMessage error:", error);
    return { success: false as const, error: "Failed to reclassify message" };
  }
}
