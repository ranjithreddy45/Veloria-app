import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";

// ============================================================
// "A new lead just came in" — one email to a fixed list of people.
//
// The owner wants a named group (sales heads, partners) told about EVERY new
// lead the moment it lands, whatever channel it came from and whoever it is
// assigned to. That is different from the two emails that already exist:
//   - lead-assigned-email  → only the one rep who now owns the lead
//   - lead-welcome-email   → the customer
//
// The list lives in the NEW_LEAD_ALERT_EMAILS environment variable
// (comma-separated). Unset or empty means no alert, so this is inert until
// someone turns it on.
//
// Fired from runLeadIntake (every captured / webform / manually created lead)
// plus the two paths that create leads without it (referral conversion and the
// AI assistant). Bulk imports and historical backfills are deliberately NOT
// alerted: a 500-row sheet import would send 500 emails to every recipient.
//
// It runs detached from the caller (see scheduleNewLeadAlert) so a slow or
// unreachable mail server can never delay a webhook response or a form submit.
// ============================================================

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Parse the recipient list: comma/semicolon/space separated, deduped, validated. */
export function parseAlertRecipients(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const addr = part.trim().toLowerCase();
    if (!addr || !EMAIL_RE.test(addr) || seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.theveloriagrand.com";
  return `${base}${path}`;
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
const IST_DATETIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Lead descriptions carry internal dedupe markers like "[ext:123]" — never show those. */
function cleanNotes(description: string | null | undefined): string {
  if (!description) return "";
  const text = description.replace(/\[ext:[^\]]*\]/g, "").replace(/\s+\n/g, "\n").trim();
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
}

export interface NewLeadAlertData {
  leadId: string;
  title: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  eventType: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  venue: string | null;
  assignedTo: string | null;
  receivedAt: Date;
  notes: string;
}

export function buildNewLeadAlert(d: NewLeadAlertData): { subject: string; html: string } {
  const sourceLabel = LEAD_SOURCE_LABELS[d.source] ?? d.source;
  const who = d.name || d.title;

  const rows: [string, string][] = [
    ["Name", d.name || "—"],
    ["Phone", d.phone || "—"],
    ["Email", d.email || "—"],
    ["Event", d.eventType || "—"],
    ["Event date", d.eventDate ? IST_DATE.format(d.eventDate) : "—"],
    ["Guests", d.guestCount ? String(d.guestCount) : "—"],
    ["Venue", d.venue || "—"],
    ["Source", sourceLabel],
    ["Assigned to", d.assignedTo || "Not assigned yet"],
    ["Received", `${IST_DATETIME.format(d.receivedAt)} IST`],
  ];

  const notes = d.notes
    ? `<p style="margin:16px 0 4px;color:#666;font-size:13px">Message / notes</p>
       <p style="margin:0;padding:10px 12px;background:#f4f6f5;border-radius:6px;font-size:14px;white-space:pre-wrap">${esc(d.notes)}</p>`
    : "";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;color:#111">
      <h2 style="margin:0 0 4px;font-size:18px">New lead: ${esc(who)}</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px">${esc(sourceLabel)}${d.eventType ? ` · ${esc(d.eventType)}` : ""}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr>
                 <td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</td>
                 <td style="padding:6px 0;font-weight:600">${esc(v)}</td>
               </tr>`
          )
          .join("")}
      </table>
      ${notes}
      <p style="margin:20px 0 0">
        <a href="${esc(appUrl(`/leads/${d.leadId}`))}"
           style="display:inline-block;background:#006742;color:#fff;text-decoration:none;
                  padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600">
          Open the lead in the CRM
        </a>
      </p>
      <p style="margin:16px 0 0;color:#888;font-size:12px">
        Sent automatically by the Veloria Grand CRM for every new lead.
      </p>
    </div>`;

  const subjectParts = [who, d.eventType, sourceLabel].filter(Boolean);
  return { subject: `New lead: ${subjectParts.join(" · ")}`, html };
}

export interface NewLeadAlertResult {
  sent: boolean;
  reason?: string;
}

/**
 * Email the configured group about a new lead. Best-effort: returns a result,
 * never throws, so lead creation can never fail because of it.
 */
export async function sendNewLeadAlert(leadId: string): Promise<NewLeadAlertResult> {
  try {
    const recipients = parseAlertRecipients(process.env.NEW_LEAD_ALERT_EMAILS);
    if (recipients.length === 0) return { sent: false, reason: "No alert recipients configured" };
    if (!isEmailConfigured()) return { sent: false, reason: "Email service not configured" };

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        title: true,
        description: true,
        source: true,
        eventType: true,
        eventDate: true,
        guestCount: true,
        createdAt: true,
        deletedAt: true,
        preferredVenue: { select: { name: true } },
        assignedTo: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true, phone: true, email: true } },
      },
    });
    if (!lead || lead.deletedAt) return { sent: false, reason: "Lead not found" };

    const { subject, html } = buildNewLeadAlert({
      leadId: lead.id,
      title: lead.title,
      name: `${lead.contact?.firstName ?? ""} ${lead.contact?.lastName ?? ""}`.trim(),
      phone: lead.contact?.phone ?? null,
      email: lead.contact?.email ?? null,
      source: String(lead.source),
      eventType: lead.eventType,
      eventDate: lead.eventDate,
      guestCount: lead.guestCount,
      venue: lead.preferredVenue?.name ?? null,
      assignedTo: lead.assignedTo?.name ?? null,
      receivedAt: lead.createdAt,
      notes: cleanNotes(lead.description),
    });

    const res = await sendEmail({ to: recipients, subject, html });
    if (!res.success) {
      return { sent: false, reason: res.error || "Email provider rejected the message" };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Fire-and-forget wrapper for callers. Production runs on a long-lived Node
 * process (pm2), so a detached promise completes; the caller's response is not
 * held up by the mail server. The outcome is logged either way.
 */
export function scheduleNewLeadAlert(leadId: string): void {
  void sendNewLeadAlert(leadId)
    .then((r) => {
      if (r.sent) console.log("[NEW_LEAD_ALERT] sent", { leadId });
      else if (r.reason !== "No alert recipients configured")
        console.warn("[NEW_LEAD_ALERT] not sent", { leadId, reason: r.reason });
    })
    .catch((e) => console.error("[NEW_LEAD_ALERT] failed", { leadId, e }));
}
