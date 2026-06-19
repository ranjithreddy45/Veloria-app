"use server";

// ============================================================
// Speed-to-Lead — SLA cockpit server actions.
//
// Read-only dashboard over the existing Lead SLA clock
// (firstContactDue / firstRespondedAt / slaEscalatedAt) plus the
// LeadFirstResponse audit rows written by runSpeedToLead. Plus a guarded
// retry for FAILED/SKIPPED first-responses. Money-free; all Date/Decimal
// values are serialized before return.
// ============================================================

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { runSpeedToLead } from "@/lib/lead-first-response";

// ============================================================
// Types
// ============================================================

export interface SpeedToLeadSummary {
  pendingSla: number;
  breachedSla: number;
  sentLast24h: number;
  avgLatencyMs: number | null;
  under60sPct: number;
}

export interface SpeedToLeadBreachRow {
  leadId: string;
  title: string;
  contactName: string;
  assignedToName: string | null;
  firstContactDue: string | null;
  minutesOverdue: number;
}

export interface SpeedToLeadRecentRow {
  leadId: string;
  contactName: string;
  status: string;
  channel: string;
  latencyMs: number | null;
  assignedToName: string | null;
  sentAt: string | null;
  failReason: string | null;
}

export interface SpeedToLeadDashboard {
  summary: SpeedToLeadSummary;
  breaches: SpeedToLeadBreachRow[];
  recent: SpeedToLeadRecentRow[];
}

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================
// Dashboard
// ============================================================

export async function getSpeedToLeadDashboard(): Promise<
  Result<SpeedToLeadDashboard>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      pendingSla,
      breachedSla,
      sentLast24h,
      latencyAgg,
      under60Count,
      latencyTotal,
      breachedLeads,
      recentResponses,
    ] = await Promise.all([
      // Pending: SLA clock running, not yet responded, not yet due.
      prisma.lead.count({
        where: {
          deletedAt: null,
          status: { in: ["NEW", "CONTACTED"] },
          firstRespondedAt: null,
          firstContactDue: { not: null, gte: now },
        },
      }),
      // Breached: past due, still unanswered.
      prisma.lead.count({
        where: {
          deletedAt: null,
          status: { in: ["NEW", "CONTACTED"] },
          firstRespondedAt: null,
          firstContactDue: { not: null, lt: now },
        },
      }),
      // Automated first-responses successfully sent in the last 24h.
      prisma.leadFirstResponse.count({
        where: { status: "SENT", sentAt: { gte: since24h } },
      }),
      // Avg send latency across all SENT responses with a measured latency.
      prisma.leadFirstResponse.aggregate({
        where: { status: "SENT", latencyMs: { not: null } },
        _avg: { latencyMs: true },
      }),
      // Count of SENT responses under the 60s controllable target.
      prisma.leadFirstResponse.count({
        where: { status: "SENT", latencyMs: { not: null, lte: 60_000 } },
      }),
      // Denominator for the under-60s percentage.
      prisma.leadFirstResponse.count({
        where: { status: "SENT", latencyMs: { not: null } },
      }),
      // Breach table — surface unanswered overdue leads (incl. SKIPPED/no-phone).
      prisma.lead.findMany({
        where: {
          deletedAt: null,
          status: { in: ["NEW", "CONTACTED"] },
          firstRespondedAt: null,
          firstContactDue: { not: null, lt: now },
        },
        orderBy: { firstContactDue: "asc" },
        take: 50,
        select: {
          id: true,
          title: true,
          firstContactDue: true,
          contact: { select: { firstName: true, lastName: true } },
          assignedTo: { select: { name: true } },
        },
      }),
      // Recent automated first-response feed.
      prisma.leadFirstResponse.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          leadId: true,
          status: true,
          channel: true,
          latencyMs: true,
          sentAt: true,
          failReason: true,
          assignedTo: { select: { name: true } },
          lead: {
            select: {
              contact: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    const avgLatencyMs =
      latencyAgg._avg.latencyMs != null
        ? Math.round(latencyAgg._avg.latencyMs)
        : null;
    const under60sPct =
      latencyTotal > 0 ? Math.round((under60Count / latencyTotal) * 100) : 0;

    const breaches: SpeedToLeadBreachRow[] = breachedLeads.map((l) => {
      const contactName =
        `${l.contact?.firstName ?? ""} ${l.contact?.lastName ?? ""}`.trim() ||
        "Unknown contact";
      const due = l.firstContactDue ? l.firstContactDue.getTime() : now.getTime();
      const minutesOverdue = Math.max(
        0,
        Math.floor((now.getTime() - due) / 60_000)
      );
      return {
        leadId: l.id,
        title: l.title,
        contactName,
        assignedToName: l.assignedTo?.name ?? null,
        firstContactDue: l.firstContactDue ? l.firstContactDue.toISOString() : null,
        minutesOverdue,
      };
    });

    const recent: SpeedToLeadRecentRow[] = recentResponses.map((r) => {
      const c = r.lead?.contact;
      const contactName =
        `${c?.firstName ?? ""} ${c?.lastName ?? ""}`.trim() || "Unknown contact";
      return {
        leadId: r.leadId,
        contactName,
        status: r.status,
        channel: r.channel,
        latencyMs: r.latencyMs ?? null,
        assignedToName: r.assignedTo?.name ?? null,
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
        failReason: r.failReason ?? null,
      };
    });

    return {
      success: true as const,
      data: {
        summary: { pendingSla, breachedSla, sentLast24h, avgLatencyMs, under60sPct },
        breaches,
        recent,
      },
    };
  } catch (error) {
    console.error("getSpeedToLeadDashboard error:", error);
    return { success: false as const, error: "Failed to load speed-to-lead dashboard" };
  }
}

// ============================================================
// Retry a failed / skipped first-response
// ============================================================

export async function retrySpeedToLead(
  leadId: string
): Promise<Result<{ status: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!leadId || typeof leadId !== "string") {
      return { success: false as const, error: "Invalid lead" };
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: {
        id: true,
        contactId: true,
        title: true,
        assignedToId: true,
        source: true,
        eventType: true,
        status: true,
        guestCount: true,
        score: true,
        estimatedValue: true,
        firstResponse: { select: { status: true } },
      },
    });
    if (!lead) {
      return { success: false as const, error: "Lead not found" };
    }

    // Only retry rows that actually failed / were skipped — never re-spam a
    // contact who already received a successful first-response.
    const prior = lead.firstResponse?.status;
    if (prior && prior !== "FAILED" && prior !== "SKIPPED") {
      return {
        success: false as const,
        error: "First-response already sent for this lead",
      };
    }

    // Delete the prior row so runSpeedToLead's idempotency guard allows a re-run.
    await prisma.leadFirstResponse.deleteMany({ where: { leadId } });

    const result = await runSpeedToLead({
      lead: {
        id: lead.id,
        contactId: lead.contactId,
        title: lead.title,
        assignedToId: lead.assignedToId,
        source: lead.source,
        eventType: lead.eventType,
        status: lead.status,
        guestCount: lead.guestCount,
        score: lead.score,
        estimatedValue:
          lead.estimatedValue != null ? lead.estimatedValue.toString() : null,
      },
      assignedToId: lead.assignedToId,
    });

    if (!result.ok) {
      return {
        success: false as const,
        error: result.reason || "Retry failed to send",
      };
    }
    return { success: true as const, data: { status: result.status } };
  } catch (error) {
    console.error("retrySpeedToLead error:", error);
    return { success: false as const, error: "Failed to retry first-response" };
  }
}
