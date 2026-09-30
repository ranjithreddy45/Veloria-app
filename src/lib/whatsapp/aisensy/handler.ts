/**
 * Framework-agnostic webhook handler so it can be unit-tested and reused.
 * The Next.js route (app/api/webhooks/aisensy/route.ts) is a thin wrapper.
 */
import { parseAiSensyNotification, verifyAiSensySignature, type AiSensyNotification } from "./webhook";
import type { AiSensySink } from "./sink";

export interface WebhookInput {
  rawBody: string;
  headers: Headers | Record<string, string | null | undefined>;
  /** `token` query-string value from the webhook URL. */
  token: string | null;
}

export interface WebhookOutput {
  status: number;
  body: Record<string, unknown>;
}

const H = (h: WebhookInput['headers'], k: string): string | null => {
  if (typeof (h as Headers)?.get === 'function') return (h as Headers).get(k);
  const rec = h as Record<string, string | null | undefined>;
  const hit = Object.keys(rec).find((x) => x.toLowerCase() === k.toLowerCase());
  return hit ? rec[hit] ?? null : null;
};

const pickHeaders = (h: WebhookInput['headers']) => {
  const out: Record<string, string> = {};
  for (const k of ['x-aisensy-signature', 'x-aisensy-project-id', 'x-aisensy-api-version', 'content-type', 'user-agent']) {
    const v = H(h, k);
    if (v) out[k] = k === 'x-aisensy-signature' ? `${v.slice(0, 8)}…` : v;
  }
  return out;
};

/**
 * Notification ids being processed right now in this process. At-least-once delivery
 * means the same id can arrive twice concurrently; a check-then-mark `alreadyProcessed`
 * would let both through (double inbox message). Cross-process safety still needs the
 * sink's atomic claim (see AiSensySink.alreadyProcessed).
 */
const inFlight = new Set<string>();

/**
 * @param schedule runs work after the response is sent (Next's `after()`), so we
 *   acknowledge inside AiSensy's 5s budget. Tests pass `(fn) => fn()`.
 */
export async function handleAiSensyWebhook(
  input: WebhookInput,
  sink: AiSensySink,
  schedule: (fn: () => Promise<void>) => void,
): Promise<WebhookOutput> {
  const headers = pickHeaders(input.headers);
  const settings = await sink.loadSettings();

  // Not configured / another provider active: 200 so AiSensy doesn't hammer us,
  // but do nothing. (Never 410 — that permanently disables the subscription.)
  if (!settings || settings.provider !== 'AISENSY') {
    // Before cutover (webhook added, provider still WEFLUX) and after a rollback, AiSensy keeps
    // delivering real customer messages. If one verifies under the stored AiSensy secret, log it
    // (not processed) so it can be replayed from the inbound log instead of vanishing silently.
    const secret = (settings?.webhookSecret ?? '').trim();
    if (
      settings?.verifyToken &&
      input.token === settings.verifyToken &&
      verifyAiSensySignature(input.rawBody, H(input.headers, 'x-aisensy-signature'), secret)
    ) {
      let p: Partial<AiSensyNotification> | null = null;
      try {
        p = JSON.parse(input.rawBody);
      } catch {
        /* logged with parseOk:false */
      }
      const entry = {
        provider: 'AISENSY' as const,
        topic: String(p?.topic ?? ''),
        notificationId: String(p?.id ?? ''),
        authOk: true,
        parseOk: !!p,
        kind: 'ignored' as const,
        error: 'not processed: AiSensy is not the active provider (replayable)',
        rawBody: input.rawBody.slice(0, 20_000),
        headers,
      };
      schedule(() => sink.log(entry).catch((e) => console.error('[aisensy-webhook] log failed', e)));
    }
    return { status: 200, body: { ok: true, ignored: 'aisensy not the active provider' } };
  }

  const reject = async (status: number, error: string) => {
    await sink
      .log({ provider: 'AISENSY', topic: '', notificationId: '', authOk: false, parseOk: false, kind: 'rejected', error, rawBody: input.rawBody.slice(0, 20_000), headers })
      .catch(() => {});
    return { status, body: { ok: false, error } };
  };

  if (!settings.verifyToken || input.token !== settings.verifyToken) return reject(401, 'bad or missing token');
  // Trim like the client does for projectId/apiPassword: a pasted trailing space/newline in the
  // secret or project id would otherwise 401 every delivery until AiSensy disables the webhook.
  if (!verifyAiSensySignature(input.rawBody, H(input.headers, 'x-aisensy-signature'), (settings.webhookSecret ?? '').trim())) {
    return reject(401, 'signature mismatch');
  }
  const headerProject = H(input.headers, 'x-aisensy-project-id')?.trim();
  const ownProject = settings.projectId?.trim();
  if (headerProject && ownProject && headerProject !== ownProject) {
    return reject(401, `project mismatch (${headerProject})`);
  }

  let n: AiSensyNotification;
  try {
    n = JSON.parse(input.rawBody);
  } catch {
    return reject(400, 'invalid JSON');
  }
  if (!n?.id || !n?.topic) return reject(400, 'missing id/topic');

  schedule(async () => {
    const event = parseAiSensyNotification(n);
    const key = String(n.id);
    const entry = {
      provider: 'AISENSY' as const,
      topic: n.topic,
      notificationId: key,
      authOk: true,
      parseOk: event.kind !== 'ignored' || !event.reason.startsWith('parse error'),
      kind: event.kind,
      phone: 'phone' in event ? event.phone : undefined,
      matchedContactId: null as string | null,
      error: undefined as string | undefined,
      rawBody: input.rawBody.slice(0, 20_000),
      headers,
    };
    if (inFlight.has(key)) {
      entry.error = 'duplicate delivery (concurrent, skipped)';
      await sink.log(entry).catch((e) => console.error('[aisensy-webhook] log failed', e));
      return;
    }
    inFlight.add(key);
    try {
      if (await sink.alreadyProcessed(key)) {
        entry.error = 'duplicate delivery (skipped)';
        return;
      }
      switch (event.kind) {
        case 'inbound_message':
          entry.matchedContactId = await sink.onInbound(event);
          break;
        case 'outbound_echo':
          await sink.onOutboundEcho(event);
          break;
        case 'status':
          await sink.onStatus(event);
          break;
        case 'contact':
          await sink.onContact(event);
          break;
        case 'ignored':
          entry.error = event.reason;
          break;
      }
      await sink.markProcessed(key);
    } catch (e) {
      entry.error = `processing failed: ${(e as Error)?.message ?? e}`;
      console.error('[aisensy-webhook]', n.topic, n.id, e);
    } finally {
      inFlight.delete(key);
      await sink.log(entry).catch((e) => console.error('[aisensy-webhook] log failed', e));
    }
  });

  return { status: 200, body: { ok: true } };
}
