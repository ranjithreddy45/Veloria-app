"use server";

import { auth } from "@/../auth";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import {
  catalogSessionFilterSchema,
  resendCatalogPromptSchema,
} from "@/schemas/whatsapp-catalog.schema";
import {
  CATALOG_EVENT_TYPES,
  canonicalCatalogPhone,
} from "@/lib/whatsapp/catalog-content";
import { runCatalogFirstInbound } from "@/lib/whatsapp/catalog-engine";

// ============================================================
// WhatsApp Catalog — internal, RBAC-gated staff console actions.
// All return Result<T>, gate at top via hasPermission, serialize nothing
// money-bearing (no Decimal here — cards are read-only display, not stored),
// and revalidate /whatsapp. Exports ONLY async functions.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

const STAGES = ["PROMPTED", "EVENT_SELECTED", "CARDS_SENT", "CTA_CLICKED", "CLOSED"] as const;
type Stage = (typeof STAGES)[number];

export interface CatalogSessionRow {
  id: string;
  phone: string;
  stage: string;
  selectedEventType: string | null;
  brochureSlug: string | null;
  ctaClicked: boolean;
  contactId: string | null;
  contactName: string | null;
  leadId: string | null;
  promptedAt: string;
  respondedAt: string | null;
  createdAt: string;
}

export interface CatalogSessionsPage {
  rows: CatalogSessionRow[];
  total: number;
}

export interface CatalogStats {
  prompted: number;
  eventSelected: number;
  cardsSent: number;
  ctaClicked: number;
  closed: number;
  total: number;
  /** % of prompted sessions that selected an event type. */
  selectionRate: number;
  /** % of prompted sessions that reached a CTA click. */
  conversionRate: number;
}

// ------------------------------------------------------------
// getCatalogSessions — list sessions joined to contact for the monitor.
// ------------------------------------------------------------
export async function getCatalogSessions(
  filter?: unknown
): Promise<Result<CatalogSessionsPage>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "whatsapp:read")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = catalogSessionFilterSchema.safeParse(filter ?? {});
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid filter" };
    }
    const { stage, eventType, search, page, limit } = parsed.data;

    const where: {
      stage?: string;
      selectedEventType?: string;
      phone?: { contains: string };
    } = {};
    if (stage) where.stage = stage;
    if (eventType) where.selectedEventType = eventType;
    if (search) where.phone = { contains: search.replace(/[\s\-()+]/g, "") };

    const [rows, total] = await Promise.all([
      prisma.whatsAppCatalogSession.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.whatsAppCatalogSession.count({ where }),
    ]);

    // Resolve contact names in one batch (plain ref → Contact.id).
    const contactIds = Array.from(
      new Set(rows.map((r) => r.contactId).filter((x): x is string => !!x))
    );
    const contacts = contactIds.length
      ? await prisma.contact.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameById = new Map(
      contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()])
    );

    return {
      success: true,
      data: {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          phone: r.phone,
          stage: r.stage,
          selectedEventType: r.selectedEventType,
          brochureSlug: r.brochureSlug,
          ctaClicked: r.stage === "CTA_CLICKED" || r.stage === "CLOSED",
          contactId: r.contactId,
          contactName: r.contactId ? nameById.get(r.contactId) ?? null : null,
          leadId: r.leadId,
          promptedAt: r.promptedAt.toISOString(),
          respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error("[getCatalogSessions]", error);
    return { success: false, error: "Failed to load catalog sessions" };
  }
}

// ------------------------------------------------------------
// getCatalogStats — funnel counts by stage + conversion %.
// ------------------------------------------------------------
export async function getCatalogStats(): Promise<Result<CatalogStats>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "whatsapp:read")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const grouped = await prisma.whatsAppCatalogSession.groupBy({
      by: ["stage"],
      _count: { _all: true },
    });
    const countOf = (s: Stage) =>
      grouped.find((g) => g.stage === s)?._count._all ?? 0;

    const prompted = countOf("PROMPTED");
    const eventSelected = countOf("EVENT_SELECTED");
    const cardsSent = countOf("CARDS_SENT");
    const ctaClicked = countOf("CTA_CLICKED");
    const closed = countOf("CLOSED");
    const total = prompted + eventSelected + cardsSent + ctaClicked + closed;

    // Funnel: a session that reached cards/CTA also "selected"; treat counts
    // as cumulative-forward for rate math.
    const reachedSelection = eventSelected + cardsSent + ctaClicked + closed;
    const reachedCta = ctaClicked + closed;

    return {
      success: true,
      data: {
        prompted,
        eventSelected,
        cardsSent,
        ctaClicked,
        closed,
        total,
        selectionRate: total > 0 ? Math.round((reachedSelection / total) * 100) : 0,
        conversionRate: total > 0 ? Math.round((reachedCta / total) * 100) : 0,
      },
    };
  } catch (error) {
    console.error("[getCatalogStats]", error);
    return { success: false, error: "Failed to load catalog stats" };
  }
}

// ------------------------------------------------------------
// getCatalogConfig — read-only canonical event-type map for the admin surface.
// ------------------------------------------------------------
export interface CatalogConfigView {
  enabled: boolean;
  events: {
    buttonId: string;
    label: string;
    brochureSlug: string;
    foodTierIds: string[];
    eventTypeEnum: string;
  }[];
}

export async function getCatalogConfig(): Promise<Result<CatalogConfigView>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "settings:read")) {
      return { success: false, error: "Insufficient permissions" };
    }

    // Enable flag is env-driven (additive, no schema change). Defaults ON.
    const enabled = process.env.WHATSAPP_CATALOG_ENABLED !== "false";

    return {
      success: true,
      data: {
        enabled,
        events: CATALOG_EVENT_TYPES.map((e) => ({
          buttonId: e.buttonId,
          label: e.label,
          brochureSlug: e.brochureSlugHint,
          foodTierIds: e.foodTierIds,
          eventTypeEnum: e.eventTypeEnum,
        })),
      },
    };
  } catch (error) {
    console.error("[getCatalogConfig]", error);
    return { success: false, error: "Failed to load catalog config" };
  }
}

// ------------------------------------------------------------
// resendCatalogPrompt — rep manually re-triggers the event-type prompt.
// Bypasses the re-prompt window by closing+recreating intent: we delete the
// recent PROMPTED session marker so the engine sends a fresh prompt.
// ------------------------------------------------------------
export async function resendCatalogPrompt(
  input: unknown
): Promise<Result<{ sessionId: string | null; sent: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "whatsapp:send")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = resendCatalogPromptSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid phone" };
    }

    const phone = canonicalCatalogPhone(parsed.data.phone);
    if (!phone) return { success: false, error: "Invalid phone number" };

    // Resolve any known contact/lead for richer linkage on the new session.
    const existing = await prisma.whatsAppCatalogSession.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
      select: { id: true, contactId: true, leadId: true },
    });

    // Clear the prompt window so the engine treats this as a fresh prompt:
    // bump promptedAt back so the within-window guard fails, and reset stage.
    if (existing) {
      await prisma.whatsAppCatalogSession.update({
        where: { id: existing.id },
        data: {
          stage: "PROMPTED",
          promptedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      });
    }

    const result = await runCatalogFirstInbound({
      phone,
      contactId: existing?.contactId ?? null,
      leadId: existing?.leadId ?? null,
    });

    await logActivity({
      userId: session.user.id,
      action: "catalog_prompt_resent",
      entityType: "WhatsAppCatalogSession",
      entityId: result.sessionId ?? phone,
      changes: { phone, sent: result.ok },
    });

    revalidatePath("/whatsapp");
    revalidatePath("/whatsapp/catalog");

    return { success: true, data: { sessionId: result.sessionId ?? null, sent: result.ok } };
  } catch (error) {
    console.error("[resendCatalogPrompt]", error);
    return { success: false, error: "Failed to resend catalog prompt" };
  }
}
