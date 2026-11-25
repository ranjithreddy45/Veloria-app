import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { canonicalPhone } from "@/lib/phone";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import { waParam } from "@/lib/crm/lead-assigned-notify";

// ============================================================
// "A new lead just came in" on the managers' WhatsApp.
//
// The owner (25 Nov 2026): website and Google leads should reach the managers
// on WhatsApp as well as by the new-lead email. It goes out once per lead,
// together with that email (enqueueNewLeadAlert decides "once").
//
// A business can only start a WhatsApp chat with an approved template, so this
// is inert until all three are set:
//   NEW_LEAD_ALERT_WHATSAPP_TO        who: staff emails (their profile phone is
//                                     used) and/or phone numbers, comma-separated
//   NEW_LEAD_ALERT_WHATSAPP_TEMPLATE  the approved template / AiSensy campaign
//   NEW_LEAD_ALERT_WHATSAPP_LANG      optional, default "en"
//   NEW_LEAD_ALERT_WHATSAPP_SOURCES   optional, default "WEBSITE,GOOGLE_ADS"
//
// Template body, five positional values in this order:
//   New {{1}} lead for Veloria Grand.
//
//   Name: {{2}}
//   Event: {{3}}
//   Phone: {{4}}
//
//   Open in the CRM: {{5}}
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
}): Record<string, string> {
  const event = [
    d.eventType,
    d.eventDate ? fmtDate(d.eventDate) : null,
    d.guestCount ? `${d.guestCount} guests` : null,
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

/** Send the alert for one lead to every configured manager. Never throws. */
export async function sendNewLeadWhatsApp(leadId: string): Promise<NewLeadWhatsAppResult> {
  try {
    const template = process.env.NEW_LEAD_ALERT_WHATSAPP_TEMPLATE?.trim();
    if (!template) return { sent: 0, failed: 0, skipped: "No template configured" };
    const { emails, phones } = parseWhatsAppRecipients(process.env.NEW_LEAD_ALERT_WHATSAPP_TO);
    if (emails.length === 0 && phones.length === 0) return { sent: 0, failed: 0, skipped: "No recipients configured" };

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        title: true,
        source: true,
        eventType: true,
        eventDate: true,
        guestCount: true,
        deletedAt: true,
        contact: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
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

    const params = newLeadWhatsAppParams({
      leadId: lead.id,
      source: String(lead.source),
      name: `${lead.contact?.firstName ?? ""} ${lead.contact?.lastName ?? ""}`.trim(),
      title: lead.title,
      phone: lead.contact?.phone ?? null,
      eventType: lead.eventType,
      eventDate: lead.eventDate,
      guestCount: lead.guestCount,
    });
    const language = process.env.NEW_LEAD_ALERT_WHATSAPP_LANG?.trim() || "en";

    let sent = 0;
    let failed = 0;
    for (const to of numbers) {
      try {
        const res = await sendWhatsApp({ to, template, language, params });
        if (res.success) sent++;
        else {
          failed++;
          console.error("[NEW_LEAD_WHATSAPP] send failed", { leadId, error: res.error });
        }
      } catch (e) {
        failed++;
        console.error("[NEW_LEAD_WHATSAPP] send threw", { leadId, e });
      }
    }
    console.log("[NEW_LEAD_WHATSAPP]", { leadId, sent, failed });
    return { sent, failed };
  } catch (e) {
    console.error("[NEW_LEAD_WHATSAPP] failed", { leadId, e });
    return { sent: 0, failed: 0, skipped: e instanceof Error ? e.message : "unknown" };
  }
}
