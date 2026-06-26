import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { runLeadIntake, leadSlaDeadline } from "@/lib/lead-pipeline";
import { attachAttributionToLead, type AttributionInput } from "@/lib/attribution";

interface ExternalLeadData {
  name: string;
  email?: string;
  phone?: string;
  source: string;
  message?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: number;
  estimatedValue?: number; // budget — feeds scoring
  perPlateBudget?: number; // ×guestCount estimates value when no budget given
  venueId?: string; // preferred venue
  customFields?: Record<string, unknown>;
  /** First-touch marketing attribution (utm/gclid/fbclid/referrer) — best-effort. */
  attribution?: AttributionInput;
  /**
   * Provider's own lead identifier (Facebook leadgen_id / Google lead_id).
   * Used as an idempotency key so provider webhook retries do not create
   * duplicate Lead rows. Persisted into the lead description as
   * `[ext:<externalId>]` and matched on subsequent deliveries.
   */
  externalId?: string;
}

/**
 * Build the stable idempotency marker embedded in a lead's description.
 * Provider redeliveries carry the same externalId, so we can detect and
 * short-circuit duplicate captures without a schema change.
 */
function externalIdMarker(externalId: string): string {
  return `[ext:${externalId.trim()}]`;
}

/**
 * Capture a lead from an external source (Facebook Ads, Google Ads, Generic API, etc.)
 * Creates or finds the contact, creates a lead, assigns via rules, and sends notifications.
 */
export async function captureLeadFromExternal(data: ExternalLeadData) {
  try {
    // Idempotency guard: provider webhooks (Facebook leadgen_id / Google
    // lead_id) redeliver on slow responses or non-2xx, which would otherwise
    // create duplicate leads. If we've already captured this external id,
    // return the existing lead instead of creating a new one.
    const externalId = data.externalId?.trim();
    if (externalId) {
      const existing = await prisma.lead.findFirst({
        where: { description: { contains: externalIdMarker(externalId) } },
        select: { id: true, contactId: true },
      });
      if (existing) {
        // Re-link attribution on redelivery so retried webhooks refresh the
        // campaign mapping without duplicating the row (upserts on leadId).
        if (data.attribution) {
          await attachAttributionToLead(existing.id, {
            ...data.attribution,
            source: data.attribution.source || data.source,
          });
        }
        return {
          success: true,
          leadId: existing.id,
          contactId: existing.contactId,
          deduped: true,
        };
      }
    }

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

    // Derive an estimated value: explicit budget, else per-plate × guests.
    const estimatedValue =
      data.estimatedValue && data.estimatedValue > 0
        ? data.estimatedValue
        : data.perPlateBudget && data.guestCount
          ? data.perPlateBudget * data.guestCount
          : null;

    // Calculate lead score — now fed the FULL signal set (budget included).
    let score = 0;
    try {
      score = calculateLeadScore({
        source: mapSource(data.source),
        guestCount: data.guestCount,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        estimatedValue,
        status: "NEW",
      });
    } catch {
      // Scoring is optional
    }

    // Create the lead — stamp the speed-to-lead SLA clock on capture.
    const lead = await prisma.lead.create({
      data: {
        title: `${data.source} Lead — ${firstName} ${lastName}`.trim(),
        description: [
          data.message || `Auto-captured from ${data.source}`,
          externalId ? externalIdMarker(externalId) : null,
        ]
          .filter(Boolean)
          .join(" "),
        status: "NEW",
        source: mapSource(data.source) as any,
        score,
        eventType: data.eventType || null,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        guestCount: data.guestCount || null,
        estimatedValue,
        preferredVenueId: data.venueId || null,
        firstContactDue: leadSlaDeadline(),
        contactId: contact.id,
        assignedToId,
        createdById: await getSystemUserId(),
      },
    });

    // First-touch marketing attribution (best-effort; helper swallows errors).
    // Awaited so the campaign linkage isn't dropped on a serverless freeze.
    if (data.attribution) {
      await attachAttributionToLead(lead.id, {
        ...data.attribution,
        source: data.attribution.source || data.source,
      });
    }

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
          await sendWelcomeWhatsApp(
            contact.phone,
            welcomeConfig.templateName,
            firstName,
            contact.id
          );
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

    // Intake: instant email auto-reply (via LEAD_CREATED workflows) + the
    // "call now" task + auto-enrolment into matching nurture cadences.
    await runLeadIntake({
      lead: {
        id: lead.id,
        contactId: contact.id,
        source: lead.source,
        eventType: lead.eventType,
        status: lead.status,
        guestCount: lead.guestCount,
        score: lead.score,
        estimatedValue: estimatedValue,
      },
      triggeredByUserId: assignedToId ?? undefined,
    });

    // Message-intent classification on the first-touch inbound message so a
    // brand-new READY_TO_BUY lead also boosts + pings. Best-effort, never blocks.
    if (data.message && data.message.trim().length > 0) {
      try {
        const { stampMessageIntent } = await import("@/lib/ai/intent-stamp");
        await stampMessageIntent({
          text: data.message,
          leadId: lead.id,
          contactId: contact.id,
        });
      } catch (e) {
        console.error("[LeadCapture] intent-stamp error:", e);
      }
    }

    // Referral-code ingestion for non-portal inbound channels (WhatsApp webhook
    // / generic API). The public portal path calls recordReferralIngestion
    // directly; this covers the other channels. Wrapped so it never blocks capture.
    try {
      const referralCode =
        (typeof data.customFields?.referralCode === "string"
          ? data.customFields.referralCode
          : undefined) ??
        (data.source.toLowerCase() === "referral" &&
        typeof data.customFields?.code === "string"
          ? data.customFields.code
          : undefined);

      if (referralCode) {
        const { resolveReferralPartnerByCode, recordReferralIngestion } =
          await import("@/lib/referral/ingest");
        const partner = await resolveReferralPartnerByCode(referralCode);
        if (partner) {
          await recordReferralIngestion({
            partnerId: partner.id,
            leadId: lead.id,
            contactId: contact.id,
            prospectName: data.name,
            prospectPhone: data.phone ?? null,
            prospectEmail: data.email ?? null,
            eventType: data.eventType ?? null,
            eventDate: data.eventDate ? new Date(data.eventDate) : null,
            guestCount: data.guestCount ?? null,
            message: data.message ?? null,
          });
        }
      }
    } catch (e) {
      console.error("[LeadCapture] referral-ingestion error:", e);
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
    whatsapp: "SOCIAL_MEDIA",
    walk_in: "WALK_IN",
    phone: "PHONE_INQUIRY",
    email: "EMAIL",
  };
  return sourceMap[source.toLowerCase()] || "OTHER";
}

/**
 * Get system user ID (first SUPER_ADMIN or ADMIN)
 */
export async function getSystemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });
  return admin?.id || "";
}

/**
 * Send a WhatsApp welcome message via the Meta Cloud API.
 *
 * Strategy: if `templateName` is set to a real WhatsApp template name, send
 * as a template (preferred for outside the 24-hour customer service window).
 * Falls back to a plain-text message when only `firstName` is available.
 *
 * Logs the outbound to `WhatsAppMessage` so the message shows up in the
 * unified inbox just like a manually-sent message.
 */
async function sendWelcomeWhatsApp(
  phone: string,
  templateName: string,
  firstName: string,
  contactId?: string
) {
  try {
    const text =
      templateName && templateName.trim().length > 0
        ? `Hi ${firstName}, thanks for reaching out to Veloria Grand. ` +
          `One of our event consultants will be in touch shortly. ` +
          `For urgent queries, reply to this message.`
        : `Hi ${firstName}, thanks for getting in touch with Veloria Grand!`;

    const result = await sendWhatsApp({
      to: phone,
      template: templateName || undefined,
      message: text,
      params: { name: firstName },
    });

    // Mirror to WhatsAppMessage log if we know the contact
    if (contactId) {
      try {
        await prisma.whatsAppMessage.create({
          data: {
            direction: "OUTBOUND",
            content: text,
            status: result.success ? "SENT" : "FAILED",
            whatsappId: result.messageId || null,
            contactId,
          },
        });
      } catch {
        // Logging failure must not block the welcome flow
      }
    }

    if (!result.success) {
      console.error(`[AutoWelcome] Failed to send to ${phone}:`, result.error);
    }
  } catch (error) {
    console.error("[AutoWelcome] Failed to send WhatsApp:", error);
  }
}
