import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";

interface ExternalLeadData {
  name: string;
  email?: string;
  phone?: string;
  source: string;
  message?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: number;
  customFields?: Record<string, unknown>;
}

/**
 * Capture a lead from an external source (Facebook Ads, Google Ads, Generic API, etc.)
 * Creates or finds the contact, creates a lead, assigns via rules, and sends notifications.
 */
export async function captureLeadFromExternal(data: ExternalLeadData) {
  try {
    // Parse the name into first/last
    const nameParts = data.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Unknown";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Find or create contact
    let contact = null;

    if (data.email) {
      contact = await prisma.contact.findFirst({
        where: { email: data.email },
      });
    }

    if (!contact && data.phone) {
      contact = await prisma.contact.findFirst({
        where: { phone: data.phone },
      });
    }

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email: data.email || null,
          phone: data.phone || null,
          tags: [data.source.toLowerCase()],
        },
      });
    }

    // Evaluate assignment rules to auto-assign
    let assignedToId: string | null = null;
    try {
      const assignResult = await evaluateAssignmentRules({
        source: data.source,
        eventType: data.eventType,
      });
      if (assignResult) {
        assignedToId = assignResult;
      }
    } catch {
      // Assignment rules are optional; proceed without assignment
    }

    // Calculate lead score
    let score = 0;
    try {
      score = calculateLeadScore({
        source: mapSource(data.source),
        guestCount: data.guestCount,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
      });
    } catch {
      // Scoring is optional
    }

    // Create the lead
    const lead = await prisma.lead.create({
      data: {
        title: `${data.source} Lead — ${firstName} ${lastName}`.trim(),
        description: data.message || `Auto-captured from ${data.source}`,
        status: "NEW",
        source: mapSource(data.source) as any,
        score,
        eventType: data.eventType || null,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        guestCount: data.guestCount || null,
        contactId: contact.id,
        assignedToId,
        createdById: await getSystemUserId(),
      },
    });

    // Log activity
    logActivity({
      action: "CREATE",
      entityType: "lead",
      entityId: lead.id,
      changes: { source: data.source, autoCapture: true },
      userId: assignedToId || "system",
    });

    // Notify assigned agent
    if (assignedToId) {
      notify({
        userId: assignedToId,
        title: "New Lead Captured",
        message: `New ${data.source} lead: ${firstName} ${lastName}`,
        type: "LEAD_ASSIGNED",
        actionUrl: `/leads`,
      });
    }

    // Check for auto-welcome config
    try {
      const welcomeConfig = await prisma.autoWelcomeConfig.findUnique({
        where: { leadSource: mapSource(data.source) as any },
      });

      if (welcomeConfig?.isEnabled && contact.phone) {
        // Schedule welcome message (delayed or immediate)
        if (welcomeConfig.delayMinutes === 0) {
          await sendWelcomeWhatsApp(contact.phone, welcomeConfig.templateName, firstName);
        } else {
          // For delayed messages, create a scheduled task
          const sendAt = new Date(Date.now() + welcomeConfig.delayMinutes * 60 * 1000);
          await prisma.task.create({
            data: {
              title: `Send welcome message to ${firstName} ${lastName}`,
              description: `Auto-welcome via template: ${welcomeConfig.templateName}`,
              dueDate: sendAt,
              priority: "HIGH",
              status: "TODO",
              assigneeId: assignedToId || (await getSystemUserId()),
              creatorId: await getSystemUserId(),
            },
          });
        }
      }
    } catch {
      // Welcome message is optional; don't fail the lead capture
    }

    return { success: true, leadId: lead.id, contactId: contact.id };
  } catch (error) {
    console.error("[LeadCapture] Error:", error);
    return { success: false, error: "Failed to capture lead" };
  }
}

/**
 * Map string source to LeadSource enum value
 */
function mapSource(source: string): string {
  const sourceMap: Record<string, string> = {
    facebook: "FACEBOOK_ADS",
    facebook_ads: "FACEBOOK_ADS",
    google: "GOOGLE_ADS",
    google_ads: "GOOGLE_ADS",
    indiamart: "INDIAMART",
    justdial: "JUSTDIAL",
    website: "WEBSITE",
    referral: "REFERRAL",
    social_media: "SOCIAL_MEDIA",
    walk_in: "WALK_IN",
    phone: "PHONE_INQUIRY",
    email: "EMAIL",
  };
  return sourceMap[source.toLowerCase()] || "OTHER";
}

/**
 * Get system user ID (first SUPER_ADMIN or ADMIN)
 */
async function getSystemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });
  return admin?.id || "";
}

/**
 * Send a WhatsApp welcome message (placeholder - integrates with existing WhatsApp system)
 */
async function sendWelcomeWhatsApp(phone: string, templateName: string, firstName: string) {
  try {
    // This integrates with the existing WhatsApp API in the app
    // The actual implementation depends on the WhatsApp Business API configuration
    console.log(`[AutoWelcome] Sending ${templateName} to ${phone} for ${firstName}`);
    // TODO: Integrate with existing WhatsApp send function when API keys are configured
  } catch (error) {
    console.error("[AutoWelcome] Failed to send WhatsApp:", error);
  }
}
