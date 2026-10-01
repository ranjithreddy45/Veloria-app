// ============================================================
// Where a new lead gets mirrored to — decided by the ACTIVE WhatsApp provider.
// ------------------------------------------------------------
// There is one reason to copy a lead into the messaging platform: so the
// customer can be messaged and so a reply lands in a thread that already knows
// who they are. That platform is whichever one WhatsAppConfig.provider names.
//
// Before this module the push went to Weflux unconditionally. After the move to
// AiSensy that meant a second number holding our leads: Weflux fires its own
// "first message" automation on everything it receives, so a new enquiry could
// be greeted twice — once from a number nobody watches any more.
//
// Clearing the webhook URL in settings does NOT stop that, which is why this is
// a code gate: pushLeadToWeflux falls back to WEFLUX_CRM_WEBHOOK_URL /
// WEFLUX_CRM_SECRET in the environment, and a leftover Weflux access token is
// on its own enough to keep syncing contacts.
//
// Fire-and-forget at every call site: a messaging platform being down must
// never fail lead capture.
// ============================================================

import { prisma } from "@/lib/prisma";
import { pushLeadToWeflux, type WefluxCrmEvent, type WefluxLeadPayload } from "@/lib/integrations/weflux-crm";
import { AiSensyClient } from "@/lib/whatsapp/aisensy/client";

export type LeadSyncResult = {
  provider: string;
  ok: boolean;
  /** Nothing to do for this provider, or it is not configured. Not a failure. */
  skipped?: boolean;
  error?: string;
};

/**
 * Mirror a lead into the active WhatsApp provider.
 *
 * AiSensy: creates (and opts in) the contact so the number is addressable and a
 * reply threads against a named contact. It deliberately does NOT send a
 * message — AiSensy has no CRM-triggered automation equivalent to Weflux's, so
 * the first message is ours to send through sendWhatsApp() with an approved
 * template. If no welcome template is configured, no first message goes out,
 * and that is a content gap to close in AiSensy, not something to paper over
 * here by sending unapproved text that WhatsApp would refuse anyway.
 */
export async function syncLeadToWhatsAppProvider(
  event: WefluxCrmEvent,
  lead: WefluxLeadPayload,
  opts?: { eventId?: string }
): Promise<LeadSyncResult> {
  let config: {
    provider: string;
    aisensyProjectId: string | null;
    aisensyApiPassword: string | null;
    aisensyApiEndpoint: string | null;
  } | null = null;
  try {
    config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: {
        provider: true,
        aisensyProjectId: true,
        aisensyApiPassword: true,
        aisensyApiEndpoint: true,
      },
    });
  } catch (error) {
    return { provider: "unknown", ok: false, error: errorText(error) };
  }

  const provider = config?.provider || "META";

  if (provider === "WEFLUX") {
    const res = await pushLeadToWeflux(event, lead, opts);
    return { provider, ...res };
  }

  if (provider === "AISENSY") {
    // Only a new lead needs the contact created; a stage change does not.
    if (event !== "lead.created") return { provider, ok: true, skipped: true };
    const projectId = config?.aisensyProjectId?.trim();
    const apiPassword = config?.aisensyApiPassword?.trim();
    if (!projectId || !apiPassword) return { provider, ok: false, skipped: true };
    if (!lead.phone?.trim()) return { provider, ok: false, skipped: true };
    try {
      const client = new AiSensyClient({
        projectId,
        apiPassword,
        ...(config?.aisensyApiEndpoint ? { baseUrl: config.aisensyApiEndpoint } : {}),
      });
      await client.ensureContact(lead.name?.trim() || lead.phone, lead.phone);
      return { provider, ok: true };
    } catch (error) {
      console.error("[lead-sync] AiSensy contact sync failed:", errorText(error));
      return { provider, ok: false, error: errorText(error) };
    }
  }

  // META (Cloud API) has no contact book of its own to mirror into.
  return { provider, ok: true, skipped: true };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
