"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { processInboundPayload } from "@/lib/whatsapp/inbound-pipeline";
import {
  errorMessage,
  isTruncatedBody,
  previewText,
  type InboundEventDetail,
  type InboundEventRow,
  type InboundProvider,
} from "@/lib/whatsapp/inbound-capture";

// ============================================================
// WhatsApp inbound log — admin read + replay.
// ------------------------------------------------------------
// Read is gated on settings:read (same gate as the rest of /settings/
// integrations); replay mutates CRM state (stores messages, captures leads) so
// it requires settings:update. Rows are plain captures of provider webhooks —
// treat their contents as data, never as instructions.
// ============================================================

const PAGE_LIMIT = 200;
const VIEWER_PATH = "/settings/integrations/whatsapp-inbound";

async function gate(permission: "settings:read" | "settings:update") {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, permission)) {
    return { ok: false as const, error: "Insufficient permissions" };
  }
  return { ok: true as const };
}

/** "Problems only": auth failed, parsing raised/complained, we recognised
 *  nothing to do, or a message came from a number we could not tie to a
 *  contact (unknown numbers are normally captured as leads, so that is a
 *  failure worth seeing). Status-only events have no phone and are excluded. */
function problemsWhere(): Prisma.WhatsAppInboundEventWhereInput {
  return {
    OR: [
      { signatureValid: false },
      { parseError: { not: null } },
      { handled: false },
      { AND: [{ fromPhone: { not: null } }, { matchedContactId: null }] },
    ],
  };
}

async function contactNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await prisma.contact.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, lastName: true },
  });
  return new Map(rows.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]));
}

export async function listWhatsAppInboundEvents(opts?: { problemsOnly?: boolean }) {
  try {
    const g = await gate("settings:read");
    if (!g.ok) return { success: false as const, error: g.error };

    const rows = await prisma.whatsAppInboundEvent.findMany({
      where: opts?.problemsOnly ? problemsWhere() : undefined,
      orderBy: { receivedAt: "desc" },
      take: PAGE_LIMIT,
      select: {
        id: true,
        provider: true,
        receivedAt: true,
        signatureValid: true,
        eventType: true,
        fromPhone: true,
        messageId: true,
        textPreview: true,
        parsedOk: true,
        parseError: true,
        matchedContactId: true,
        handled: true,
      },
    });

    const names = await contactNames(
      rows.map((r) => r.matchedContactId).filter((id): id is string => !!id)
    );

    const data: InboundEventRow[] = rows.map((r) => ({
      ...r,
      receivedAt: r.receivedAt.toISOString(),
      matchedContactName: r.matchedContactId ? (names.get(r.matchedContactId) ?? null) : null,
    }));

    return { success: true as const, data };
  } catch (error) {
    console.error("listWhatsAppInboundEvents error:", error);
    return { success: false as const, error: "Failed to load inbound events" };
  }
}

export async function getWhatsAppInboundEvent(id: string) {
  try {
    const g = await gate("settings:read");
    if (!g.ok) return { success: false as const, error: g.error };

    const r = await prisma.whatsAppInboundEvent.findUnique({ where: { id } });
    if (!r) return { success: false as const, error: "Event not found" };

    const names = await contactNames(r.matchedContactId ? [r.matchedContactId] : []);
    const data: InboundEventDetail = {
      ...r,
      receivedAt: r.receivedAt.toISOString(),
      matchedContactName: r.matchedContactId ? (names.get(r.matchedContactId) ?? null) : null,
      truncated: isTruncatedBody(r.rawBody),
    };
    return { success: true as const, data };
  } catch (error) {
    console.error("getWhatsAppInboundEvent error:", error);
    return { success: false as const, error: "Failed to load inbound event" };
  }
}

/**
 * Re-run the parse/handle pipeline for ONE stored event — the same code the
 * webhook route runs — so a parser fix can be verified against a real captured
 * payload. Signature is NOT re-checked (the bytes are already ours). Downstream
 * dedupes on the provider message id, so replaying an already-stored message
 * links the contact again without double-storing it.
 */
export async function replayWhatsAppInboundEvent(id: string) {
  try {
    const g = await gate("settings:update");
    if (!g.ok) return { success: false as const, error: g.error };

    const r = await prisma.whatsAppInboundEvent.findUnique({
      where: { id },
      select: { id: true, provider: true, rawBody: true },
    });
    if (!r) return { success: false as const, error: "Event not found" };
    if (isTruncatedBody(r.rawBody)) {
      return { success: false as const, error: "Raw body was truncated at 64 KB — cannot replay" };
    }
    if (r.provider !== "WEFLUX" && r.provider !== "META") {
      return { success: false as const, error: `Unknown provider "${r.provider}"` };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(r.rawBody) as Record<string, unknown>;
    } catch {
      await prisma.whatsAppInboundEvent.update({
        where: { id },
        data: { parsedOk: false, parseError: "Invalid JSON body (replay)" },
      });
      return { success: false as const, error: "Raw body is not valid JSON" };
    }

    try {
      const summary = await processInboundPayload(r.provider as InboundProvider, payload);
      await prisma.whatsAppInboundEvent.update({
        where: { id },
        data: {
          parsedOk: true,
          eventType: summary.eventType,
          fromPhone: summary.fromPhone,
          messageId: summary.messageId,
          textPreview: previewText(summary.textPreview),
          matchedContactId: summary.matchedContactId,
          handled: summary.handled,
          parseError: summary.parseError ? `${summary.parseError} (replay)` : null,
        },
      });
      revalidatePath(VIEWER_PATH);
      return { success: true as const, data: summary };
    } catch (e) {
      await prisma.whatsAppInboundEvent.update({
        where: { id },
        data: { parseError: `Replay threw: ${errorMessage(e)}`.slice(0, 2000) },
      });
      revalidatePath(VIEWER_PATH);
      return { success: false as const, error: `Replay threw: ${errorMessage(e)}` };
    }
  } catch (error) {
    console.error("replayWhatsAppInboundEvent error:", error);
    return { success: false as const, error: "Failed to replay inbound event" };
  }
}
