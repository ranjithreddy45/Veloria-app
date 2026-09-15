// ============================================================
// Inbound WhatsApp webhook capture — the observability layer.
// ------------------------------------------------------------
// Every POST that reaches /api/webhooks/weflux or /api/webhooks/whatsapp is
// persisted as a WhatsAppInboundEvent BEFORE any auth or parsing, then that same
// row is updated as verification / parsing / contact matching proceed.
//
// WHY: outbound via Weflux was confirmed working, but the inbound side —
// payload shape and signature — was never validated against a real provider
// event. A payload we did not understand used to vanish into a console.log on
// a serverless instance that no longer exists by the time anyone looks. Now it
// is a row an admin can open, read, and replay from
// /settings/integrations/whatsapp-inbound.
//
// INVARIANTS: every function here is best-effort and never throws — a logging
// failure must never change a webhook's response code. Raw bodies are capped
// at 64 KB; secret-bearing headers / query params are reduced to a presence
// marker so a verify token or HMAC never lands in the database.
// ============================================================

import { prisma } from "@/lib/prisma";

export type InboundProvider = "WEFLUX" | "META";

export const RAW_BODY_CAP_BYTES = 64 * 1024;
export const TEXT_PREVIEW_MAX = 200;
export const INBOUND_EVENT_RETENTION_DAYS = 30;
const TRUNCATION_MARKER = "…[truncated at 65536 bytes]";

/** Header / query keys whose VALUE must never be stored. */
const SECRET_KEY_PATTERN = /(authorization|signature|secret|token|cookie|api-key|apikey)/i;

/** Headers → plain object; secret-bearing values become `{ present: true }`.
 *  The Weflux endpoint carries `?token=…` in the URL, so query params get the
 *  same treatment under a `(query)` key. */
export function redactHeaders(
  headers: Headers,
  url?: { searchParams: URLSearchParams } | null
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    out[k] = SECRET_KEY_PATTERN.test(k) ? { present: true } : value;
  });
  if (url) {
    const query: Record<string, unknown> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = SECRET_KEY_PATTERN.test(key) ? { present: true } : value;
    });
    if (Object.keys(query).length > 0) out["(query)"] = query;
  }
  return out;
}

/** Cap by BYTES (Postgres text is bytes, and provider payloads can carry
 *  multi-byte names); mark the cut so the viewer and replay can tell. */
function capBody(raw: string): string {
  if (Buffer.byteLength(raw, "utf8") <= RAW_BODY_CAP_BYTES) return raw;
  const sliced = Buffer.from(raw, "utf8").subarray(0, RAW_BODY_CAP_BYTES).toString("utf8");
  return `${sliced}\n${TRUNCATION_MARKER}`;
}

/** True when a stored rawBody was cut at the cap (so it cannot be replayed). */
export function isTruncatedBody(rawBody: string): boolean {
  return rawBody.endsWith(TRUNCATION_MARKER);
}

/** Single-line, length-capped preview for the list view. */
export function previewText(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > TEXT_PREVIEW_MAX ? `${t.slice(0, TEXT_PREVIEW_MAX - 1)}…` : t;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** Persist the raw request. Returns the row id, or null if logging failed —
 *  callers pass that null straight into updateInboundEvent, which no-ops. */
export async function captureInboundEvent(input: {
  provider: InboundProvider;
  rawBody: string;
  headers: Headers;
  url?: { searchParams: URLSearchParams } | null;
}): Promise<string | null> {
  try {
    const row = await prisma.whatsAppInboundEvent.create({
      data: {
        provider: input.provider,
        rawBody: capBody(input.rawBody),
        headers: JSON.stringify(redactHeaders(input.headers, input.url ?? null)),
      },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    console.error("[WhatsApp inbound capture] create failed:", e);
    return null;
  }
}

export interface InboundEventPatch {
  signatureValid?: boolean | null;
  eventType?: string | null;
  fromPhone?: string | null;
  messageId?: string | null;
  textPreview?: string | null;
  parsedOk?: boolean;
  parseError?: string | null;
  matchedContactId?: string | null;
  handled?: boolean;
}

/** Update the captured row as the pipeline learns more. Never throws. */
export async function updateInboundEvent(
  id: string | null,
  patch: InboundEventPatch
): Promise<void> {
  if (!id) return;
  try {
    await prisma.whatsAppInboundEvent.update({
      where: { id },
      data: {
        ...patch,
        textPreview: patch.textPreview === undefined ? undefined : previewText(patch.textPreview),
        parseError:
          patch.parseError === undefined
            ? undefined
            : patch.parseError == null
              ? null
              : patch.parseError.slice(0, 2000),
      },
    });
  } catch (e) {
    console.error("[WhatsApp inbound capture] update failed:", e);
  }
}

/** Retention: delete rows older than N days (daily cron: whatsapp-inbound-prune). */
export async function pruneInboundEvents(
  days: number = INBOUND_EVENT_RETENTION_DAYS
): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await prisma.whatsAppInboundEvent.deleteMany({
    where: { receivedAt: { lt: cutoff } },
  });
  return res.count;
}

// ---- Shared view types (the "use server" actions file cannot export these) ----

export interface InboundEventRow {
  id: string;
  provider: string;
  receivedAt: string; // ISO
  signatureValid: boolean | null;
  eventType: string | null;
  fromPhone: string | null;
  messageId: string | null;
  textPreview: string | null;
  parsedOk: boolean;
  parseError: string | null;
  matchedContactId: string | null;
  matchedContactName: string | null;
  handled: boolean;
}

export interface InboundEventDetail extends InboundEventRow {
  rawBody: string;
  headers: string | null;
  truncated: boolean;
}
