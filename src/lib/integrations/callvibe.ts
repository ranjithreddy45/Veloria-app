// ============================================================
// CallVibe — AI conversation intelligence (api.callvibe.ai). Replaces Runo.
// ------------------------------------------------------------
// Verified against CallVibe's own published OpenAPI document
// (https://api.callvibe.ai/openapi.json — "Call Analytics API" 2.0.0):
//
//   Auth    POST /auth/signin   { email, password }      → bearer token
//           POST /auth/refresh  { refresh_token }
//           everything else:    Authorization: Bearer <token>
//   Calls   GET  /calls         ?limit&offset&start_date&end_date&agent
//                                &answered&inbound&recorded&search&…
//           GET  /calls/count   (same filters)
//   Audio   GET  /api/audio/signed-url/{call_id}?expiration_minutes
//   Leads   GET  /api/leads/{phone} · PUT /api/leads/{phone} (upsert)
//           POST /api/leads/{phone}/notes { note_text }
//   Tenant  GET  /api/tenant/info
//
// DIRECTION. CallVibe cannot push to a customer endpoint: its only outbound
// channels are Slack and email digests, and its "push delivery" pipeline
// targets the CRMs it ships with. So this integration PULLS on the cron lane.
// The one inbound door, POST /webhooks/calls/{tenant_id}?token=…, is for
// telephony vendors pushing call logs INTO CallVibe; pushCallLog() below wraps
// it for completeness but the sync does not need it.
//
// RESPONSE SHAPES ARE NOT PUBLISHED. CallVibe's FastAPI routes declare no
// response_model and its docs describe screens, not fields. Rather than guess
// one spelling, every read goes through pick()/normalizeCall(), which match a
// list of candidate keys case- and punctuation-insensitively, and
// testConnection() returns the raw keys of a real call so the mapping can be
// confirmed against a live account instead of assumed.
// ============================================================

const DEFAULT_BASE = "https://api.callvibe.ai";

export interface CallVibeCreds {
  /** API base. Same host for every tenant; overridable for staging. */
  baseUrl?: string | null;
  email: string;
  password: string;
}

export interface CallVibeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** HTTP status of the failing call, when there was one. */
  status?: number;
}

function apiBase(baseUrl?: string | null): string {
  const raw = (baseUrl || "").trim().replace(/\/+$/, "");
  return raw || DEFAULT_BASE;
}

// ---- token cache -------------------------------------------------------
// A bearer token is good for the life of the session; the sync runs every
// hour, so caching it keeps one sign-in per process rather than one per run.

interface CachedToken {
  token: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

const tokenCache = new Map<string, CachedToken>();

function cacheKey(creds: CallVibeCreds): string {
  return `${apiBase(creds.baseUrl)}|${creds.email.trim().toLowerCase()}`;
}

/** Drop a cached token — called on 401 so the next call signs in again. */
export function forgetCallVibeToken(creds: CallVibeCreds): void {
  tokenCache.delete(cacheKey(creds));
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.slice(0, 500) };
  }
}

function errorOf(status: number, body: unknown): string {
  const b = body as Record<string, unknown> | null;
  const detail = b?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as Record<string, unknown>;
    if (typeof first?.msg === "string") return first.msg;
  }
  return (
    (b?.message as string) ||
    (b?.error as string) ||
    (status === 401 ? "CallVibe rejected the credentials" : `CallVibe API error ${status}`)
  );
}

/** POST /auth/signin — the only way in; CallVibe issues no static API keys. */
async function signIn(creds: CallVibeCreds): Promise<CachedToken> {
  const res = await fetch(`${apiBase(creds.baseUrl)}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.email.trim(), password: creds.password }),
    cache: "no-store",
  });
  const body = await readJson(res);
  if (!res.ok) {
    const err = new Error(errorOf(res.status, body));
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const session = (b.session ?? b.data ?? {}) as Record<string, unknown>;
  const token =
    (b.access_token as string) ||
    (b.accessToken as string) ||
    (b.token as string) ||
    (session.access_token as string) ||
    (session.accessToken as string) ||
    "";
  if (!token) throw new Error("CallVibe signed in but returned no access token");

  const refreshToken =
    (b.refresh_token as string) ||
    (b.refreshToken as string) ||
    (session.refresh_token as string) ||
    undefined;

  const expiresIn =
    Number(b.expires_in ?? b.expiresIn ?? session.expires_in ?? session.expiresIn ?? 0) || 3600;

  return {
    token,
    refreshToken,
    // Refresh a minute early so a long sync never runs off the end of it.
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };
}

async function tokenFor(creds: CallVibeCreds): Promise<string> {
  const key = cacheKey(creds);
  const hit = tokenCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.token;
  const fresh = await signIn(creds);
  tokenCache.set(key, fresh);
  return fresh.token;
}

/**
 * One authenticated request. Signs in on demand and retries exactly once on a
 * 401, which is what an expired session looks like.
 */
async function request<T>(
  creds: CallVibeCreds,
  path: string,
  init: RequestInit = {},
  retrying = false
): Promise<CallVibeResult<T>> {
  try {
    const token = await tokenFor(creds);
    const res = await fetch(`${apiBase(creds.baseUrl)}${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    });

    if (res.status === 401 && !retrying) {
      forgetCallVibeToken(creds);
      return request<T>(creds, path, init, true);
    }

    const body = await readJson(res);
    if (!res.ok) {
      return { success: false, error: errorOf(res.status, body), status: res.status };
    }
    return { success: true, data: body as T };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "CallVibe request failed" };
  }
}

// ---- tolerant field reading -------------------------------------------

type Raw = Record<string, unknown>;

const flatten = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

function keyMap(obj: Raw): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) m.set(flatten(k), v);
  return m;
}

function pick(map: Map<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = map.get(flatten(k));
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

const asStr = (v: unknown): string | null =>
  typeof v === "string" ? v.trim() || null : typeof v === "number" ? String(v) : null;

const asNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "1", "y"].includes(s)) return true;
    if (["false", "no", "0", "n"].includes(s)) return false;
  }
  return null;
}

/** Seconds from a number, a numeric string, or "mm:ss" / "hh:mm:ss". */
function asSeconds(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Math.round(Number(s)));
    const parts = s.split(":").map((p) => Number(p));
    if (parts.length >= 2 && parts.every((p) => Number.isFinite(p))) {
      return parts.reduce((acc, p) => acc * 60 + p, 0);
    }
  }
  return 0;
}

function asDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Seconds vs milliseconds: anything below ~1e12 is seconds.
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Pull the array out of whatever envelope the endpoint used. */
export function extractList(body: unknown): Raw[] {
  if (Array.isArray(body)) return body as Raw[];
  const b = (body ?? {}) as Raw;
  for (const key of ["calls", "data", "items", "results", "records", "rows", "leads"]) {
    const v = b[key];
    if (Array.isArray(v)) return v as Raw[];
    if (v && typeof v === "object") {
      const inner = extractList(v);
      if (inner.length) return inner;
    }
  }
  return [];
}

export interface CallVibeCall {
  id: string;
  phone: string | null;
  agentName: string | null;
  agentEmail: string | null;
  inbound: boolean;
  answered: boolean;
  durationSeconds: number;
  startedAt: Date;
  recordingAvailable: boolean;
  recordingUrl: string | null;
  sentiment: string | null;
  sentimentScore: number | null;
  qualityScore: number | null;
  category: string | null;
  source: string | null;
  vendor: string | null;
  summary: string | null;
  transcript: string | null;
  actionItems: unknown;
  chapters: unknown;
  keyQuestions: unknown;
  issuesDiscussed: unknown;
  /** Every key the record actually carried — shown by the test action. */
  rawKeys: string[];
  raw: Raw;
}

function normalizeSentiment(v: unknown): string | null {
  const s = asStr(v);
  if (!s) return null;
  const u = s.toUpperCase();
  if (u.startsWith("POS")) return "POSITIVE";
  if (u.startsWith("NEG")) return "NEGATIVE";
  if (u.startsWith("NEU") || u.startsWith("NET")) return "NEUTRAL";
  return u.slice(0, 20);
}

/** Map one CallVibe call record onto the shape this app stores. */
export function normalizeCall(raw: Raw): CallVibeCall | null {
  const m = keyMap(raw);

  const id = asStr(pick(m, ["id", "call_id", "callId", "uuid", "_id", "callUuid", "external_id"]));
  if (!id) return null;

  const direction = asStr(pick(m, ["direction", "call_type", "callType", "type"]))?.toLowerCase();
  const inboundFlag = asBool(pick(m, ["inbound", "is_inbound", "isInbound", "incoming"]));
  const inbound =
    inboundFlag ?? (direction ? /^(in|inbound|incoming|received)/.test(direction) : false);

  const status = asStr(pick(m, ["status", "call_status", "callStatus", "disposition", "outcome"]));
  const answeredFlag = asBool(pick(m, ["answered", "is_answered", "isAnswered", "connected"]));
  const durationSeconds = asSeconds(
    pick(m, ["duration_seconds", "durationSeconds", "duration", "call_duration", "talk_time", "talktime"])
  );
  const answered =
    answeredFlag ??
    (status
      ? !/miss|no.?answer|unanswer|reject|fail|busy|cancel/i.test(status)
      : durationSeconds > 0);

  const recordingUrl = asStr(
    pick(m, ["recording_url", "recordingUrl", "audio_url", "audioUrl", "recording", "media_url"])
  );
  const recordingAvailable =
    asBool(pick(m, ["recorded", "is_recorded", "has_recording", "hasRecording"])) ??
    Boolean(recordingUrl);

  const startedAt =
    asDate(
      pick(m, [
        "call_time",
        "callTime",
        "start_time",
        "started_at",
        "startedAt",
        "call_date",
        "created_at",
        "createdAt",
        "timestamp",
        "date",
      ])
    ) ?? new Date();

  return {
    id,
    phone: asStr(
      pick(m, [
        "phone",
        "phone_number",
        "phoneNumber",
        "customer_phone",
        "customerPhone",
        "customer_number",
        "caller_number",
        "callerNumber",
        "number",
        "msisdn",
        "contact_number",
        "from_number",
        "to_number",
      ])
    ),
    agentName: asStr(pick(m, ["agent", "agent_name", "agentName", "user_name", "employee_name", "owner"])),
    agentEmail: asStr(pick(m, ["agent_email", "agentEmail", "user_email", "userEmail", "email"])),
    inbound,
    answered,
    durationSeconds,
    startedAt,
    recordingAvailable,
    recordingUrl,
    sentiment: normalizeSentiment(pick(m, ["sentiment", "sentiment_label", "overall_sentiment"])),
    sentimentScore: asNum(pick(m, ["sentiment_score", "sentimentScore"])),
    qualityScore: asNum(pick(m, ["quality_score", "qualityScore", "score", "call_score"])),
    category: asStr(pick(m, ["category", "call_category", "intent"])),
    source: asStr(pick(m, ["source", "lead_source", "marketing_source"])),
    vendor: asStr(pick(m, ["vendor", "provider", "telephony_vendor"])),
    summary: asStr(pick(m, ["summary", "call_summary", "ai_summary", "short_summary"])),
    transcript: asStr(pick(m, ["transcript", "transcription", "transcript_text", "full_transcript"])),
    actionItems: pick(m, ["action_items", "actionItems", "next_steps", "nextSteps"]) ?? null,
    chapters: pick(m, ["chapters", "segments"]) ?? null,
    keyQuestions: pick(m, ["key_questions", "keyQuestions", "questions"]) ?? null,
    issuesDiscussed: pick(m, ["key_issues_discussed", "issues_discussed", "issuesDiscussed", "topics"]) ?? null,
    rawKeys: Object.keys(raw),
    raw,
  };
}

/**
 * Phone format for CallVibe's lead endpoints, which key a lead by the phone in
 * the URL path. Digits only with a country code — a bare 10-digit Indian
 * mobile gets 91 — because a "+" in a path segment has to be escaped and not
 * every gateway does it consistently.
 */
export function toCallVibePhone(raw: string): string {
  let d = (raw || "").replace(/[^\d]/g, "").replace(/^0+/, "");
  if (/^[6-9]\d{9}$/.test(d)) d = "91" + d;
  return d;
}

// ---- public surface ----------------------------------------------------

export interface ListCallsParams {
  limit?: number;
  offset?: number;
  /** YYYY-MM-DD, as CallVibe's filters expect. */
  startDate?: string;
  endDate?: string;
  agent?: string;
  answered?: string;
  inbound?: string;
  recorded?: string;
  search?: string;
}

/** GET /calls — one page of call records, already normalized. */
export async function listCalls(
  creds: CallVibeCreds,
  params: ListCallsParams = {}
): Promise<CallVibeResult<{ calls: CallVibeCall[]; rawCount: number; sampleKeys: string[] }>> {
  const q = new URLSearchParams();
  q.set("limit", String(params.limit ?? 100));
  q.set("offset", String(params.offset ?? 0));
  if (params.startDate) q.set("start_date", params.startDate);
  if (params.endDate) q.set("end_date", params.endDate);
  if (params.agent) q.set("agent", params.agent);
  if (params.answered) q.set("answered", params.answered);
  if (params.inbound) q.set("inbound", params.inbound);
  if (params.recorded) q.set("recorded", params.recorded);
  if (params.search) q.set("search", params.search);

  const res = await request<unknown>(creds, `/calls?${q.toString()}`);
  if (!res.success) return { success: false, error: res.error, status: res.status };

  const rows = extractList(res.data);
  const calls = rows.map(normalizeCall).filter((c): c is CallVibeCall => c !== null);
  return {
    success: true,
    data: { calls, rawCount: rows.length, sampleKeys: rows[0] ? Object.keys(rows[0]) : [] },
  };
}

/** GET /api/audio/signed-url/{call_id} — a time-limited recording URL. */
export async function getRecordingUrl(
  creds: CallVibeCreds,
  callId: string,
  expirationMinutes = 60
): Promise<CallVibeResult<string>> {
  const res = await request<unknown>(
    creds,
    `/api/audio/signed-url/${encodeURIComponent(callId)}?expiration_minutes=${expirationMinutes}`
  );
  if (!res.success) return { success: false, error: res.error, status: res.status };
  const b = (res.data ?? {}) as Raw;
  const url =
    asStr(b.signed_url) || asStr(b.signedUrl) || asStr(b.url) || asStr(b.audio_url) || asStr(res.data);
  return url ? { success: true, data: url } : { success: false, error: "No URL in the response" };
}

export interface CallVibeLeadInput {
  name?: string | null;
  email?: string | null;
  status?: string | null;
  humanStatus?: string | null;
  assignedTo?: string | null;
  scheduledAt?: string | null;
  source?: string | null;
  customFields?: Record<string, unknown> | null;
}

/** PUT /api/leads/{phone} — upsert, so agents see this lead in their app. */
export async function upsertLead(
  creds: CallVibeCreds,
  phone: string,
  lead: CallVibeLeadInput
): Promise<CallVibeResult<unknown>> {
  const p = toCallVibePhone(phone);
  if (!p) return { success: false, error: "No usable phone number for this lead" };
  return request<unknown>(creds, `/api/leads/${encodeURIComponent(p)}`, {
    method: "PUT",
    body: JSON.stringify({
      name: lead.name ?? null,
      email: lead.email ?? null,
      status: lead.status ?? null,
      human_status: lead.humanStatus ?? null,
      assigned_to: lead.assignedTo ?? null,
      scheduled_at: lead.scheduledAt ?? null,
      source: lead.source ?? null,
      custom_fields: lead.customFields ?? null,
    }),
  });
}

/** POST /api/leads/{phone}/notes */
export async function addLeadNote(
  creds: CallVibeCreds,
  phone: string,
  noteText: string
): Promise<CallVibeResult<unknown>> {
  const p = toCallVibePhone(phone);
  if (!p) return { success: false, error: "No usable phone number for this lead" };
  return request<unknown>(creds, `/api/leads/${encodeURIComponent(p)}/notes`, {
    method: "POST",
    body: JSON.stringify({ note_text: noteText.slice(0, 4000) }),
  });
}

/** GET /api/tenant/info — also how an operator finds their tenant id. */
export async function getTenantInfo(creds: CallVibeCreds): Promise<CallVibeResult<Raw>> {
  return request<Raw>(creds, "/api/tenant/info");
}

/**
 * POST /webhooks/calls/{tenant_id}?token=… — the door telephony vendors push
 * call logs through. Unused by the sync; here so pushing Veloria's own call
 * records into CallVibe does not need a second client.
 */
export async function pushCallLog(
  baseUrl: string | null | undefined,
  tenantId: string,
  token: string | null | undefined,
  payload: unknown
): Promise<CallVibeResult<unknown>> {
  try {
    const q = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(
      `${apiBase(baseUrl)}/webhooks/calls/${encodeURIComponent(tenantId)}${q}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
    const body = await readJson(res);
    return res.ok
      ? { success: true, data: body }
      : { success: false, error: errorOf(res.status, body), status: res.status };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "CallVibe push failed" };
  }
}

export interface CallVibeConnectionReport {
  tenant: Raw | null;
  tenantId: string | null;
  callsSeen: number;
  /** The keys CallVibe actually returned, so the field mapping can be checked. */
  sampleKeys: string[];
  /** What this app read out of that sample. */
  sample: {
    id: string;
    phone: string | null;
    agent: string | null;
    direction: string;
    answered: boolean;
    durationSeconds: number;
    startedAt: string;
    hasRecording: boolean;
    hasTranscript: boolean;
    sentiment: string | null;
  } | null;
}

/**
 * Sign in, read the tenant, pull one call. Proves the credentials AND reports
 * the live field names, which is the only way to confirm the mapping — the
 * vendor publishes no response schema.
 */
export async function testConnection(
  creds: CallVibeCreds
): Promise<CallVibeResult<CallVibeConnectionReport>> {
  forgetCallVibeToken(creds);

  const tenant = await getTenantInfo(creds);
  if (!tenant.success) return { success: false, error: tenant.error, status: tenant.status };

  const calls = await listCalls(creds, { limit: 1 });
  if (!calls.success) return { success: false, error: calls.error, status: calls.status };

  const t = (tenant.data ?? {}) as Raw;
  const tm = keyMap(t);
  const first = calls.data?.calls[0] ?? null;

  return {
    success: true,
    data: {
      tenant: t,
      tenantId: asStr(pick(tm, ["tenant_id", "tenantId", "id", "tenant"])),
      callsSeen: calls.data?.rawCount ?? 0,
      sampleKeys: calls.data?.sampleKeys ?? [],
      sample: first
        ? {
            id: first.id,
            phone: first.phone,
            agent: first.agentName ?? first.agentEmail,
            direction: first.inbound ? "inbound" : "outbound",
            answered: first.answered,
            durationSeconds: first.durationSeconds,
            startedAt: first.startedAt.toISOString(),
            hasRecording: first.recordingAvailable,
            hasTranscript: Boolean(first.transcript),
            sentiment: first.sentiment,
          }
        : null,
    },
  };
}
