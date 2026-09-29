/**
 * The seam between AiSensy and the CRM. Implement these against the SAME
 * functions the existing Weflux webhook (/api/webhooks/weflux) already calls,
 * so AiSensy traffic lands in the same inbox, contact timeline, lead matching,
 * notifications and "WhatsApp Inbound Log" page — no parallel pipeline.
 */
import type { AiSensyEvent, ContactEvent, InboundMessageEvent, OutboundEchoEvent, StatusEvent } from "./webhook";

export interface WhatsAppSettingsForAiSensy {
  provider: string; // 'AISENSY' when active
  /** AiSensy Project ID (aisensyProjectId column — see CLAUDE_CODE_BRIEF.md step 2). */
  projectId: string;
  /** Custom App password (aisensyApiPassword column, encrypted like waAccessToken). */
  apiPassword: string;
  /** Optional base URL override (aisensyApiEndpoint). Must be https://…aisensy.com or blank. */
  baseUrl?: string | null;
  /** Webhook shared secret from the AiSensy Custom App (aisensyWebhookSecret, encrypted). */
  webhookSecret: string;
  /** Token embedded in our webhook URL (aisensyVerifyToken). */
  verifyToken: string;
}

export interface InboundLogEntry {
  provider: 'AISENSY';
  topic: string;
  notificationId: string;
  authOk: boolean;
  parseOk: boolean;
  kind: AiSensyEvent['kind'] | 'rejected';
  phone?: string;
  matchedContactId?: string | null;
  error?: string;
  rawBody: string;
  headers: Record<string, string>;
}

export interface AiSensySink {
  loadSettings(): Promise<WhatsAppSettingsForAiSensy | null>;
  /**
   * Dedupe for at-least-once delivery. MUST be an atomic claim, not a SELECT:
   * INSERT the receipt row (UNIQUE notificationId) and return true iff it already existed
   * (unique violation / ON CONFLICT DO NOTHING affected 0 rows). A plain lookup lets two
   * concurrent deliveries — or two pm2 workers — both through. The handler also guards
   * in-process, but that does not cover multiple processes.
   */
  alreadyProcessed(notificationId: string): Promise<boolean>;
  /** Mark the claimed receipt as successfully processed (e.g. set processedAt). */
  markProcessed(notificationId: string): Promise<void>;
  /** Existing inbound-log writer (the page at /settings/integrations/whatsapp-inbound). */
  log(entry: InboundLogEntry): Promise<void>;

  /** Customer replied → inbox message, contact/lead match, 24h-window timestamp, notify owner. Return matched contact id. */
  onInbound(e: InboundMessageEvent): Promise<string | null>;
  /** Message typed by an agent in the AiSensy app or a campaign → timeline entry (skip if we sent it ourselves). */
  onOutboundEcho(e: OutboundEchoEvent): Promise<void>;
  /** Delivery status → update the stored outbound message (match on waMessageId, then messageId). */
  onStatus(e: StatusEvent): Promise<void>;
  onContact(e: ContactEvent): Promise<void>;
}
