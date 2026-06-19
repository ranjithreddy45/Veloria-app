// ============================================================
// Speed-to-Lead — instant automated first-response engine.
//
// On every new lead (driven from the single funnel runLeadIntake in
// lead-pipeline.ts), this:
//   1. round-robin assigns the lead to a sales rep if still unassigned
//      (reuses the existing AssignmentRule ROUND_ROBIN logic),
//   2. fires an instant WhatsApp first-response via the shared sendWhatsApp
//      engine and mirrors it to the unified WhatsAppMessage inbox,
//   3. records a 1:1 LeadFirstResponse audit row with latencyMs so the
//      sub-60-second speed-to-lead metric is measurable.
//
// Plain library (NOT "use server"): callable from runLeadIntake, server
// actions, and cron handlers alike. Fully self-contained, idempotent
// (LeadFirstResponse.leadId is @unique + an explicit guard), and it NEVER
// throws — speed-to-lead is best-effort and must not break lead creation.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";

// Window in which a pre-existing OUTBOUND WhatsApp (e.g. an AutoWelcomeConfig
// message already sent by captureLeadFromExternal) counts as the first
// response — so we don't double-message the same contact.
const RECENT_OUTBOUND_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface SpeedToLeadLead {
  id: string;
  contactId: string;
  title?: string | null;
  assignedToId?: string | null;
  source?: string | null;
  eventType?: string | null;
  status?: string | null;
  guestCount?: number | null;
  score?: number | null;
  estimatedValue?: number | string | null;
}

interface RunSpeedToLeadArgs {
  lead: SpeedToLeadLead;
  /** Current assignee if the caller already knows it (skips re-assign). */
  assignedToId?: string | null;
}

interface RunSpeedToLeadResult {
  ok: boolean;
  status: "SENT" | "FAILED" | "SKIPPED" | "ALREADY";
  reason?: string;
}

/** First active SUPER_ADMIN/ADMIN — system actor / fallback notify target. */
async function getSystemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });
  return admin?.id || "";
}

/** Build the instant first-response text. Greeting + reassurance, no internals. */
function buildFirstResponseText(firstName: string | null | undefined): string {
  const name = (firstName || "").trim();
  const hello = name ? `Hi ${name}` : "Hello";
  return (
    `${hello}, thanks for reaching out to Veloria Grand! 🎉 ` +
    `We've received your enquiry and one of our event consultants will reach you shortly. ` +
    `For anything urgent, just reply to this message and we'll help right away.`
  );
}

/**
 * Run speed-to-lead for one freshly created lead. Self-contained, idempotent,
 * never throws. Returns a small result for diagnostics / retry actions.
 */
export async function runSpeedToLead(
  args: RunSpeedToLeadArgs
): Promise<RunSpeedToLeadResult> {
  const startedAt = Date.now();
  const { lead } = args;

  try {
    // ---- Idempotency guard: one first-response per lead, ever. -----------
    const existing = await prisma.leadFirstResponse.findUnique({
      where: { leadId: lead.id },
      select: { id: true },
    });
    if (existing) {
      return { ok: true, status: "ALREADY" };
    }

    // ---- (1) Round-robin auto-assign if still unassigned. ----------------
    let assignedToId = args.assignedToId ?? lead.assignedToId ?? null;
    let assignedViaRuleId: string | null = null;

    if (!assignedToId) {
      const candidate = await evaluateAssignmentRules({
        source: lead.source ?? "",
        eventType: lead.eventType ?? "",
        status: lead.status ?? "",
        guestCount: lead.guestCount ?? 0,
        score: lead.score ?? 0,
        estimatedValue:
          lead.estimatedValue != null ? Number(lead.estimatedValue) : 0,
      });
      if (candidate) {
        assignedToId = candidate;
        // Capture which active LEAD rule produced the assignment (audit only).
        try {
          const rule = await prisma.assignmentRule.findFirst({
            where: {
              entityType: "LEAD",
              isActive: true,
              OR: [
                { assignToUserId: candidate },
                { assignToTeam: { has: candidate } },
              ],
            },
            orderBy: { priority: "asc" },
            select: { id: true },
          });
          assignedViaRuleId = rule?.id ?? null;
        } catch {
          assignedViaRuleId = null;
        }
        // Persist the assignment on the lead.
        try {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { assignedToId },
          });
        } catch (e) {
          console.error("[runSpeedToLead] assign persist failed:", e);
        }
      }
    }

    // ---- (2) Load contact phone / name. ----------------------------------
    const contact = await prisma.contact.findUnique({
      where: { id: lead.contactId },
      select: { firstName: true, phone: true },
    });
    const phone = contact?.phone?.trim() || "";

    if (!phone) {
      await prisma.leadFirstResponse.create({
        data: {
          leadId: lead.id,
          status: "SKIPPED",
          channel: "WHATSAPP",
          failReason: "No phone number on contact — needs manual follow-up.",
          latencyMs: Date.now() - startedAt,
          assignedToId,
          assignedViaRuleId,
        },
      });
      return { ok: true, status: "SKIPPED", reason: "no_phone" };
    }

    // ---- Anti-double-send: was an OUTBOUND WhatsApp just sent? ------------
    // captureLeadFromExternal may already have fired an AutoWelcomeConfig
    // welcome. If so, record THAT as the first-response and skip a re-send.
    const recentOutbound = await prisma.whatsAppMessage.findFirst({
      where: {
        contactId: lead.contactId,
        direction: "OUTBOUND",
        sentAt: { gte: new Date(Date.now() - RECENT_OUTBOUND_WINDOW_MS) },
      },
      orderBy: { sentAt: "desc" },
      select: { id: true, whatsappId: true, status: true, sentAt: true },
    });

    if (recentOutbound) {
      await prisma.leadFirstResponse.create({
        data: {
          leadId: lead.id,
          status: recentOutbound.status === "FAILED" ? "FAILED" : "SENT",
          channel: "WHATSAPP",
          templateName: null,
          sentAt: recentOutbound.sentAt,
          latencyMs: Date.now() - startedAt,
          whatsappMessageId: recentOutbound.whatsappId ?? null,
          assignedToId,
          assignedViaRuleId,
          failReason:
            recentOutbound.status === "FAILED"
              ? "Existing welcome WhatsApp had failed."
              : null,
        },
      });
      return { ok: true, status: "SENT", reason: "reused_existing_welcome" };
    }

    // ---- (3) Send the instant WhatsApp first-response. -------------------
    const text = buildFirstResponseText(contact?.firstName);
    const result = await sendWhatsApp({ to: phone, message: text });
    const latencyMs = Date.now() - startedAt;

    // ---- (4) Mirror to the unified WhatsAppMessage inbox. ----------------
    try {
      await prisma.whatsAppMessage.create({
        data: {
          direction: "OUTBOUND",
          content: text,
          status: result.success ? "SENT" : "FAILED",
          whatsappId: result.messageId || null,
          contactId: lead.contactId,
        },
      });
    } catch {
      // Inbox logging must never block the first-response flow.
    }

    // ---- (5) Record the LeadFirstResponse audit row. ---------------------
    await prisma.leadFirstResponse.create({
      data: {
        leadId: lead.id,
        status: result.success ? "SENT" : "FAILED",
        channel: "WHATSAPP",
        templateName: null,
        sentAt: result.success ? new Date() : null,
        latencyMs,
        whatsappMessageId: result.messageId || null,
        failReason: result.success ? null : result.error?.slice(0, 500) ?? "Send failed",
        assignedToId,
        assignedViaRuleId,
      },
    });

    if (!result.success) {
      // Surface a failed automated first-response so a human can step in.
      const who = (contact?.firstName || lead.title || "a new lead").trim();
      const target = assignedToId || (await getSystemUserId());
      if (target) {
        notify({
          userId: target,
          title: "⚡ Auto first-response failed",
          message: `Couldn't auto-message ${who}. Reach out manually now.`,
          type: "SLA_WARNING",
          actionUrl: `/leads/${lead.id}`,
        });
      }
      return { ok: false, status: "FAILED", reason: result.error };
    }

    return { ok: true, status: "SENT" };
  } catch (e) {
    console.error("[runSpeedToLead] error:", e);
    // Best-effort: try to record a FAILED row so the cockpit shows it.
    try {
      const exists = await prisma.leadFirstResponse.findUnique({
        where: { leadId: lead.id },
        select: { id: true },
      });
      if (!exists) {
        await prisma.leadFirstResponse.create({
          data: {
            leadId: lead.id,
            status: "FAILED",
            channel: "WHATSAPP",
            failReason: e instanceof Error ? e.message.slice(0, 500) : "Unknown error",
            latencyMs: Date.now() - startedAt,
          },
        });
      }
    } catch {
      // give up quietly
    }
    return { ok: false, status: "FAILED", reason: "exception" };
  }
}
