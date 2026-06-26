"use server";

// ============================================================
// Missed-call rescue — internal cockpit server actions.
//
// Read-only audit over the MissedCallRescue rows written by the public
// inbound-telephony webhook, plus a guarded retry that re-fires the instant
// WhatsApp first-response for an UNKNOWN-number rescue whose message didn't
// land. Money-free (counts only); all Date values serialized before return.
//
// Gating: getMissedCallRescues / getMissedCallRescueStats → leads:read.
// retryMissedCallWhatsApp → communications:create.
// ============================================================

import { revalidatePath } from "next/cache";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { runSpeedToLead } from "@/lib/lead-first-response";

// ============================================================
// Types (serialized — Dates as ISO strings)
// ============================================================

export interface MissedCallRescueRow {
  id: string;
  provider: string;
  externalCallId: string | null;
  callerPhone: string;
  receivedAt: string;
  wasKnownNumber: boolean;
  leadId: string | null;
  contactId: string | null;
  contactName: string | null;
  leadTitle: string | null;
  whatsappSent: boolean;
  whatsappMessageId: string | null;
  failReason: string | null;
}

export interface MissedCallRescueStats {
  total: number;
  unknownConverted: number;
  knownAck: number;
  whatsappSent: number;
  whatsappSentRatePct: number;
  last24h: number;
}

export interface MissedCallRescuePage {
  rows: MissedCallRescueRow[];
  total: number;
  page: number;
  limit: number;
}

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

interface GetMissedCallRescuesArgs {
  status?: "sent" | "failed";
  wasKnownNumber?: boolean;
  page?: number;
  limit?: number;
}

// ============================================================
// List
// ============================================================

export async function getMissedCallRescues(
  args: GetMissedCallRescuesArgs = {}
): Promise<Result<MissedCallRescuePage>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(100, Math.max(1, args.limit ?? 50));

    const where: Record<string, unknown> = {};
    if (typeof args.wasKnownNumber === "boolean") {
      where.wasKnownNumber = args.wasKnownNumber;
    }
    if (args.status === "sent") where.whatsappSent = true;
    if (args.status === "failed") where.whatsappSent = false;

    const [total, records] = await Promise.all([
      prisma.missedCallRescue.count({ where }),
      prisma.missedCallRescue.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Hydrate lead/contact labels in batch (plain String refs, no FK join).
    const leadIds = [
      ...new Set(records.map((r) => r.leadId).filter(Boolean) as string[]),
    ];
    const contactIds = [
      ...new Set(records.map((r) => r.contactId).filter(Boolean) as string[]),
    ];

    const [leads, contacts] = await Promise.all([
      leadIds.length
        ? prisma.lead.findMany({
            where: { id: { in: leadIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      contactIds.length
        ? prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
    ]);

    const leadMap = new Map(leads.map((l) => [l.id, l.title]));
    const contactMap = new Map(
      contacts.map((c) => [
        c.id,
        `${c.firstName} ${c.lastName ?? ""}`.trim() || null,
      ])
    );

    const rows: MissedCallRescueRow[] = records.map((r) => ({
      id: r.id,
      provider: r.provider,
      externalCallId: r.externalCallId,
      callerPhone: r.callerPhone,
      receivedAt: r.receivedAt.toISOString(),
      wasKnownNumber: r.wasKnownNumber,
      leadId: r.leadId,
      contactId: r.contactId,
      contactName: r.contactId ? contactMap.get(r.contactId) ?? null : null,
      leadTitle: r.leadId ? leadMap.get(r.leadId) ?? null : null,
      whatsappSent: r.whatsappSent,
      whatsappMessageId: r.whatsappMessageId,
      failReason: r.failReason,
    }));

    return { success: true as const, data: { rows, total, page, limit } };
  } catch (error) {
    console.error("getMissedCallRescues error:", error);
    return { success: false as const, error: "Failed to load missed calls" };
  }
}

// ============================================================
// Stats
// ============================================================

export async function getMissedCallRescueStats(): Promise<
  Result<MissedCallRescueStats>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, unknownConverted, knownAck, whatsappSent, last24h] =
      await Promise.all([
        prisma.missedCallRescue.count(),
        prisma.missedCallRescue.count({
          where: { wasKnownNumber: false, leadId: { not: null } },
        }),
        prisma.missedCallRescue.count({ where: { wasKnownNumber: true } }),
        prisma.missedCallRescue.count({ where: { whatsappSent: true } }),
        prisma.missedCallRescue.count({
          where: { receivedAt: { gte: since24h } },
        }),
      ]);

    // Send rate is over UNKNOWN rescues only — KNOWN rows intentionally never
    // send (existing flow owns re-engagement), so including them would deflate it.
    const unknownTotal = await prisma.missedCallRescue.count({
      where: { wasKnownNumber: false },
    });
    const whatsappSentRatePct =
      unknownTotal > 0 ? Math.round((whatsappSent / unknownTotal) * 100) : 0;

    return {
      success: true as const,
      data: {
        total,
        unknownConverted,
        knownAck,
        whatsappSent,
        whatsappSentRatePct,
        last24h,
      },
    };
  } catch (error) {
    console.error("getMissedCallRescueStats error:", error);
    return { success: false as const, error: "Failed to load stats" };
  }
}

// ============================================================
// Retry the instant WhatsApp first-response
// ============================================================

export async function retryMissedCallWhatsApp(
  id: string
): Promise<Result<{ status: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "communications:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!id || typeof id !== "string") {
      return { success: false as const, error: "Invalid record" };
    }

    const rescue = await prisma.missedCallRescue.findUnique({
      where: { id },
      select: {
        id: true,
        leadId: true,
        contactId: true,
        whatsappSent: true,
        wasKnownNumber: true,
      },
    });

    if (!rescue) {
      return { success: false as const, error: "Record not found" };
    }
    if (rescue.whatsappSent) {
      return {
        success: false as const,
        error: "WhatsApp first-response already sent",
      };
    }
    if (rescue.wasKnownNumber) {
      return {
        success: false as const,
        error:
          "Known caller — the existing speed-to-lead flow owns re-engagement.",
      };
    }
    if (!rescue.leadId || !rescue.contactId) {
      return {
        success: false as const,
        error: "No lead/contact linked — cannot message.",
      };
    }

    // Clear any prior first-response audit row so runSpeedToLead's idempotency
    // guard allows a re-run, exactly like the speed-to-lead retry path.
    await prisma.leadFirstResponse.deleteMany({
      where: { leadId: rescue.leadId },
    });

    const result = await runSpeedToLead({
      lead: { id: rescue.leadId, contactId: rescue.contactId },
    });

    const sent = result.ok && result.status === "SENT";

    // Reflect the new outcome onto the audit row.
    let whatsappMessageId: string | null = null;
    let failReason: string | null = sent
      ? null
      : result.reason || `First-response ${result.status.toLowerCase()}.`;
    try {
      const fr = await prisma.leadFirstResponse.findUnique({
        where: { leadId: rescue.leadId },
        select: { whatsappMessageId: true, failReason: true },
      });
      whatsappMessageId = fr?.whatsappMessageId ?? null;
      if (!sent && fr?.failReason) failReason = fr.failReason;
    } catch {
      // best-effort
    }

    await prisma.missedCallRescue.update({
      where: { id: rescue.id },
      data: {
        whatsappSent: sent,
        whatsappMessageId,
        failReason: sent ? null : failReason,
      },
    });

    revalidatePath("/leads/missed-calls");

    if (!sent) {
      return {
        success: false as const,
        error: failReason || "Retry failed to send",
      };
    }
    return { success: true as const, data: { status: result.status } };
  } catch (error) {
    console.error("retryMissedCallWhatsApp error:", error);
    return { success: false as const, error: "Failed to retry first-response" };
  }
}
