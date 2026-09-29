/**
 * AiSensy Project Webhook — signature verification + payload normalisation.
 *
 * Docs: https://aisensy.stoplight.io/docs/project-api/56ea5a8f1cc9a-project-webhook
 *   Method   : POST, application/json
 *   Headers  : X-AiSensy-Signature (hex HMAC-SHA256 of the body, key = webhook shared secret)
 *              X-AiSensy-Project-Id, X-AiSensy-API-Version
 *   Body     : { id, created_at, topic, delivery_attempt, app_id, webhook_id, project_id, data }
 *   Contract : answer 2xx within 5s (ideally <1s), at-least-once delivery (dedupe on `id`),
 *              non-2xx is retried once after 5 min, NEVER return 410 (it disables the subscription).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const AISENSY_TOPICS_TO_SUBSCRIBE = [
  'message.sender.user', // customer → business (inbound replies)
  'message.status.updated', // sent / delivered / read / failed for our outbound
  'message.created', // every message incl. agent replies typed in the AiSensy inbox (timeline echo)
  'contact.created', // optional: contacts created on AiSensy side (e.g. Click-to-WhatsApp ads)
] as const;

export interface AiSensyNotification {
  id: string;
  created_at?: number | string;
  topic: string;
  delivery_attempt?: number;
  app_id?: string;
  webhook_id?: string;
  project_id?: string;
  data?: Record<string, any>;
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a.trim().toLowerCase(), 'utf8');
  const y = Buffer.from(b.trim().toLowerCase(), 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Verify X-AiSensy-Signature. Always pass the RAW request body (req.text()),
 * never a re-serialised object.
 *
 * AiSensy's own sample signs `JSON.stringify(parsedBody)`, which only equals the
 * raw body when they send compact JSON. We therefore accept a match against
 * either the raw body or its compact re-serialisation — both are HMACs under
 * your secret, so neither weakens the check.
 */
export function verifyAiSensySignature(rawBody: string, signature: string | null | undefined, sharedSecret: string): boolean {
  if (!signature || !sharedSecret) return false;
  const sig = signature.replace(/^sha256=/i, '').trim();
  if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
  const hmac = (s: string) => createHmac('sha256', sharedSecret).update(s, 'utf8').digest('hex');
  if (safeEqualHex(hmac(rawBody), sig)) return true;
  try {
    const compact = JSON.stringify(JSON.parse(rawBody));
    if (compact !== rawBody && safeEqualHex(hmac(compact), sig)) return true;
  } catch {
    /* not JSON — raw comparison already failed */
  }
  return false;
}

// ------------------------------------------------------------ normalisation

export type WaMessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'UNKNOWN';

interface Base {
  notificationId: string;
  topic: string;
  projectId?: string;
  deliveryAttempt?: number;
  raw: AiSensyNotification;
}

export interface InboundMessageEvent extends Base {
  kind: 'inbound_message';
  /** Customer number, digits only, with country code. */
  phone: string;
  contactName?: string;
  /** AiSensy message id. */
  messageId?: string;
  /** WhatsApp id (wamid.…) — same id family Meta/Weflux used. */
  waMessageId?: string;
  messageType: string; // TEXT | IMAGE | VIDEO | FILE | AUDIO | LOCATION | BUTTON_REPLY | …
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  /** Epoch millis. */
  timestamp: number;
  /** wamid this message replies to, when WhatsApp provides context. */
  replyToWaMessageId?: string;
}

export interface OutboundEchoEvent extends Base {
  kind: 'outbound_echo';
  phone: string;
  messageId?: string;
  waMessageId?: string;
  sender: string; // AGENT | SYSTEM | API | …
  agentId?: string;
  messageType: string;
  text?: string;
  isTemplate: boolean;
  templateName?: string;
  campaignName?: string;
  timestamp: number;
}

export interface StatusEvent extends Base {
  kind: 'status';
  phone?: string;
  messageId?: string;
  waMessageId?: string;
  status: WaMessageStatus;
  /** Epoch millis of the transition that produced `status`. */
  at: number;
  failure?: { code?: string | number; reason?: string };
}

export interface ContactEvent extends Base {
  kind: 'contact';
  phone: string;
  contactName?: string;
  source?: string;
  attributes?: Record<string, unknown>;
}

export interface IgnoredEvent extends Base {
  kind: 'ignored';
  reason: string;
}

export type AiSensyEvent = InboundMessageEvent | OutboundEchoEvent | StatusEvent | ContactEvent | IgnoredEvent;

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const s = String(v).trim();
  // Numeric strings must go through Number(): V8's Date.parse("12") / ("0") returns a date in 2001/2000.
  const n = typeof v === 'number' ? v : /^\d+(\.\d+)?$/.test(s) ? Number(s) : Date.parse(s);
  return Number.isFinite(n) && n > 0 ? (n < 1e12 ? Math.round(n * 1000) : n) : undefined; // seconds → millis
};
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** Best-effort text extraction across AiSensy message_content shapes. */
export function extractText(content: any): string | undefined {
  if (content == null) return undefined;
  if (typeof content === 'string') return content;
  const c = content as Record<string, any>;
  const candidates = [
    c.text,
    c.body,
    c.caption,
    c.title, // button / list reply title
    c.payload,
    c.interactive?.button_reply?.title,
    c.interactive?.list_reply?.title,
    c.button?.text,
    c.locationName || c.address ? [c.locationName, c.address].filter(Boolean).join(', ') : undefined,
  ];
  const hit = candidates.find((x) => typeof x === 'string' && x.trim());
  return hit?.trim();
}

function mediaOf(content: any): { url?: string; fileName?: string } {
  if (!content || typeof content !== 'object') return {};
  return {
    url: content.publicUrl || content.url || content.link || undefined,
    fileName: content.fileName || content.filename || undefined,
  };
}

function statusOf(m: any): { status: WaMessageStatus; at: number } {
  const s = String(m?.status ?? '').toUpperCase();
  const failedAt = num(m?.failed_at);
  // An empty/placeholder failureResponse ({} or {code:null}) is not a failure.
  const f = m?.failureResponse;
  const hasFailure = !!f && typeof f === 'object' && ((f.code != null && f.code !== '') || !!f.reason);
  if (s === 'FAILED' || failedAt || hasFailure) return { status: 'FAILED', at: failedAt ?? Date.now() };
  if (s === 'READ' || num(m?.read_at)) return { status: 'READ', at: num(m?.read_at) ?? Date.now() };
  if (s === 'DELIVERED' || num(m?.delivered_at)) return { status: 'DELIVERED', at: num(m?.delivered_at) ?? Date.now() };
  if (s === 'SENT' || num(m?.sent_at)) return { status: 'SENT', at: num(m?.sent_at) ?? Date.now() };
  return { status: 'UNKNOWN', at: Date.now() };
}

/** Turns one AiSensy notification into one normalised event. Never throws. */
export function parseAiSensyNotification(n: AiSensyNotification): AiSensyEvent {
  const base: Base = {
    notificationId: String(n?.id ?? ''),
    topic: String(n?.topic ?? ''),
    projectId: n?.project_id,
    deliveryAttempt: n?.delivery_attempt,
    raw: n,
  };
  try {
    const data = n?.data ?? {};
    const m = data.message ?? {};
    const contact = data.contact ?? {};
    const phone = digits(m.phone_number || contact.phone_number);

    switch (base.topic) {
      case 'message.sender.user': {
        const media = mediaOf(m.message_content);
        return {
          ...base,
          kind: 'inbound_message',
          phone,
          contactName: m.userName || m.user_name || contact.name || undefined,
          messageId: m.id || undefined,
          waMessageId: m.messageId || undefined,
          messageType: String(m.message_type || 'TEXT').toUpperCase(),
          text: extractText(m.message_content),
          mediaUrl: media.url,
          fileName: media.fileName,
          timestamp: num(m.sent_at) ?? num(n.created_at) ?? Date.now(),
          replyToWaMessageId: m.context?.id || m.context?.message_id || undefined,
        };
      }

      case 'message.created': {
        const sender = String(m.sender || '').toUpperCase();
        if (sender === 'USER') {
          // Same message also arrives on message.sender.user — handle it there only.
          return { ...base, kind: 'ignored', reason: 'user message (handled via message.sender.user)' };
        }
        const content = m.message_content ?? {};
        return {
          ...base,
          kind: 'outbound_echo',
          phone,
          messageId: m.id || undefined,
          waMessageId: m.messageId || undefined,
          sender: sender || 'UNKNOWN',
          agentId: m.agent_id || undefined,
          messageType: String(m.message_type || 'TEXT').toUpperCase(),
          text: extractText(content),
          isTemplate: !!(m.is_HSM ?? m.is_hsm),
          templateName: content?.name || undefined,
          campaignName: m.campaign?.name || undefined,
          timestamp: num(m.sent_at) ?? num(n.created_at) ?? Date.now(),
        };
      }

      case 'message.status.updated':
      case 'contact.campaign.sent':
      case 'contact.campaign.delivered':
      case 'contact.campaign.read': {
        const { status, at } = statusOf(m);
        const f = m.failureResponse;
        return {
          ...base,
          kind: 'status',
          phone: phone || undefined,
          messageId: m.id || undefined,
          waMessageId: m.messageId || undefined,
          status,
          at,
          failure: status === 'FAILED' && f ? { code: f.code, reason: f.reason } : undefined,
        };
      }

      case 'contact.created':
        return {
          ...base,
          kind: 'contact',
          phone,
          contactName: contact.name || undefined,
          source: contact.source || undefined,
          attributes: contact.attributes || undefined,
        };

      default:
        return { ...base, kind: 'ignored', reason: `topic not handled: ${base.topic || '(none)'}` };
    }
  } catch (e) {
    return { ...base, kind: 'ignored', reason: `parse error: ${(e as Error)?.message}` };
  }
}

/** Rank so a late "SENT" never overwrites "READ" (webhooks can arrive out of order). */
export const STATUS_RANK: Record<WaMessageStatus, number> = { UNKNOWN: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };
export function shouldApplyStatus(current: WaMessageStatus | string | null | undefined, incoming: WaMessageStatus): boolean {
  const cur = (String(current ?? 'UNKNOWN').toUpperCase() as WaMessageStatus) in STATUS_RANK
    ? (String(current ?? 'UNKNOWN').toUpperCase() as WaMessageStatus)
    : 'UNKNOWN';
  // Proof of delivery beats a failure report in EITHER arrival order; otherwise the final
  // state depended on which webhook landed first (FAILED→DELIVERED stuck on FAILED).
  if (incoming === 'FAILED') return cur !== 'READ' && cur !== 'DELIVERED';
  if (cur === 'FAILED') return incoming === 'DELIVERED' || incoming === 'READ';
  return STATUS_RANK[incoming] > STATUS_RANK[cur];
}
