/**
 * AiSensy Project API client (WhatsApp Business API via AiSensy BSP).
 *
 * Docs: https://aisensy.stoplight.io/docs/project-api
 *   Base URL : https://apis.aisensy.com/project-apis/v1
 *   Auth     : header `X-AiSensy-Project-API-Pwd: <Custom App password>`
 *   Send     : POST /project/{project_id}/messages   (Meta Cloud-API-shaped body)
 *
 * Zero dependencies — uses global fetch (Node 18+). Server-only: never import
 * this from a client component, the password must not reach the browser.
 */

export const AISENSY_DEFAULT_BASE_URL = 'https://apis.aisensy.com/project-apis/v1';

export interface AiSensyConfig {
  /** AiSensy Project ID — the 24-char id in the dashboard URL (/projects/<id>/...). */
  projectId: string;
  /** Custom App password. Sent as X-AiSensy-Project-API-Pwd. */
  apiPassword: string;
  /** Override only if AiSensy gives you a different base URL. */
  baseUrl?: string;
  /** Per-request timeout. Default 15s. */
  timeoutMs?: number;
  /** Country code prepended to 10-digit local numbers. Default "91". */
  defaultCountryCode?: string;
}

export type AiSensyMediaKind = 'image' | 'video' | 'document' | 'audio';

export interface TemplateOptions {
  /** Language code exactly as approved, e.g. "en", "en_US", "hi". Default "en". */
  language?: string;
  /** Values for {{1}}, {{2}}… in the template BODY, in order. */
  bodyParams?: Array<string | number>;
  /** Media header, for templates approved with an IMAGE/VIDEO/DOCUMENT header. */
  headerMedia?: { kind: Exclude<AiSensyMediaKind, 'audio'>; link: string; filename?: string };
  /** Values for {{1}}… in a TEXT header. */
  headerTextParams?: Array<string | number>;
  /** Dynamic suffix for URL buttons, keyed by button index (0-based as approved). */
  urlButtonParams?: Record<number, string>;
  /** Payloads for quick-reply buttons, keyed by button index. */
  quickReplyPayloads?: Record<number, string>;
  /** Coupon code for a copy_code button, keyed by button index. */
  couponCodes?: Record<number, string>;
}

export interface SendResult {
  /** Message id returned by AiSensy/Meta (wamid.… when present). Store it to match status webhooks. */
  messageId?: string;
  /** Recipient as WhatsApp resolved it. */
  waId?: string;
  /** The number we actually sent to (normalised digits, no "+"). */
  to: string;
  raw: unknown;
}

export class AiSensyError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body?: unknown;
  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message);
    this.name = 'AiSensyError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
  /** Auth / config problems — retrying will not help. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
  /**
   * Worth retrying later (rate limit, AiSensy/Meta side failure, network).
   * NOT a timeout: the POST may already have reached WhatsApp, and a retry would send
   * the customer a second OTP / first-message. Let the status webhook settle it.
   */
  get isRetryable(): boolean {
    return (this.status === 0 && this.code !== 'TIMEOUT') || this.status === 429 || this.status >= 500;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Normalise an Indian-first phone number into the digits-only international
 * form AiSensy expects ("919187700778"). Accepts "+91 91877 00778",
 * "09187700778", "9187700778", "919187700778", "+91 0 91877 00778".
 * Throws rather than guessing a recipient on "91" + ≠10 digits and on "+"/"00"
 * followed by 10 digits that don't start with the default country code.
 */
export function normalizePhone(input: string, defaultCountryCode = '91'): string {
  const str = String(input ?? '');
  const invalid = () => new AiSensyError(`Invalid phone number: "${input}"`, 400, 'INVALID_PHONE');
  let n = str.replace(/\D/g, '');
  if (!n) throw invalid();
  const cc = defaultCountryCode;
  let intl = /^\s*(\+|00)/.test(str); // written with a country code (E.164 "+" or "00")
  n = n.replace(/^00/, ''); // 0091… international prefix
  if (n.length === 11 && n.startsWith('0')) {
    n = n.slice(1); // 0 + 10-digit trunk number → national format
    intl = false;
  } else if (n.length === cc.length + 11 && n.startsWith(cc + '0')) {
    n = cc + n.slice(cc.length + 1); // "+91 0XXXXXXXXXX"
  }
  // 10 digits = local number. Not when written as "+…"/"00…": "+65 9123 4567" used to become
  // 916591234567 — a plausible stranger's Indian mobile. Ambiguous (SG number, or stray "+" on
  // "+98765 43210"?) → rejected below (<11 digits) rather than guessing a recipient.
  // "+9187700778" is unambiguous (no real +91 number has 8 digits) → local number.
  if (n.length === 10 && (!intl || n.startsWith(cc))) n = cc + n;
  if (n.startsWith('0') || n.length < 11 || n.length > 15) throw invalid();
  if (n.startsWith('91') && n.length !== 12) throw invalid(); // every Indian E.164 number is 91 + 10 digits
  return n;
}

/** WhatsApp rejects template params that are empty (131008) or contain newlines/tabs/>4 spaces (132018). */
const templateParam = (v: unknown): string =>
  String(v ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/ {5,}/g, ' ')
    .trim() || '-';

/** The subset of a send response we read; AiSensy passes Meta's shape through. */
interface SendResponse {
  messages?: Array<{ id?: string; messageId?: string; message_id?: string }>;
  contacts?: Array<{ wa_id?: string }>;
  messageId?: string;
  id?: string;
  data?: { messageId?: string };
}

export class AiSensyClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly cc: string;

  constructor(
    private readonly cfg: AiSensyConfig,
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
  ) {
    if (!cfg?.projectId?.trim()) throw new AiSensyError('AiSensy projectId is required', 400, 'CONFIG');
    if (!cfg?.apiPassword?.trim()) throw new AiSensyError('AiSensy apiPassword is required', 400, 'CONFIG');
    this.baseUrl = (cfg.baseUrl?.trim() || AISENSY_DEFAULT_BASE_URL).replace(/\/+$/, '');
    // If the override is wired to a column shared with Weflux (waApiEndpoint), a stale Weflux URL
    // would ship the AiSensy password to a third-party host on every call. Refuse non-AiSensy hosts.
    let host = '';
    try {
      const u = new URL(this.baseUrl);
      host = u.protocol === 'https:' ? u.hostname.toLowerCase() : '';
    } catch {
      /* invalid URL → host stays '' */
    }
    if (host !== 'aisensy.com' && !host.endsWith('.aisensy.com')) {
      throw new AiSensyError(`AiSensy baseUrl must be https://…aisensy.com (got "${this.baseUrl}")`, 400, 'CONFIG');
    }
    this.timeoutMs = cfg.timeoutMs ?? 15_000;
    this.cc = cfg.defaultCountryCode ?? '91';
  }

  private projectPath(suffix = ''): string {
    return `/project/${encodeURIComponent(this.cfg.projectId.trim())}${suffix}`;
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    let text: string;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'X-AiSensy-Project-API-Pwd': this.cfg.apiPassword.trim(),
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      } as RequestInit);
      // Body read stays inside the timeout: a stalled body would otherwise hang forever,
      // and a mid-body reset would escape as a raw TypeError instead of AiSensyError.
      text = await res.text();
    } catch (err) {
      const aborted = controller.signal.aborted || (err as { name?: string })?.name === 'AbortError';
      throw new AiSensyError(
        aborted ? `AiSensy request timed out after ${this.timeoutMs}ms` : `AiSensy network error: ${(err as Error)?.message}`,
        0,
        aborted ? 'TIMEOUT' : 'NETWORK',
      );
    } finally {
      clearTimeout(timer);
    }

    let json: unknown = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    if (!res.ok) {
      // AiSensy errors look like {"name":"ERR400","message":"…"}; Meta-style
      // errors (passed through) look like {"error":{"message":"…","code":131047}}.
      const j = (json ?? {}) as Record<string, Record<string, unknown> & { message?: string; error_user_msg?: string; code?: number } & { [k: string]: unknown }> & { message?: string; name?: string; error?: { message?: string; error_user_msg?: string; code?: number } };
      const message =
        j?.message || j?.error?.message || j?.error?.error_user_msg || (typeof json === 'string' ? json : '') || res.statusText;
      const code = j?.name || (j?.error?.code != null ? String(j.error.code) : undefined);
      throw new AiSensyError(`AiSensy ${method} ${path} failed (${res.status}): ${message}`, res.status, code, json);
    }
    return json as T;
  }

  // ---------------------------------------------------------------- sending

  /** Low-level send. Prefer the typed helpers below. */
  async sendRaw(payload: Record<string, unknown> & { to: string; type: string }): Promise<SendResult> {
    const to = normalizePhone(payload.to, this.cc);
    const body = { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload, to };
    const raw = await this.request<SendResponse>('POST', this.projectPath('/messages'), body);
    const first = Array.isArray(raw?.messages) ? raw.messages[0] : undefined;
    const messageId: string | undefined =
      first?.id || first?.messageId || first?.message_id || raw?.messageId || raw?.id || raw?.data?.messageId || undefined;
    const waId: string | undefined = Array.isArray(raw?.contacts) ? raw.contacts[0]?.wa_id : undefined;
    return { messageId, waId, to, raw };
  }

  /**
   * Free-form text. WhatsApp only delivers this if the customer messaged the
   * number in the last 24h — otherwise use sendTemplate().
   */
  // Methods that validate are `async` so bad input rejects instead of throwing synchronously
  // past a caller's fire-and-forget `.catch()` (which would crash lead/booking creation).
  async sendText(to: string, text: string, opts: { previewUrl?: boolean } = {}): Promise<SendResult> {
    if (!text?.trim()) throw new AiSensyError('Message text is empty', 400, 'EMPTY_TEXT');
    return this.sendRaw({ to, type: 'text', text: { body: text, preview_url: !!opts.previewUrl } });
  }

  /** Media message (session window only, same rule as text). */
  sendMedia(
    to: string,
    kind: AiSensyMediaKind,
    link: string,
    opts: { caption?: string; filename?: string } = {},
  ): Promise<SendResult> {
    const media: Record<string, string> = { link };
    if (opts.caption && kind !== 'audio') media.caption = opts.caption;
    if (opts.filename && kind === 'document') media.filename = opts.filename;
    return this.sendRaw({ to, type: kind, [kind]: media });
  }

  /** Pre-approved template. Works any time, inside or outside the 24h window. */
  async sendTemplate(to: string, templateName: string, opts: TemplateOptions = {}): Promise<SendResult> {
    if (!templateName?.trim()) throw new AiSensyError('Template name is empty', 400, 'EMPTY_TEMPLATE');
    return this.sendRaw({ to, type: 'template', template: buildTemplatePayload(templateName.trim(), opts) });
  }

  // --------------------------------------------------------------- read APIs

  /** Project details — use as the "Test Connection" call (cheap, no message sent). */
  getProject(): Promise<AiSensyProject> {
    return this.request('GET', this.projectPath());
  }

  getMessage(messageId: string): Promise<Record<string, unknown>> {
    return this.request('GET', this.projectPath(`/messages/${encodeURIComponent(messageId)}`));
  }

  /** Creates (and auto-opts-in) a contact in AiSensy. */
  async createContact(name: string, mobile: string): Promise<Record<string, unknown>> {
    return this.request('POST', this.projectPath('/contact'), {
      name: name?.trim() || 'Customer',
      mobile_number: normalizePhone(mobile, this.cc),
    });
  }

  /** Returns null when AiSensy has no contact for this number. */
  async getContactByMobile(mobile: string): Promise<Record<string, unknown> | null> {
    const qs = new URLSearchParams({ action: 'FetchContact', mobile_number: normalizePhone(mobile, this.cc) });
    try {
      return await this.request('GET', this.projectPath(`/contact?${qs.toString()}`));
    } catch (e) {
      if (e instanceof AiSensyError && e.status === 404) return null;
      throw e;
    }
  }

  /** Create-if-missing. Safe to call on every new lead. */
  async ensureContact(name: string, mobile: string): Promise<Record<string, unknown>> {
    return (await this.getContactByMobile(mobile)) ?? (await this.createContact(name, mobile));
  }

  /** All WhatsApp templates in the project (pages of 100 until exhausted). */
  async listTemplates(maxPages = 20): Promise<AiSensyTemplate[]> {
    const all: AiSensyTemplate[] = [];
    const seen = new Set<string>();
    let after: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const qs = new URLSearchParams({ limit: '100', ...(after ? { after } : {}) });
      const batch = await this.request<AiSensyTemplate[] | { template?: AiSensyTemplate[]; data?: AiSensyTemplate[]; size?: number; count?: number; paging?: any }>(
        'GET',
        this.projectPath(`/wa_template/?${qs.toString()}`),
      );
      // OBSERVED 2026-09-29 against the live project: the response is
      // `{ template: [...], size, count }` — not a bare array and not `data`,
      // which is what the docs-derived code assumed. That assumption made a
      // project holding 5 templates report ZERO, i.e. "nothing is approved"
      // when the truth was "nothing is approved AND we could not see them".
      // The other two shapes are kept because they cost nothing and a BSP
      // changing its envelope should degrade to fewer rows, never to silence.
      const rows = Array.isArray(batch)
        ? batch
        : Array.isArray(batch?.template)
          ? batch.template
          : Array.isArray(batch?.data)
            ? batch.data
            : [];
      let fresh = 0;
      for (const r of rows) {
        const key = String(r?.id ?? r?._id ?? `${r?.name}|${r?.language}`);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(r);
        fresh++;
      }
      const last = rows.length ? rows[rows.length - 1] : undefined;
      const lastId = last?.id ?? (last?._id as string | undefined);
      // Prefer a Meta-style paging cursor when present; stop if the API ignored the cursor
      // and handed back rows we already have (otherwise: 20 pages of duplicates).
      const next = (Array.isArray(batch) ? undefined : batch?.paging?.cursors?.after) ?? lastId;
      if (rows.length < 100 || !next || fresh === 0) break;
      after = String(next);
    }
    return all;
  }

  /** Webhook subscriptions of a Custom App (exact app name as created in AiSensy). */
  listWebhooks(appName: string): Promise<Array<Record<string, unknown>>> {
    const qs = new URLSearchParams({ app_name: appName });
    return this.request('GET', this.projectPath(`/webhook?${qs.toString()}`));
  }
}

export interface AiSensyProject {
  id?: string;
  name?: string;
  status?: string;
  sandbox?: boolean;
  active_plan?: string;
  wa_number?: string;
  wa_display_name?: string;
  wa_quality_rating?: string;
  wa_messaging_tier?: string;
  credit?: number;
  [k: string]: unknown;
}

export interface AiSensyTemplate {
  id?: string;
  name: string;
  label?: string;
  status?: string; // APPROVED | PENDING | REJECTED …
  type?: string; // TEXT | IMAGE | VIDEO | DOCUMENT …
  language?: string;
  text?: string;
  total_parameters?: number;
  [k: string]: unknown;
}

/** Builds the Cloud-API `template` object AiSensy expects. Exported for tests. */
export function buildTemplatePayload(name: string, opts: TemplateOptions = {}) {
  const components: Array<Record<string, unknown>> = [];

  if (opts.headerMedia) {
    const { kind, link, filename } = opts.headerMedia;
    const media: Record<string, string> = { link };
    if (kind === 'document' && filename) media.filename = filename;
    components.push({ type: 'header', parameters: [{ type: kind, [kind]: media }] });
  } else if (opts.headerTextParams?.length) {
    components.push({
      type: 'header',
      parameters: opts.headerTextParams.map((v) => ({ type: 'text', text: templateParam(v) })),
    });
  }

  if (opts.bodyParams?.length) {
    components.push({
      type: 'body',
      // WhatsApp rejects empty params (131008) → visible dash; newlines/tabs (132018) → space.
      parameters: opts.bodyParams.map((v) => ({ type: 'text', text: templateParam(v) })),
    });
  }

  for (const [idx, suffix] of Object.entries(opts.urlButtonParams ?? {})) {
    components.push({ type: 'button', sub_type: 'url', index: String(idx), parameters: [{ type: 'text', text: suffix }] });
  }
  for (const [idx, payload] of Object.entries(opts.quickReplyPayloads ?? {})) {
    components.push({ type: 'button', sub_type: 'quick_reply', index: String(idx), parameters: [{ type: 'payload', payload }] });
  }
  for (const [idx, code] of Object.entries(opts.couponCodes ?? {})) {
    components.push({ type: 'button', sub_type: 'copy_code', index: Number(idx), parameters: [{ type: 'coupon_code', coupon_code: code }] });
  }

  return {
    name,
    language: { policy: 'deterministic', code: opts.language?.trim() || 'en' },
    components,
  };
}
