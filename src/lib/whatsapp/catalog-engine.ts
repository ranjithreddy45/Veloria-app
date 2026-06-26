// ============================================================
// WhatsApp Catalog Engine — first-inbound auto-brochure state machine
// ============================================================
// Plain library (NOT "use server"). Layers an interactive catalog session on
// top of the EXISTING inbound intake. The webhook calls:
//   • runCatalogFirstInbound() — after captureLeadFromExternal mints the
//     contact + lead for an UNKNOWN number; sends the event-type prompt.
//   • advanceCatalogSession() — when a KNOWN number taps a button/list reply;
//     sends tailored package cards + a brochure / quote CTA.
//
// Everything is BEST-EFFORT: every send is try/caught, the engine NEVER
// throws and NEVER blocks lead capture or the always-200 webhook contract.
// Idempotent per phone: the session is keyed on a single canonical phone form
// and short-circuits if already PROMPTED inside the re-prompt window
// (Meta redelivers webhooks; the prompt is a NEW side effect needing its own
// dedupe on top of capture's contact reuse).

import { prisma } from "@/lib/prisma";
import { sendWhatsApp, sendWhatsAppInteractive } from "@/lib/integrations/whatsapp";
import {
  CATALOG_STAGES,
  CATALOG_REPROMPT_WINDOW_MS,
  CATALOG_EVENT_TYPES,
  CATALOG_COPY,
  canonicalCatalogPhone,
  findEventType,
  guessEventTypeFromText,
  buildPackageCardsFor,
  renderCardsBody,
  type CatalogEventType,
  type PackageCard,
} from "@/lib/whatsapp/catalog-content";

// ------------------------------------------------------------
// Public helpers (re-exported for the admin/preview surfaces + tests).
// ------------------------------------------------------------
export interface EventTypePrompt {
  header: string;
  body: string;
  footer: string;
  buttons: { id: string; title: string }[];
  /** Meta caps reply buttons at 3 → list shape when more event types exist. */
  useList: boolean;
}

export function buildEventTypePrompt(): EventTypePrompt {
  const buttons = CATALOG_EVENT_TYPES.map((e) => ({ id: e.buttonId, title: e.label }));
  return {
    header: CATALOG_COPY.promptHeader,
    body: CATALOG_COPY.promptBody,
    footer: CATALOG_COPY.promptFooter,
    buttons,
    useList: buttons.length > 3,
  };
}

export function buildPackageCards(eventType: string): PackageCard[] {
  const evt =
    findEventType(eventType) ??
    CATALOG_EVENT_TYPES.find((e) => e.eventTypeEnum === eventType) ??
    null;
  if (!evt) return [];
  return buildPackageCardsFor(evt);
}

// ------------------------------------------------------------
// Mirror an outbound to the unified inbox (WhatsAppMessage OUTBOUND). Plain
// ref to contactId is required by the model, so we only mirror when we have a
// resolved contact. Never throws.
// ------------------------------------------------------------
async function mirrorOutbound(args: {
  contactId: string | null | undefined;
  content: string;
  messageId?: string;
  ok: boolean;
  error?: string;
}): Promise<string | null> {
  if (!args.contactId) return null;
  try {
    const row = await prisma.whatsAppMessage.create({
      data: {
        direction: "OUTBOUND",
        content: args.content,
        status: args.ok ? "SENT" : "FAILED",
        whatsappId: args.messageId || null,
        failureReason: args.ok ? null : args.error?.slice(0, 500) || "send failed",
        contactId: args.contactId,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error("[catalog-engine] mirrorOutbound failed:", err);
    return null;
  }
}

// ------------------------------------------------------------
// Resolve a published, event-type-scoped DigitalBrochure slug for the CTA.
// Plain ref / slug only. Degrades to null (→ human-callback CTA) when the
// sibling digital-brochure feature has nothing published.
// ------------------------------------------------------------
async function resolveBrochureSlug(evt: CatalogEventType): Promise<string | null> {
  try {
    const byType = await prisma.digitalBrochure.findFirst({
      where: { isPublished: true, eventType: evt.eventTypeEnum },
      orderBy: { updatedAt: "desc" },
      select: { slug: true },
    });
    if (byType?.slug) return byType.slug;

    // Fallback: any published brochure (generic landing), best-effort.
    const generic = await prisma.digitalBrochure.findFirst({
      where: { isPublished: true },
      orderBy: { updatedAt: "desc" },
      select: { slug: true },
    });
    return generic?.slug ?? null;
  } catch (err) {
    console.error("[catalog-engine] resolveBrochureSlug failed:", err);
    return null;
  }
}

function brochureUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return base ? `${base}/v/${slug}` : `/v/${slug}`;
}

// ============================================================
// runCatalogFirstInbound — send the event-type prompt on first inbound.
// ============================================================
export interface RunCatalogFirstInboundArgs {
  phone: string;
  contactId?: string | null;
  leadId?: string | null;
  messageId?: string | null; // inbound Meta waId (for audit, not dedupe)
  inboundText?: string | null;
}

export interface CatalogResult {
  ok: boolean;
  sessionId?: string;
  stage?: string;
  skipped?: boolean;
  reason?: string;
}

export async function runCatalogFirstInbound(
  args: RunCatalogFirstInboundArgs
): Promise<CatalogResult> {
  try {
    const phone = canonicalCatalogPhone(args.phone);
    if (!phone) return { ok: false, reason: "no-phone" };

    // Idempotency: if a session already exists and was prompted inside the
    // window, short-circuit (Meta redelivery / repeat first-inbound).
    const existing = await prisma.whatsAppCatalogSession.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      const within =
        Date.now() - new Date(existing.promptedAt).getTime() < CATALOG_REPROMPT_WINDOW_MS;
      // Already past PROMPTED, or prompted recently → don't re-send.
      if (existing.stage !== CATALOG_STAGES.PROMPTED || within) {
        return {
          ok: true,
          sessionId: existing.id,
          stage: existing.stage,
          skipped: true,
          reason: "already-prompted",
        };
      }
    }

    // Create the session BEFORE sending so a concurrent redelivery sees it.
    const session =
      existing ??
      (await prisma.whatsAppCatalogSession.create({
        data: {
          phone,
          contactId: args.contactId || null,
          leadId: args.leadId || null,
          stage: CATALOG_STAGES.PROMPTED,
        },
      }));

    // Build + send the event-type prompt (interactive list/buttons).
    const prompt = buildEventTypePrompt();
    let sendOk = false;
    let messageId: string | undefined;
    let sendErr: string | undefined;
    try {
      const res = prompt.useList
        ? await sendWhatsAppInteractive({
            to: phone,
            header: prompt.header,
            body: prompt.body,
            footer: prompt.footer,
            list: {
              button: CATALOG_COPY.listButtonText,
              sections: [
                {
                  title: CATALOG_COPY.listSectionTitle,
                  rows: prompt.buttons.map((b) => ({ id: b.id, title: b.title })),
                },
              ],
            },
          })
        : await sendWhatsAppInteractive({
            to: phone,
            header: prompt.header,
            body: prompt.body,
            footer: prompt.footer,
            buttons: prompt.buttons.map((b) => ({ id: b.id, title: b.title })),
          });
      sendOk = res.success;
      messageId = res.messageId;
      sendErr = res.error;
    } catch (err) {
      // Interactive unsupported / outside window → graceful text fallback.
      console.error("[catalog-engine] interactive prompt failed, falling back:", err);
    }

    if (!sendOk) {
      // Degrade to a plain text prompt listing the options (always inside the
      // 24h window since this fires on first inbound).
      try {
        const optionLines = CATALOG_EVENT_TYPES.map((e, i) => `${i + 1}. ${e.label}`).join("\n");
        const res = await sendWhatsApp({
          to: phone,
          message: `${CATALOG_COPY.promptBody}\n\n${optionLines}\n\nReply with the number or name of your event.`,
        });
        sendOk = res.success;
        messageId = res.messageId;
        sendErr = res.error;
      } catch (err) {
        console.error("[catalog-engine] text-fallback prompt failed:", err);
      }
    }

    const mirroredId = await mirrorOutbound({
      contactId: args.contactId,
      content: `${CATALOG_COPY.promptBody} [event-type prompt]`,
      messageId,
      ok: sendOk,
      error: sendErr,
    });

    // Stamp the prompt result; keep stage PROMPTED. If we couldn't send at
    // all, we still leave the session so a manual resend can retry — but mark
    // promptedAt now so the window guard applies.
    await prisma.whatsAppCatalogSession
      .update({
        where: { id: session.id },
        data: {
          contactId: args.contactId || session.contactId,
          leadId: args.leadId || session.leadId,
          stage: CATALOG_STAGES.PROMPTED,
          promptedAt: new Date(),
          lastMessageId: mirroredId || session.lastMessageId,
        },
      })
      .catch((err) => console.error("[catalog-engine] stamp prompt failed:", err));

    return { ok: sendOk, sessionId: session.id, stage: CATALOG_STAGES.PROMPTED };
  } catch (err) {
    console.error("[catalog-engine] runCatalogFirstInbound fatal (swallowed):", err);
    return { ok: false, reason: "exception" };
  }
}

// ============================================================
// advanceCatalogSession — handle a button/list tap → send package cards + CTA.
// ============================================================
export interface AdvanceCatalogSessionArgs {
  phone: string;
  contactId?: string | null;
  buttonReplyId?: string | null;
  listReplyId?: string | null;
  /** Free text fallback when no interactive id is present (number/name reply). */
  inboundText?: string | null;
}

export async function advanceCatalogSession(
  args: AdvanceCatalogSessionArgs
): Promise<CatalogResult> {
  try {
    const phone = canonicalCatalogPhone(args.phone);
    if (!phone) return { ok: false, reason: "no-phone" };

    const session = await prisma.whatsAppCatalogSession.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
    // No active catalog session for this number → nothing to advance.
    if (!session) return { ok: true, skipped: true, reason: "no-session" };

    // Resolve the chosen event type. Priority: explicit interactive id →
    // free-text keyword guess. (LLM-less fallback mirrors sentiment.ts.)
    const evt =
      findEventType(args.buttonReplyId) ??
      findEventType(args.listReplyId) ??
      guessEventTypeFromText(args.inboundText);

    if (!evt) {
      // A reply we can't map to an event type → leave the session; the rep can
      // follow up. Don't loop or re-prompt.
      return { ok: true, sessionId: session.id, skipped: true, reason: "unmapped-reply" };
    }

    // Idempotency: if we've already sent cards for THIS event type, don't
    // re-send on a redelivered tap.
    if (
      session.selectedEventType === evt.eventTypeEnum &&
      (session.stage === CATALOG_STAGES.CARDS_SENT ||
        session.stage === CATALOG_STAGES.CTA_CLICKED ||
        session.stage === CATALOG_STAGES.CLOSED)
    ) {
      return { ok: true, sessionId: session.id, stage: session.stage, skipped: true, reason: "cards-already-sent" };
    }

    // Mark selection first (so a concurrent redelivery short-circuits above).
    await prisma.whatsAppCatalogSession
      .update({
        where: { id: session.id },
        data: {
          stage: CATALOG_STAGES.EVENT_SELECTED,
          selectedEventType: evt.eventTypeEnum,
          respondedAt: new Date(),
          contactId: args.contactId || session.contactId,
        },
      })
      .catch((err) => console.error("[catalog-engine] mark selection failed:", err));

    // Build the premium-first package cards from QUOTE_CATALOG (read-only).
    const cards = buildPackageCardsFor(evt);
    const cardsBody = renderCardsBody(evt, cards);

    // Resolve a brochure CTA; degrade to a human-callback line.
    const slug = await resolveBrochureSlug(evt);
    const ctaLine = slug
      ? CATALOG_COPY.ctaBrochure(evt.label, brochureUrl(slug))
      : CATALOG_COPY.ctaFallback;

    const fullBody = `${cardsBody}\n\n${ctaLine}\n\n${CATALOG_COPY.closingNudge}`;

    let sendOk = false;
    let messageId: string | undefined;
    let sendErr: string | undefined;
    try {
      const res = await sendWhatsApp({ to: phone, message: fullBody });
      sendOk = res.success;
      messageId = res.messageId;
      sendErr = res.error;
    } catch (err) {
      console.error("[catalog-engine] cards send failed:", err);
      sendErr = err instanceof Error ? err.message : "send error";
    }

    const mirroredId = await mirrorOutbound({
      contactId: args.contactId || session.contactId,
      content: fullBody,
      messageId,
      ok: sendOk,
      error: sendErr,
    });

    // Advance to CARDS_SENT only on a successful send; otherwise leave at
    // EVENT_SELECTED so a manual resend can complete the flow.
    await prisma.whatsAppCatalogSession
      .update({
        where: { id: session.id },
        data: {
          stage: sendOk ? CATALOG_STAGES.CARDS_SENT : CATALOG_STAGES.EVENT_SELECTED,
          selectedEventType: evt.eventTypeEnum,
          brochureSlug: slug || session.brochureSlug,
          lastMessageId: mirroredId || session.lastMessageId,
        },
      })
      .catch((err) => console.error("[catalog-engine] stamp cards failed:", err));

    return {
      ok: sendOk,
      sessionId: session.id,
      stage: sendOk ? CATALOG_STAGES.CARDS_SENT : CATALOG_STAGES.EVENT_SELECTED,
    };
  } catch (err) {
    console.error("[catalog-engine] advanceCatalogSession fatal (swallowed):", err);
    return { ok: false, reason: "exception" };
  }
}

// ============================================================
// markCatalogCtaClicked — best-effort funnel stamp when the brochure CTA is
// followed (called from the brochure-view path / advance on a known slug).
// Additive, idempotent, never throws.
// ============================================================
export async function markCatalogCtaClicked(args: {
  phone?: string | null;
  brochureSlug?: string | null;
}): Promise<CatalogResult> {
  try {
    const where = args.phone
      ? { phone: canonicalCatalogPhone(args.phone) }
      : args.brochureSlug
        ? { brochureSlug: args.brochureSlug }
        : null;
    if (!where) return { ok: false, reason: "no-key" };

    const session = await prisma.whatsAppCatalogSession.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });
    if (!session) return { ok: true, skipped: true, reason: "no-session" };
    if (session.stage === CATALOG_STAGES.CLOSED) {
      return { ok: true, sessionId: session.id, stage: session.stage, skipped: true };
    }

    await prisma.whatsAppCatalogSession.update({
      where: { id: session.id },
      data: { stage: CATALOG_STAGES.CTA_CLICKED },
    });
    return { ok: true, sessionId: session.id, stage: CATALOG_STAGES.CTA_CLICKED };
  } catch (err) {
    console.error("[catalog-engine] markCatalogCtaClicked failed (swallowed):", err);
    return { ok: false, reason: "exception" };
  }
}
