import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { canonicalPhone } from "@/lib/phone";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import { areaLabel } from "@/lib/crm/areas";
import { waParam } from "@/lib/crm/lead-assigned-notify";
import { reportSystemFailure } from "@/lib/ops-alert";

// ============================================================
// "A new lead just came in" on the managers' WhatsApp.
//
// The owner (25 Nov 2026): website and Google leads should reach the managers
// on WhatsApp as well as by the new-lead email. It goes out once per lead,
// together with that email (enqueueNewLeadAlert decides "once").
//
// A business can only start a WhatsApp chat with an approved template, so this
// is inert until the new-lead email list (NEW_LEAD_ALERT_EMAILS) is on and:
//   NEW_LEAD_ALERT_WHATSAPP_TO        who: staff emails (their profile phone is
//                                     used) and/or phone numbers, comma-separated
//   NEW_LEAD_ALERT_WHATSAPP_TEMPLATE  the approved template / AiSensy campaign
//   NEW_LEAD_ALERT_WHATSAPP_LANG      optional, default "en"
//   NEW_LEAD_ALERT_WHATSAPP_SOURCES   optional, default "WEBSITE,GOOGLE_ADS"
//
// Delivery is tracked per manager in a CronLaneLease row ("wa-lead:<lead>:<n>",
// insert-if-absent), so each manager gets one message per lead even across
// the 4 workers. A send that fails is retried once by the 5-minute fast lane
// (retryDueNewLeadWhatsApps), which also finishes any send a restart cut
// short; a second failure raises a "Lead alerts" admin alert, so a miss is
// never silent. A send that timed out may have gone through, so it is never
// repeated (a duplicate is worse than the email-only alert).
//
// Template body, five positional values in this order:
//   New {{1}} lead for Veloria Grand.
//
//   Name: {{2}}
//   Event: {{3}}
//   Phone: {{4}}
//
//   Open in the CRM: {{5}}
//
//   Please make sure the lead is called soon.
//
// Submitted in AiSensy on 25 Nov 2026 as "new_lead_manager" (Utility, English).
// ============================================================

export const DEFAULT_WHATSAPP_SOURCES = ["WEBSITE", "GOOGLE_ADS"];

/** Which lead sources go to WhatsApp (upper-case LeadSource values). */
export function whatsappAlertSources(raw: string | undefined | null): Set<string> {
  const list = (raw ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return new Set(list.length ? list : DEFAULT_WHATSAPP_SOURCES);
}

/** Split the recipient list into staff emails and raw phone numbers. */
export function parseWhatsAppRecipients(raw: string | undefined | null): { emails: string[]; phones: string[] } {
  const emails = new Set<string>();
  const phones = new Set<string>();
  // Commas or semicolons only: a phone number may be written with spaces.
  for (const part of (raw ?? "").split(/[,;\n]+/)) {
    const v = part.trim();
    if (!v) continue;
    if (v.includes("@")) emails.add(v.toLowerCase());
    else if (v.replace(/\D/g, "").length >= 10) phones.add(v);
  }
  return { emails: [...emails], phones: [...phones] };
}

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.theveloriagrand.com";
  return `${base}${path}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** The five template values, in template order. */
export function newLeadWhatsAppParams(d: {
  leadId: string;
  source: string;
  name: string;
  title: string;
  phone: string | null;
  eventType: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  area?: string | null;
}): Record<string, string> {
  // The approved template has no Area line, so the area rides in the Event line.
  const event = [
    d.eventType,
    d.eventDate ? fmtDate(d.eventDate) : null,
    d.guestCount ? `${d.guestCount} guests` : null,
    areaLabel(d.area),
  ]
    .filter(Boolean)
    .join(", ");
  return {
    "1": waParam(LEAD_SOURCE_LABELS[d.source] ?? d.source, 40),
    "2": waParam(d.name || d.title, 80),
    "3": waParam(event || "Not given", 120),
    "4": waParam(d.phone || "Not given", 30),
    "5": appUrl(`/leads/${d.leadId}`),
  };
}

export interface NewLeadWhatsAppResult {
  sent: number;
  failed: number;
  skipped?: string;
}

const MARKER_PREFIX = "wa-lead:";
const CLAIM_MS = 2 * 60 * 1000;
const RETRY_AFTER_MS = 60 * 1000;
const MAX_ATTEMPTS = 2;

function markerLane(leadId: string, to: string): string {
  return `${MARKER_PREFIX}${leadId}:${to}`;
}

function parseMarker(lane: string): { leadId: string; to: string } | null {
  if (!lane.startsWith(MARKER_PREFIX)) return null;
  const rest = lane.slice(MARKER_PREFIX.length);
  const i = rest.indexOf(":");
  return i > 0 ? { leadId: rest.slice(0, i), to: rest.slice(i + 1) } : null;
}

/** "PENDING:<attempts>" | "SENT" | "UNKNOWN" | "FAILED" */
function attemptsOf(holder: string | null): number {
  const m = /^PENDING:(\d+)$/.exec(holder ?? "");
  return m ? Number(m[1]) : 0;
}

function isAmbiguous(error: string | undefined): boolean {
  return /timed out|timeout/i.test(error ?? "");
}

type LeadForAlert = {
  id: string;
  title: string;
  source: unknown;
  eventType: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  area: string | null;
  deletedAt: Date | null;
  contact: { firstName: string | null; lastName: string | null; phone: string | null } | null;
};

async function loadLead(leadId: string): Promise<LeadForAlert | null> {
  return prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      title: true,
      source: true,
      eventType: true,
      eventDate: true,
      guestCount: true,
      area: true,
      deletedAt: true,
      contact: { select: { firstName: true, lastName: true, phone: true } },
    },
  });
}

function paramsFor(lead: LeadForAlert): Record<string, string> {
  return newLeadWhatsAppParams({
    leadId: lead.id,
    source: String(lead.source),
    name: `${lead.contact?.firstName ?? ""} ${lead.contact?.lastName ?? ""}`.trim(),
    title: lead.title,
    phone: lead.contact?.phone ?? null,
    eventType: lead.eventType,
    eventDate: lead.eventDate,
    guestCount: lead.guestCount,
    area: lead.area,
  });
}

/**
 * One send to one manager whose marker this caller holds; records the
 * outcome on the marker. Returns "sent" | "retry" | "failed" | "unknown".
 */
async function attemptOne(
  lane: string,
  to: string,
  lead: LeadForAlert,
  template: string,
  attempt: number
): Promise<"sent" | "retry" | "failed" | "unknown"> {
  const language = process.env.NEW_LEAD_ALERT_WHATSAPP_LANG?.trim() || "en";
  let error: string | undefined;
  try {
    const res = await sendWhatsApp({ to, template, language, params: paramsFor(lead) });
    if (res.success) {
      await prisma.cronLaneLease.update({ where: { lane }, data: { holder: "SENT" } });
      return "sent";
    }
    error = res.error;
  } catch (e) {
    error = e instanceof Error ? e.message : "unknown";
  }
  console.error("[NEW_LEAD_WHATSAPP] send failed", { leadId: lead.id, attempt, error });
  if (isAmbiguous(error)) {
    await prisma.cronLaneLease.update({ where: { lane }, data: { holder: "UNKNOWN" } });
    return "unknown";
  }
  if (attempt < MAX_ATTEMPTS) {
    await prisma.cronLaneLease.update({
      where: { lane },
      data: { holder: `PENDING:${attempt}`, leaseUntil: new Date(Date.now() + RETRY_AFTER_MS) },
    });
    return "retry";
  }
  await prisma.cronLaneLease.update({ where: { lane }, data: { holder: "FAILED" } });
  await reportSystemFailure({
    area: "Lead alerts",
    title: "New-lead WhatsApp to a manager failed",
    detail: `The WhatsApp alert for a new ${LEAD_SOURCE_LABELS[String(lead.source)] ?? String(lead.source)} lead failed twice. The email alert is unaffected. Check Settings → Integrations → WhatsApp and the template name.`,
    actionUrl: `/leads/${lead.id}`,
  });
  return "failed";
}

/** Send the alert for one lead to every configured manager. Never throws. */
export async function sendNewLeadWhatsApp(leadId: string): Promise<NewLeadWhatsAppResult> {
  try {
    const template = process.env.NEW_LEAD_ALERT_WHATSAPP_TEMPLATE?.trim();
    if (!template) return { sent: 0, failed: 0, skipped: "No template configured" };
    const { emails, phones } = parseWhatsAppRecipients(process.env.NEW_LEAD_ALERT_WHATSAPP_TO);
    if (emails.length === 0 && phones.length === 0) return { sent: 0, failed: 0, skipped: "No recipients configured" };

    const lead = await loadLead(leadId);
    if (!lead || lead.deletedAt) return { sent: 0, failed: 0, skipped: "Lead not found" };
    if (!whatsappAlertSources(process.env.NEW_LEAD_ALERT_WHATSAPP_SOURCES).has(String(lead.source))) {
      return { sent: 0, failed: 0, skipped: "Source not alerted on WhatsApp" };
    }

    // Staff are named by email so a changed phone on their profile follows;
    // deactivated staff are dropped.
    const staff = emails.length
      ? await prisma.user.findMany({
          where: { isActive: true, OR: emails.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
          select: { phone: true },
        })
      : [];
    const numbers = Array.from(
      new Set(
        [...staff.map((u) => u.phone?.trim() || ""), ...phones]
          .filter(Boolean)
          .map((p) => canonicalPhone(p))
      )
    );
    if (numbers.length === 0) return { sent: 0, failed: 0, skipped: "No recipient has a phone number" };

    let sent = 0;
    let failed = 0;
    for (const to of numbers) {
      const lane = markerLane(lead.id, to);
      const { count } = await prisma.cronLaneLease.createMany({
        data: [{ lane, leaseUntil: new Date(Date.now() + CLAIM_MS), holder: "PENDING:0" }],
        skipDuplicates: true,
      });
      if (count !== 1) continue; // this manager already has (or is getting) it
      const out = await attemptOne(lane, to, lead, template, 1);
      if (out === "sent") sent++;
      else if (out !== "unknown") failed++;
    }
    console.log("[NEW_LEAD_WHATSAPP]", { leadId, sent, failed });
    return { sent, failed };
  } catch (e) {
    console.error("[NEW_LEAD_WHATSAPP] failed", { leadId, e });
    return { sent: 0, failed: 0, skipped: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Fast-lane sweep: retry a failed manager WhatsApp once, and finish any send a
 * restart cut short (its claim expired while still PENDING). Never throws.
 */
export async function retryDueNewLeadWhatsApps(
  now: Date = new Date()
): Promise<{ retried: number; sent: number }> {
  let retried = 0;
  let sent = 0;
  try {
    const template = process.env.NEW_LEAD_ALERT_WHATSAPP_TEMPLATE?.trim();
    if (!template) return { retried, sent };
    const due = await prisma.cronLaneLease.findMany({
      where: {
        lane: { startsWith: MARKER_PREFIX },
        holder: { startsWith: "PENDING:" },
        leaseUntil: { lt: now },
        updatedAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
      },
      take: 20,
      select: { lane: true, holder: true },
    });
    for (const row of due) {
      const m = parseMarker(row.lane);
      if (!m) continue;
      // Claim it (only one sweep wins), then send.
      const claim = await prisma.cronLaneLease.updateMany({
        where: { lane: row.lane, holder: row.holder, leaseUntil: { lt: now } },
        data: { leaseUntil: new Date(now.getTime() + CLAIM_MS) },
      });
      if (claim.count !== 1) continue;
      const lead = await loadLead(m.leadId);
      if (!lead || lead.deletedAt) {
        await prisma.cronLaneLease.update({ where: { lane: row.lane }, data: { holder: "FAILED" } });
        continue;
      }
      retried++;
      const out = await attemptOne(row.lane, m.to, lead, template, attemptsOf(row.holder) + 1);
      if (out === "sent") sent++;
    }
  } catch (e) {
    console.error("[NEW_LEAD_WHATSAPP] retry sweep failed", e);
  }
  return { retried, sent };
}
