import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { canonicalPhone } from "@/lib/phone";
import { sendLeadAssignedEmail } from "@/lib/crm/lead-assigned-email";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";

// ============================================================
// "A lead has been assigned to you" — on every channel, at once.
//
// When an admin, sales head or super admin allocates leads (one lead from its
// page, many from the list's bulk assign, or picking an owner while creating),
// and when the CRM routes a new lead automatically, the person who now owns it
// hears about it immediately on all three channels:
//   1. In the CRM app: a bell notification. notify() also mirrors it as a
//      browser push to every device the person enabled alerts on.
//   2. Email: the full lead card (lead-assigned-email), or one digest email
//      for a bulk assignment.
//   3. WhatsApp to the phone on their CRM user profile. WhatsApp only lets a
//      business start a chat with an APPROVED template, so this needs the
//      template named in LEAD_ASSIGNED_WHATSAPP_TEMPLATE. It is skipped,
//      with a log line, until that exists.
//
// A bulk assignment sends ONE notification per channel ("12 leads assigned to
// you"), not one per lead, so a rep is not buried under a burst of
// messages. Assigning a lead to yourself sends nothing.
//
// Best-effort by design: assignment itself never fails because a channel did.
// Each channel is independent, so a dead mail server does not stop the WhatsApp.
// ============================================================

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.theveloriagrand.com";
  return `${base}${path}`;
}

/**
 * The person's own Settings → Notifications "Lead assigned · Email" switch.
 * Same rule as notification-settings.actions (on unless they saved it off),
 * read here directly so this library does not pull in the auth stack.
 */
export function leadAssignedEmailEnabled(prefs: unknown): boolean {
  if (!Array.isArray(prefs)) return true;
  const row = prefs.find(
    (p): p is { key: string; emailEnabled?: unknown } =>
      !!p && typeof p === "object" && (p as { key?: unknown }).key === "lead_assigned"
  );
  return row ? Boolean(row.emailEnabled) : true;
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const IST_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * WhatsApp rejects template parameters containing newlines, tabs or 4+
 * consecutive spaces, and caps their length. Flatten anything customer-typed.
 */
export function waParam(v: string, max = 180): string {
  const flat = v.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  const chars = Array.from(flat);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : flat || "-";
}

interface LeadCard {
  id: string;
  title: string;
  source: string;
  eventType: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  name: string;
  phone: string | null;
}

/** "Priya Sharma · +91 98… · Wedding on 14 Feb 2027 · 250 guests" */
export function leadSummary(l: LeadCard): string {
  const parts = [l.name || l.title];
  if (l.phone) parts.push(l.phone);
  if (l.eventType && l.eventDate) parts.push(`${l.eventType} on ${IST_DATE.format(l.eventDate)}`);
  else if (l.eventType) parts.push(l.eventType);
  else if (l.eventDate) parts.push(`event on ${IST_DATE.format(l.eventDate)}`);
  if (l.guestCount) parts.push(`${l.guestCount} guests`);
  return parts.join(" · ");
}

export interface LeadAssignedNotifyArgs {
  leadIds: string[];
  assigneeId: string;
  /** The person who allocated; null/undefined = the CRM's automatic routing. */
  assignedById?: string | null;
  /**
   * Channels to use (default: all). The CRM's catch-all owner (the system
   * admin a lead falls back to when no rule matches) gets the in-app notice
   * only: nobody chose them, they own most inbound leads, and they already
   * receive the new-lead group email — an email + paid WhatsApp template for
   * every lead would be pure noise and cost.
   */
  channels?: { email?: boolean; whatsapp?: boolean };
}

export interface LeadAssignedNotifyResult {
  skipped?: string;
  inApp?: boolean;
  email?: { sent: boolean; reason?: string };
  whatsapp?: { sent: boolean; reason?: string };
}

/**
 * Tell the new owner about one or more leads just assigned to them, on every
 * channel. Never throws.
 */
export async function notifyLeadsAssigned(
  args: LeadAssignedNotifyArgs
): Promise<LeadAssignedNotifyResult> {
  try {
    const leadIds = Array.from(new Set(args.leadIds.filter(Boolean)));
    if (leadIds.length === 0) return { skipped: "No leads" };
    if (args.assignedById && args.assignedById === args.assigneeId) {
      return { skipped: "Assigned to self" };
    }

    const [assignee, assigner, leadRows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: args.assigneeId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          role: true,
          notificationPreferences: true,
        },
      }),
      args.assignedById
        ? prisma.user.findUnique({ where: { id: args.assignedById }, select: { name: true } })
        : Promise.resolve(null),
      prisma.lead.findMany({
        where: { id: { in: leadIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          source: true,
          eventType: true,
          eventDate: true,
          guestCount: true,
          contact: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
    ]);

    if (!assignee) return { skipped: "Assignee not found" };
    if (assignee.isActive === false) return { skipped: "Assignee is deactivated" };
    if (assignee.role === "VENUE_OWNER") return { skipped: "Venue owners get no lead notifications" };
    if (leadRows.length === 0) return { skipped: "Leads not found" };

    const leads: LeadCard[] = leadRows.map((l) => ({
      id: l.id,
      title: l.title,
      source: String(l.source),
      eventType: l.eventType,
      eventDate: l.eventDate,
      guestCount: l.guestCount,
      name: `${l.contact?.firstName ?? ""} ${l.contact?.lastName ?? ""}`.trim(),
      phone: l.contact?.phone ?? null,
    }));

    const single = leads.length === 1 ? leads[0] : null;
    const byName = assigner?.name?.trim() || null;
    const byText = byName ?? "the CRM (automatic)";
    const link = single ? appUrl(`/leads/${single.id}`) : appUrl("/leads");

    // Run the three channels independently: one failing never stops another.
    const [inApp, email, whatsapp] = await Promise.all([
      // ---- 1. In the app (bell + browser push) ----------------------------
      notifyAwait({
        userId: assignee.id,
        type: "LEAD_ASSIGNED",
        title: single
          ? `Lead assigned to you: ${single.name || single.title}`
          : `${leads.length} leads assigned to you`,
        message: single
          ? `${leadSummary(single)} — assigned by ${byText}.`
          : `Assigned by ${byText}: ${leads
              .slice(0, 5)
              .map((l) => l.name || l.title)
              .join(", ")}${leads.length > 5 ? ` and ${leads.length - 5} more` : ""}.`,
        actionUrl: single ? `/leads/${single.id}` : "/leads",
        metadata: { leadIds: leads.map((l) => l.id), assignedById: args.assignedById ?? null },
      })
        .then(() => true)
        .catch(() => false),

      // ---- 2. Email ------------------------------------------------------
      (async () => {
        if (args.channels?.email === false) return { sent: false, reason: "Email not requested" };
        if (!assignee.email) return { sent: false, reason: "No email on the user profile" };
        // Respect the person's own Settings → Notifications choice (fails open).
        if (!leadAssignedEmailEnabled(assignee.notificationPreferences)) {
          return { sent: false, reason: "Turned off in notification settings" };
        }
        if (single) return sendLeadAssignedEmail(single.id, assignee.id, { assignedByName: byName });
        const res = await sendEmail({
          to: assignee.email,
          subject: `${leads.length} leads assigned to you${byName ? ` by ${byName}` : ""}`,
          html: buildBulkEmail(assignee.name ?? "", leads, byText),
        });
        return res.success ? { sent: true } : { sent: false, reason: res.error || "Email failed" };
      })().catch((e) => ({ sent: false, reason: e instanceof Error ? e.message : "unknown" })),

      // ---- 3. WhatsApp ---------------------------------------------------
      (async () => {
        if (args.channels?.whatsapp === false) return { sent: false, reason: "WhatsApp not requested" };
        const template = process.env.LEAD_ASSIGNED_WHATSAPP_TEMPLATE?.trim();
        if (!template) return { sent: false, reason: "No WhatsApp template configured" };
        if (!assignee.phone?.trim()) return { sent: false, reason: "No phone on the user profile" };
        const details = single
          ? leadSummary(single)
          : leads
              .slice(0, 3)
              .map((l) => leadSummary(l))
              .join(" | ") + (leads.length > 3 ? ` and ${leads.length - 3} more` : "");
        const res = await sendWhatsApp({
          to: canonicalPhone(assignee.phone),
          template,
          language: process.env.LEAD_ASSIGNED_WHATSAPP_LANG?.trim() || "en",
          // Positional {{1}}..{{5}}; insertion order is the template's order.
          params: {
            "1": waParam((assignee.name ?? "").split(/\s+/)[0] || "there", 40),
            "2": waParam(single ? "a new lead" : `${leads.length} new leads`, 40),
            "3": waParam(byText, 60),
            "4": waParam(details, 400),
            "5": link,
          },
        });
        return res.success ? { sent: true } : { sent: false, reason: res.error || "WhatsApp failed" };
      })().catch((e) => ({ sent: false, reason: e instanceof Error ? e.message : "unknown" })),
    ]);

    const result = { inApp, email, whatsapp };
    console.log("[LEAD_ASSIGNED_NOTIFY]", {
      assigneeId: assignee.id,
      leads: leads.length,
      inApp,
      email: email.sent ? "sent" : email.reason,
      whatsapp: whatsapp.sent ? "sent" : whatsapp.reason,
    });
    return result;
  } catch (e) {
    console.error("[LEAD_ASSIGNED_NOTIFY] failed", e);
    return { skipped: e instanceof Error ? e.message : "unknown" };
  }
}

function buildBulkEmail(assigneeName: string, leads: LeadCard[], byText: string): string {
  const shown = leads.slice(0, 25);
  const rows = shown
    .map(
      (l) => `<tr>
        <td style="padding:8px 12px 8px 0;border-bottom:1px solid #eee;font-weight:600">
          <a href="${esc(appUrl(`/leads/${l.id}`))}" style="color:#006742;text-decoration:none">${esc(l.name || l.title)}</a>
        </td>
        <td style="padding:8px 12px 8px 0;border-bottom:1px solid #eee">${esc(l.phone || "—")}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;color:#555">${esc(
          [l.eventType, l.eventDate ? IST_DATE.format(l.eventDate) : null, LEAD_SOURCE_LABELS[l.source] ?? l.source]
            .filter(Boolean)
            .join(" · ")
        )}</td>
      </tr>`
    )
    .join("");
  const more =
    leads.length > shown.length
      ? `<p style="margin:12px 0 0;color:#555;font-size:14px">…and ${leads.length - shown.length} more in the CRM.</p>`
      : "";
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:620px;color:#111">
      <h2 style="margin:0 0 4px;font-size:18px">${esc(String(leads.length))} leads assigned to you</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px">Hi ${esc(assigneeName.split(/\s+/)[0] || "there")}, these were assigned to you by ${esc(byText)}.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">${rows}</table>
      ${more}
      <p style="margin:20px 0 0">
        <a href="${esc(appUrl("/leads"))}"
           style="display:inline-block;background:#006742;color:#fff;text-decoration:none;
                  padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600">
          Open my leads
        </a>
      </p>
    </div>`;
}

/**
 * Fire-and-forget wrapper for request paths (a staff member clicking Assign
 * should not wait on a mail server). Production is a long-lived Node process
 * (pm2), so the detached promise completes.
 */
export function scheduleLeadsAssignedNotify(args: LeadAssignedNotifyArgs): void {
  void notifyLeadsAssigned(args).catch((e) => console.error("[LEAD_ASSIGNED_NOTIFY] failed", e));
}
