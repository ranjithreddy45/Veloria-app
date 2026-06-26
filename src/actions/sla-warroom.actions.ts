"use server";

// ============================================================
// SLA War-Room — read-side cockpit server actions.
//
// Live board over the existing Lead SLA clock
// (firstContactDue / firstRespondedAt / slaEscalatedAt) plus the tiered
// LeadSlaEscalation ledger. Returns every open, unanswered lead with a
// running first-response countdown (computed client-side off the serialized
// firstContactDue ISO), a server-computed risk band, and the current highest
// escalation tier. Money-free; all Date values are serialized to ISO before
// return. RBAC-gated leads:read at the top of every action.
// ============================================================

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { stampLeadResponded } from "@/lib/lead-pipeline";
import {
  resolveOpenEscalations,
  resolveOpenEscalationsForContact,
  SLA_WARN_MINUTES,
  SLA_DEEP_BREACH_MINUTES,
} from "@/lib/sla/war-room-escalation";
import type { SlaEscalationTier } from "@prisma/client";

// ============================================================
// Types
// ============================================================

export type RiskBand = "OK" | "WARN" | "BREACHED";

export interface WarRoomRow {
  leadId: string;
  title: string;
  contactName: string;
  assigneeName: string | null;
  score: number;
  firstContactDue: string | null;
  /** Seconds until firstContactDue at request time (negative = breached). */
  secondsRemaining: number;
  riskBand: RiskBand;
  /** Highest escalation tier currently fired for this lead. */
  escalationTier: SlaEscalationTier;
}

export interface WarRoomSummary {
  pendingCount: number;
  warnCount: number;
  breachedCount: number;
  escalatedManagerCount: number;
  avgMinutesToBreach: number | null;
}

export interface WarRoomBoard {
  rows: WarRoomRow[];
  summary: WarRoomSummary;
  generatedAt: string;
}

export interface WarRoomTierConfig {
  warnMinutes: number;
  deepBreachMinutes: number;
}

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================
// Helpers
// ============================================================

const TIER_RANK: Record<SlaEscalationTier, number> = {
  NONE: 0,
  WARN_REP: 1,
  ESCALATE_MANAGER: 2,
  ESCALATE_ADMIN: 3,
};

/** Highest-rank tier among a lead's escalation rows. */
function highestTier(tiers: SlaEscalationTier[]): SlaEscalationTier {
  let best: SlaEscalationTier = "NONE";
  for (const t of tiers) {
    if (TIER_RANK[t] > TIER_RANK[best]) best = t;
  }
  return best;
}

// ============================================================
// Board
// ============================================================

export async function getSlaWarRoomBoard(): Promise<Result<WarRoomBoard>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const warnWindowMs = SLA_WARN_MINUTES * 60_000;

    // Every open, unanswered lead with the SLA clock running.
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
        firstRespondedAt: null,
        firstContactDue: { not: null },
      },
      orderBy: { firstContactDue: "asc" },
      take: 300,
      select: {
        id: true,
        title: true,
        score: true,
        firstContactDue: true,
        contact: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
      },
    });

    // Highest fired tier per lead (plain-ref table, no relation → fetch + map).
    const escalations = await prisma.leadSlaEscalation.findMany({
      where: {
        leadId: { in: leads.map((l) => l.id) },
        resolvedAt: null,
      },
      select: { leadId: true, tier: true },
    });
    const tierByLead = new Map<string, SlaEscalationTier[]>();
    for (const e of escalations) {
      const arr = tierByLead.get(e.leadId) ?? [];
      arr.push(e.tier);
      tierByLead.set(e.leadId, arr);
    }

    let pendingCount = 0;
    let warnCount = 0;
    let breachedCount = 0;

    const rows: WarRoomRow[] = leads.map((l) => {
      const dueMs = l.firstContactDue ? l.firstContactDue.getTime() : now.getTime();
      const secondsRemaining = Math.round((dueMs - now.getTime()) / 1000);
      const remainingMs = dueMs - now.getTime();

      let riskBand: RiskBand;
      if (remainingMs <= 0) riskBand = "BREACHED";
      else if (remainingMs <= warnWindowMs) riskBand = "WARN";
      else riskBand = "OK";

      if (riskBand === "BREACHED") breachedCount++;
      else if (riskBand === "WARN") warnCount++;
      else pendingCount++;

      const contactName =
        `${l.contact?.firstName ?? ""} ${l.contact?.lastName ?? ""}`.trim() ||
        "Unknown contact";

      return {
        leadId: l.id,
        title: l.title,
        contactName,
        assigneeName: l.assignedTo?.name ?? null,
        score: l.score ?? 0,
        firstContactDue: l.firstContactDue ? l.firstContactDue.toISOString() : null,
        secondsRemaining,
        riskBand,
        escalationTier: highestTier(tierByLead.get(l.id) ?? []),
      };
    });

    // Sort most-urgent-first (least seconds remaining, breaches at the top).
    rows.sort((a, b) => a.secondsRemaining - b.secondsRemaining);

    // Count of leads currently escalated to a manager (distinct leadIds).
    const escalatedManagerCount = new Set(
      escalations.filter((e) => e.tier === "ESCALATE_MANAGER").map((e) => e.leadId)
    ).size;

    // Average minutes-to-breach across leads still on the safe side of due.
    const safeRemaining = rows
      .filter((r) => r.secondsRemaining > 0)
      .map((r) => r.secondsRemaining / 60);
    const avgMinutesToBreach =
      safeRemaining.length > 0
        ? Math.round(
            safeRemaining.reduce((s, v) => s + v, 0) / safeRemaining.length
          )
        : null;

    return {
      success: true as const,
      data: {
        rows,
        summary: {
          pendingCount,
          warnCount,
          breachedCount,
          escalatedManagerCount,
          avgMinutesToBreach,
        },
        generatedAt: now.toISOString(),
      },
    };
  } catch (error) {
    console.error("getSlaWarRoomBoard error:", error);
    return { success: false as const, error: "Failed to load SLA war-room board" };
  }
}

// ============================================================
// Tier config (read-only)
// ============================================================

export async function getSlaWarRoomTierConfig(): Promise<
  Result<WarRoomTierConfig>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    return {
      success: true as const,
      data: {
        warnMinutes: SLA_WARN_MINUTES,
        deepBreachMinutes: SLA_DEEP_BREACH_MINUTES,
      },
    };
  } catch (error) {
    console.error("getSlaWarRoomTierConfig error:", error);
    return { success: false as const, error: "Failed to load tier config" };
  }
}

// ============================================================
// Manual "mark responded" shortcut
// ============================================================

/**
 * Mark a lead as responded from the cockpit: stops the SLA clock (contact-level,
 * matching stampLeadResponded semantics) and resolves the lead's open
 * LeadSlaEscalation rows so it drops off the board. Gated leads:read since the
 * board is read-oriented; the underlying stamp is idempotent.
 */
export async function resolveSlaLead(
  leadId: string
): Promise<Result<{ leadId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    if (!leadId || typeof leadId !== "string") {
      return { success: false as const, error: "Invalid lead" };
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { id: true, contactId: true },
    });
    if (!lead) {
      return { success: false as const, error: "Lead not found" };
    }

    // Stop the clock for the contact's open leads (matches stampLeadResponded's
    // contact-level semantics), then resolve escalations for those same leads.
    await stampLeadResponded(lead.contactId);
    await resolveOpenEscalationsForContact(lead.contactId);
    // Belt-and-braces: ensure this specific lead's escalations are resolved.
    await resolveOpenEscalations(lead.id);

    return { success: true as const, data: { leadId: lead.id } };
  } catch (error) {
    console.error("resolveSlaLead error:", error);
    return { success: false as const, error: "Failed to mark lead responded" };
  }
}
