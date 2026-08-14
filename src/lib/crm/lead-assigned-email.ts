import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// ============================================================
// Telling a rep, by email, that a lead is theirs.
//
// notify() only ever wrote an in-app Notification row — it has never sent an
// email, despite the name suggesting otherwise. So a lead landing at 9pm sat
// unseen until someone happened to open the CRM, which is the opposite of what
// speed-to-lead requires.
//
// IMPORTANT — this cannot deliver until RESEND_API_KEY exists in the
// environment. It is absent in production today, so sendEmail() returns
// { success: false, error: "Email not configured" } for every call in this app.
// That is reported honestly by this function and surfaced in settings rather
// than being swallowed: an alert system that silently sends nothing is worse
// than no alert system, because people stop checking.
// ============================================================

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
    .replace(/"/g, "&quot;");
}

export interface LeadAssignedEmailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Email the rep a lead has just been assigned to.
 *
 * Best-effort by design: capture must never fail because a mail provider is
 * down or unconfigured. The result is returned rather than thrown so callers
 * can log it, and so the settings screen can tell the truth about whether these
 * emails are actually going out.
 */
export async function sendLeadAssignedEmail(
  leadId: string,
  assigneeId: string
): Promise<LeadAssignedEmailResult> {
  try {
    const [lead, user] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          title: true,
          source: true,
          eventType: true,
          eventDate: true,
          guestCount: true,
          estimatedValue: true,
          firstContactDue: true,
          contact: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: assigneeId },
        select: { name: true, email: true, isActive: true },
      }),
    ]);

    if (!lead) return { sent: false, reason: "Lead not found" };
    // A deactivated rep should not be emailed, and "no email on the account" is
    // a real configuration problem worth naming rather than a silent no-op.
    if (!user?.email) return { sent: false, reason: "Assignee has no email address" };
    if (user.isActive === false) return { sent: false, reason: "Assignee is deactivated" };

    const who = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();
    const link = appUrl(`/leads/${lead.id}`);

    // Everything a rep needs to decide whether to call NOW, in the notification
    // itself — the phone number especially. An email that only says "you have a
    // lead" forces a login before any action is possible, which costs exactly
    // the minutes speed-to-lead is about.
    const rows: [string, string][] = [
      ["Name", who || "—"],
      ["Phone", lead.contact.phone || "—"],
      ["Email", lead.contact.email || "—"],
      ["Source", lead.source],
      ["Event", lead.eventType || "—"],
      [
        "Event date",
        lead.eventDate ? lead.eventDate.toISOString().split("T")[0] : "—",
      ],
      ["Guests", lead.guestCount ? String(lead.guestCount) : "—"],
    ];

    const due = lead.firstContactDue
      ? `<p style="margin:16px 0 0;padding:10px 12px;background:#fff4e5;border-radius:6px;font-size:14px">
           <strong>Call by ${esc(lead.firstContactDue.toISOString().replace("T", " ").slice(0, 16))} UTC</strong>
           — first-response SLA.
         </p>`
      : "";

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;color:#111">
        <h2 style="margin:0 0 4px;font-size:18px">A new lead is assigned to you</h2>
        <p style="margin:0 0 16px;color:#555;font-size:14px">${esc(lead.title)}</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          ${rows
            .map(
              ([k, v]) =>
                `<tr>
                   <td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">${esc(k)}</td>
                   <td style="padding:6px 0;font-weight:600">${esc(v)}</td>
                 </tr>`
            )
            .join("")}
        </table>
        ${due}
        <p style="margin:20px 0 0">
          <a href="${esc(link)}"
             style="display:inline-block;background:#006742;color:#fff;text-decoration:none;
                    padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600">
            Open the lead
          </a>
        </p>
      </div>`;

    const res = await sendEmail({
      to: user.email,
      subject: `New lead assigned: ${who || lead.title}`,
      html,
    });

    if (!res.success) {
      return { sent: false, reason: res.error || "Email provider rejected the message" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[LEAD_ASSIGNED_EMAIL]", e);
    return { sent: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Whether assignment emails can actually be delivered right now.
 *
 * Exists so the settings screen can say so out loud. Every email feature in
 * this app has been quietly returning "not configured" — the failure is only a
 * problem because nothing surfaces it.
 */
export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
