// ============================================================
// SLA War-Room — tiered escalation engine.
//
// Plain library (NOT "use server"): callable from the fast cron handler
// and from server actions alike. Drives a graduated escalation ladder on
// top of the existing speed-to-lead SLA clock
// (Lead.firstContactDue / firstRespondedAt / slaEscalatedAt):
//
//   1. WARN_REP          — a few minutes BEFORE firstContactDue, ping the
//                          assigned rep ("respond now, clock about to breach").
//   2. ESCALATE_MANAGER  — AT/after firstContactDue, escalate to the sales
//                          head(s) (fallback: admins) — still unanswered.
//   3. ESCALATE_ADMIN    — deep breach (well past due), escalate to admins.
//
// Each tier fires exactly once per lead via the additive LeadSlaEscalation
// model (@@unique([leadId, tier])) — strictly mirroring the existing
// one-shot slaEscalatedAt dedupe discipline. Inserts are guarded by the
// unique constraint and a P2002 catch rather than read-then-write, so two
// overlapping cron runs can't double-alert.
//
// This runs ALONGSIDE the legacy escalateLeadSlaBreaches sweep (which keeps
// setting slaEscalatedAt + pinging the assignee at breach). To avoid
// double-pinging, the war-room engine OWNS the before-due warn ping and the
// manager/admin ladder; the assignee-at-breach ping stays with the legacy
// sweep.
//
// Best-effort: never throws, batched (take 200/tier), uses notifyAwait so a
// serverless cron freeze can't drop the alert/ledger writes.
// ============================================================

import { Prisma } from "@prisma/client";
import type { SlaEscalationTier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { LEAD_SLA_MINUTES } from "@/lib/lead-pipeline";

// ------------------------------------------------------------
// Thresholds (minutes, relative to firstContactDue)
// ------------------------------------------------------------
// All read from env with sane constant fallbacks so they can be tuned per
// deployment without a code change. Values are clamped to non-negative.

function envMinutes(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Warn the rep this many minutes BEFORE firstContactDue. */
export const SLA_WARN_MINUTES = envMinutes("SLA_WARN_MINUTES", 5);

/** Deep breach = this many minutes PAST firstContactDue → escalate to admins. */
export const SLA_DEEP_BREACH_MINUTES = envMinutes("SLA_DEEP_BREACH_MINUTES", 30);

/** Per-tier batch cap, mirroring escalateLeadSlaBreaches. */
const BATCH = 200;

// ------------------------------------------------------------
// Result shape
// ------------------------------------------------------------

export interface SlaWarRoomEscalationResult {
  warned: number;
  managerEscalated: number;
  adminEscalated: number;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

interface LeadLite {
  id: string;
  title: string;
  assignedToId: string | null;
  firstContactDue: Date | null;
  contact: { firstName: string | null; lastName: string | null } | null;
}

const LEAD_SELECT = {
  id: true,
  title: true,
  assignedToId: true,
  firstContactDue: true,
  contact: { select: { firstName: true, lastName: true } },
} as const;

function contactLabel(lead: LeadLite): string {
  const name = `${lead.contact?.firstName ?? ""} ${lead.contact?.lastName ?? ""}`.trim();
  return name || lead.title || "a new lead";
}

function minutesPastDue(due: Date | null, now: Date): number {
  if (!due) return 0;
  return Math.max(0, Math.round((now.getTime() - due.getTime()) / 60_000));
}

/**
 * Pre-fetch the set of lead IDs that already have a row for `tier`. The
 * LeadSlaEscalation model is a plain-ref table (no Lead relation), so we can't
 * filter via a relation `none` clause — we fetch fired IDs and exclude in JS.
 * The @@unique([leadId, tier]) + P2002 catch in claimTier remains the real
 * one-shot guard; this just trims the candidate set per run.
 */
async function firedLeadIds(tier: SlaEscalationTier): Promise<Set<string>> {
  try {
    const rows = await prisma.leadSlaEscalation.findMany({
      where: { tier },
      select: { leadId: true },
    });
    return new Set(rows.map((r) => r.leadId));
  } catch (e) {
    console.error("[war-room firedLeadIds] error:", e);
    return new Set();
  }
}

/**
 * Insert the per-tier ledger row, guarded by @@unique([leadId, tier]).
 * Returns true if this call created the row (i.e. we are the one that should
 * notify), false if the tier had already fired (P2002) — the one-shot guard.
 */
async function claimTier(
  leadId: string,
  tier: SlaEscalationTier,
  breachMinutes: number,
  notifiedRepId: string | null,
  notifiedManagerId: string | null
): Promise<boolean> {
  try {
    await prisma.leadSlaEscalation.create({
      data: {
        leadId,
        tier,
        breachMinutes,
        notifiedRepId,
        notifiedManagerId,
      },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Tier already fired for this lead (another cron pass / race). One-shot.
      return false;
    }
    console.error("[war-room claimTier] error:", e);
    return false;
  }
}

// ------------------------------------------------------------
// Engine
// ------------------------------------------------------------

/**
 * Cron-driven tiered escalation sweep. Best-effort, never throws.
 * Returns per-tier counts so the cron route can surface them.
 */
export async function runSlaWarRoomEscalation(): Promise<SlaWarRoomEscalationResult> {
  const now = new Date();
  const result: SlaWarRoomEscalationResult = {
    warned: 0,
    managerEscalated: 0,
    adminEscalated: 0,
  };

  // Resolve manager + admin recipient sets once per run. Managers = SALES_HEAD;
  // admins = SUPER_ADMIN/ADMIN. If no SALES_HEAD exists, manager tier falls
  // back to admins. De-dupe so a user holding multiple roles isn't pinged
  // twice.
  let managerIds: string[] = [];
  let adminIds: string[] = [];
  try {
    const [managers, admins] = await Promise.all([
      prisma.user.findMany({
        where: { role: "SALES_HEAD", isActive: true },
        select: { id: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
        select: { id: true },
      }),
    ]);
    adminIds = admins.map((a) => a.id);
    managerIds = managers.map((m) => m.id);
    if (managerIds.length === 0) managerIds = adminIds; // fallback
  } catch (e) {
    console.error("[runSlaWarRoomEscalation] recipient resolve error:", e);
  }

  // ----------------------------------------------------------
  // Tier 1 — WARN_REP: within the warn window, BEFORE due, still unanswered.
  // Window: (firstContactDue - SLA_WARN_MINUTES) <= now < firstContactDue.
  // ----------------------------------------------------------
  try {
    const warnFloor = new Date(now.getTime() + SLA_WARN_MINUTES * 60_000);
    const alreadyWarned = await firedLeadIds("WARN_REP");
    const dueSoon = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
        firstRespondedAt: null,
        firstContactDue: { not: null, gt: now, lte: warnFloor },
        ...(alreadyWarned.size > 0
          ? { id: { notIn: Array.from(alreadyWarned) } }
          : {}),
      },
      select: LEAD_SELECT,
      take: BATCH,
    });

    for (const lead of dueSoon) {
      if (!lead.assignedToId) continue; // no rep to warn
      const claimed = await claimTier(
        lead.id,
        "WARN_REP",
        0,
        lead.assignedToId,
        null
      );
      if (!claimed) continue;
      await notifyAwait({
        userId: lead.assignedToId,
        type: "SLA_WARNING",
        title: "⚠️ SLA about to breach",
        message: `First-response clock is almost up for ${contactLabel(lead)}. Reply now to stay within SLA.`,
        actionUrl: `/leads/${lead.id}`,
      });
      result.warned++;
    }
  } catch (e) {
    console.error("[runSlaWarRoomEscalation] WARN_REP error:", e);
  }

  // ----------------------------------------------------------
  // Tier 2 — ESCALATE_MANAGER: past due (breached) but not yet deep-breached,
  // still unanswered, manager tier not yet fired.
  // ----------------------------------------------------------
  try {
    const deepFloor = new Date(now.getTime() - SLA_DEEP_BREACH_MINUTES * 60_000);
    const alreadyEscalated = await firedLeadIds("ESCALATE_MANAGER");
    const breached = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
        firstRespondedAt: null,
        // Breached: due in the past, but more recent than the deep-breach floor.
        firstContactDue: { not: null, lt: now, gte: deepFloor },
        ...(alreadyEscalated.size > 0
          ? { id: { notIn: Array.from(alreadyEscalated) } }
          : {}),
      },
      select: LEAD_SELECT,
      take: BATCH,
    });

    for (const lead of breached) {
      const claimed = await claimTier(
        lead.id,
        "ESCALATE_MANAGER",
        minutesPastDue(lead.firstContactDue, now),
        lead.assignedToId,
        managerIds[0] ?? null
      );
      if (!claimed) continue;
      const who = contactLabel(lead);
      await Promise.allSettled(
        managerIds.map((userId) =>
          notifyAwait({
            userId,
            type: "SLA_WARNING",
            title: "🚨 Lead SLA breached — needs a manager",
            message: `${who} has gone past first-contact SLA with no response. Step in or reassign.`,
            actionUrl: `/leads/${lead.id}`,
          })
        )
      );
      result.managerEscalated++;
    }
  } catch (e) {
    console.error("[runSlaWarRoomEscalation] ESCALATE_MANAGER error:", e);
  }

  // ----------------------------------------------------------
  // Tier 3 — ESCALATE_ADMIN: deep breach (well past due), still unanswered,
  // admin tier not yet fired.
  // ----------------------------------------------------------
  try {
    const deepCutoff = new Date(now.getTime() - SLA_DEEP_BREACH_MINUTES * 60_000);
    const alreadyAdminEscalated = await firedLeadIds("ESCALATE_ADMIN");
    const deepBreached = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
        firstRespondedAt: null,
        firstContactDue: { not: null, lt: deepCutoff },
        ...(alreadyAdminEscalated.size > 0
          ? { id: { notIn: Array.from(alreadyAdminEscalated) } }
          : {}),
      },
      select: LEAD_SELECT,
      take: BATCH,
    });

    for (const lead of deepBreached) {
      const claimed = await claimTier(
        lead.id,
        "ESCALATE_ADMIN",
        minutesPastDue(lead.firstContactDue, now),
        lead.assignedToId,
        null
      );
      if (!claimed) continue;
      const who = contactLabel(lead);
      await Promise.allSettled(
        adminIds.map((userId) =>
          notifyAwait({
            userId,
            type: "SLA_WARNING",
            title: "🔥 Lead SLA deep breach",
            message: `${who} is ${minutesPastDue(lead.firstContactDue, now)}m past SLA and still unanswered. Immediate attention required.`,
            actionUrl: `/leads/${lead.id}`,
          })
        )
      );
      result.adminEscalated++;
    }
  } catch (e) {
    console.error("[runSlaWarRoomEscalation] ESCALATE_ADMIN error:", e);
  }

  return result;
}

// ------------------------------------------------------------
// Resolution — close out open escalations when a rep responds
// ------------------------------------------------------------

/**
 * Mark all open LeadSlaEscalation rows for a lead as resolved (resolvedAt=now).
 * Called when a rep responds / the lead progresses, so the war-room shows the
 * lead dropping off and reporting stays accurate. Best-effort; swallows errors.
 */
export async function resolveOpenEscalations(leadId: string): Promise<void> {
  try {
    await prisma.leadSlaEscalation.updateMany({
      where: { leadId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  } catch (e) {
    console.error("[resolveOpenEscalations] error:", e);
  }
}

/**
 * Contact-level resolution: stampLeadResponded marks firstRespondedAt for ALL
 * of a contact's open leads, so escalation resolution must follow the same
 * contact-level semantics. Resolves open escalations for every open lead of
 * the contact. Best-effort; swallows errors.
 */
export async function resolveOpenEscalationsForContact(
  contactId: string
): Promise<void> {
  try {
    const leads = await prisma.lead.findMany({
      where: { contactId, deletedAt: null },
      select: { id: true },
    });
    if (leads.length === 0) return;
    await prisma.leadSlaEscalation.updateMany({
      where: { leadId: { in: leads.map((l) => l.id) }, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  } catch (e) {
    console.error("[resolveOpenEscalationsForContact] error:", e);
  }
}
