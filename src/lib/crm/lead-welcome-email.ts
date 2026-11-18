import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export interface LeadWelcomeEmailResult {
  sent: boolean;
  reason?: string;
}

export interface LeadWelcomeEmailData {
  firstName?: string;
  eventType?: string | null;
  eventDate?: Date | string | null;
  guestCount?: number | null;
  consultantName?: string | null;
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildLeadWelcomeHtml(data: LeadWelcomeEmailData): string {
  const firstName = data.firstName?.trim() || "Guest";
  const eventType = data.eventType || "Special Celebration";
  const eventDate = data.eventDate
    ? typeof data.eventDate === "string"
      ? data.eventDate
      : new Date(data.eventDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
    : "To be confirmed";
  const guestCount = data.guestCount ? `${data.guestCount} guests` : "Flexible";
  const consultantName = data.consultantName || "Our Event Specialist";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:36px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#004d32,#006742);padding:36px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0;letter-spacing:0.5px;">Veloria Grand</h1>
              <p style="color:#bbf7d0;font-size:14px;margin:8px 0 0;font-weight:400;">Luxury Banquets &amp; Curated Celebrations</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 16px;">Warm Greetings, ${esc(firstName)}!</h2>
              <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Thank you for considering <strong>Veloria Grand</strong> for your celebration. We have received your enquiry and are delighted at the prospect of hosting your special event.
              </p>

              <!-- Enquiry Details Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <h3 style="color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;font-weight:700;">Your Enquiry Details</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                      <tr>
                        <td style="color:#64748b;padding:6px 0;width:40%;">Occasion</td>
                        <td style="color:#0f172a;padding:6px 0;font-weight:600;">${esc(eventType)}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:6px 0;">Preferred Date</td>
                        <td style="color:#0f172a;padding:6px 0;font-weight:600;">${esc(eventDate)}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:6px 0;">Expected Guests</td>
                        <td style="color:#0f172a;padding:6px 0;font-weight:600;">${esc(guestCount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <h3 style="color:#0f172a;font-size:15px;font-weight:600;margin:0 0 10px;">What to Expect Next</h3>
              <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Your enquiry has been assigned to <strong>${esc(consultantName)}</strong>, who is reviewing date availability and curating tailored options for you. We will connect with you shortly via phone or WhatsApp to understand your vision in detail and schedule a private venue tour.
              </p>

              <!-- Quick Contact Note -->
              <div style="background-color:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;border-radius:4px;margin-bottom:24px;">
                <p style="color:#166534;font-size:14px;line-height:1.5;margin:0;">
                  <strong>Have immediate questions?</strong><br/>
                  Simply reply directly to this email or reach us at <a href="mailto:info@theveloriagrand.com" style="color:#15803d;font-weight:600;text-decoration:none;">info@theveloriagrand.com</a>.
                </p>
              </div>

              <p style="color:#334155;font-size:14px;margin:0;">
                Warm regards,<br/>
                <strong>The Veloria Grand Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                Veloria Grand — Luxury Banquets &amp; Curated Celebrations
              </p>
              <p style="color:#94a3b8;font-size:11px;margin:6px 0 0;">
                This is an automated confirmation of your enquiry at Veloria Grand.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send an automated Welcome / Confirmation email to the customer who just submitted a lead enquiry.
 *
 * Best-effort: lead capture must never fail if email cannot be sent or provider is unconfigured.
 */
export async function sendLeadWelcomeEmail(
  leadId: string
): Promise<LeadWelcomeEmailResult> {
  try {
    if (!isEmailConfigured()) {
      return { sent: false, reason: "Email service not configured" };
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        title: true,
        eventType: true,
        eventDate: true,
        guestCount: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!lead) return { sent: false, reason: "Lead not found" };
    if (!lead.contact?.email) return { sent: false, reason: "Contact has no email address" };

    const html = buildLeadWelcomeHtml({
      firstName: lead.contact.firstName ?? undefined,
      eventType: lead.eventType,
      eventDate: lead.eventDate,
      guestCount: lead.guestCount,
      consultantName: lead.assignedTo?.name,
    });

    const res = await sendEmail({
      to: lead.contact.email,
      subject: `Thank you for reaching out to Veloria Grand | Enquiry Received`,
      html,
    });

    if (!res.success) {
      return { sent: false, reason: res.error || "Email provider rejected the message" };
    }

    return { sent: true };
  } catch (e) {
    console.error("[LEAD_WELCOME_EMAIL]", e);
    return { sent: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}
