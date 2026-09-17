import { apiBase, forgetCallVibeToken, tokenFor, type CallVibeCreds } from "@/lib/integrations/callvibe";
import { canonicalPhone } from "@/lib/phone";

// ============================================================
// CallVibe write client — pushing leads INTO CallVibe so agents can call them.
//
// The pull side (src/lib/integrations/callvibe.ts) imports calls. This module
// only writes, and reuses that file's session: the same saved account, the same
// signed-in token cache, the same base-URL handling. No second login.
//
// What is and isn't known about CallVibe's API (https://api.callvibe.ai/openapi.json):
//   CONFIRMED in the spec
//     PUT  /api/leads/{phone}        "Create or update a lead" — body:
//          name, email, status, human_status, assigned_to, scheduled_at,
//          source, custom_fields (all nullable)
//     POST /api/leads/{phone}/notes  { note_text }
//     GET  /agent-list               described as [{ name, phone }]
//     422  { detail: [{ loc, msg, type }] } on validation failure
//   UNVERIFIED (the spec documents no response bodies and no other statuses)
//     - the phone format in the path (digits, as the existing code sends)
//     - what a successful response contains, including whether a lead has an id
//     - that an expired token answers 401, and that throttling answers 429
//     - which value assigned_to expects (an agent name is assumed)
// So every response is read defensively, and nothing here depends on a field
// CallVibe hasn't been seen to return.
//
// Every write is a PUT keyed by phone: CallVibe's own create-or-update. Pushing
// the same contact twice updates one lead — a duplicate can't be created.
// ============================================================

export type CallVibeErrorKind =
  | "not_configured"
  | "invalid_phone"
  | "unknown_agent"
  | "duplicate"
  | "validation"
  | "not_found"
  | "auth"
  | "rate_limited"
  | "server"
  | "timeout"
  | "network";

export interface CallVibeWriteError {
  kind: CallVibeErrorKind;
  /** Readable, safe to show a user. Never contains a token or password. */
  message: string;
  status?: number;
  /** Whether trying again later could succeed. */
  retryable: boolean;
  /** CallVibe's Retry-After, when it sent one. */
  retryAfterMs?: number;
}

export type WriteResult<T> = { ok: true; status: number; data: T } | { ok: false; error: CallVibeWriteError };

export interface CallVibeLeadPayload {
  name?: string | null;
  email?: string | null;
  status?: string | null;
  humanStatus?: string | null;
  assignedTo?: string | null;
  scheduledAt?: string | null;
  source?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface UpsertedLead {
  /** CallVibe's id for the lead, if the response carried one (unverified that it does). */
  leadId: string | null;
  /** Top-level field names CallVibe returned — shown by "Send test lead" so the shape can be confirmed. */
  responseKeys: string[];
  raw: unknown;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_AFTER_MS = 30_000;

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// ------------------------------------------------------------ phone

/**
 * A phone number in E.164 ("+919876543210"), or null when it can't be one.
 * An Indian mobile written any common way is recognised; any other number must
 * already carry its country code — guessing one would push a stranger's number.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const canon = canonicalPhone(raw);
  if (!canon.startsWith("+")) return null;
  const digits = canon.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return null;
  // +91 numbers are 10 digits; mobiles and landlines (with STD code) alike.
  if (digits.startsWith("91") && !/^91[1-9]\d{9}$/.test(digits)) return null;
  return canon;
}

/**
 * The path segment CallVibe is sent: the E.164 digits without "+", which is
 * what the existing lead button sent for every Indian number. Not re-guessed
 * through toCallVibePhone — that would turn +65 9123 4567 into an Indian number.
 */
export function callVibePathPhone(e164: string): string {
  return encodeURIComponent(e164.replace(/^\+/, ""));
}

// ------------------------------------------------------------ throttle

let nextSlot = 0;

/**
 * Space requests out within this process. CallVibe publishes no rate limit, so
 * this is a courtesy floor (CALLVIBE_PUSH_MIN_INTERVAL_MS, default 250ms) — the
 * real signal is a 429, which is honoured separately.
 */
async function throttle(): Promise<void> {
  const interval = intEnv("CALLVIBE_PUSH_MIN_INTERVAL_MS", 250);
  if (interval === 0) return;
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + interval;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// ------------------------------------------------------------ errors

/** Retry-After as milliseconds: seconds, or an HTTP date. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
}

interface DetailItem {
  loc?: unknown[];
  msg?: unknown;
}

/**
 * Turn CallVibe's validation response into one readable sentence. CallVibe is
 * FastAPI, so 422 carries { detail: [{ loc, msg }] }; a plain { detail: "..." }
 * or { message } is handled too.
 */
export function describeValidationError(status: number, body: unknown, context: { assignedTo?: string | null } = {}): CallVibeWriteError {
  const b = (body ?? {}) as Record<string, unknown>;
  const items: DetailItem[] = Array.isArray(b.detail) ? (b.detail as DetailItem[]) : [];
  const text =
    typeof b.detail === "string"
      ? b.detail
      : items.map((d) => String(d.msg ?? "")).filter(Boolean).join("; ") ||
        (typeof b.message === "string" ? b.message : "") ||
        (typeof b.error === "string" ? b.error : "");
  const fields = items.flatMap((d) => (Array.isArray(d.loc) ? d.loc.map(String) : []));
  const lower = `${text} ${fields.join(" ")}`.toLowerCase();

  if (fields.includes("phone") || /\bphone\b|mobile|number format/.test(lower)) {
    return { kind: "invalid_phone", status, retryable: false, message: `CallVibe rejected the phone number${text ? `: ${text}` : "."}` };
  }
  if (fields.includes("assigned_to") || /\bagent\b|assign/.test(lower)) {
    const who = context.assignedTo ? ` "${context.assignedTo}"` : "";
    return { kind: "unknown_agent", status, retryable: false, message: `CallVibe doesn't recognise the agent${who}${text ? `: ${text}` : "."}` };
  }
  if (status === 409 || /already exists|duplicate/.test(lower)) {
    return { kind: "duplicate", status, retryable: false, message: `CallVibe already has this lead${text ? `: ${text}` : "."}` };
  }
  const readable = items.length
    ? items
        .map((d) => {
          const field = Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1] ?? "") : "";
          return field && field !== "body" ? `${field.replace(/_/g, " ")}: ${String(d.msg ?? "invalid")}` : String(d.msg ?? "invalid");
        })
        .join("; ")
    : text;
  return { kind: "validation", status, retryable: false, message: `CallVibe rejected the lead${readable ? `: ${readable}` : ` (HTTP ${status}).`}` };
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.slice(0, 500) };
  }
}

// ------------------------------------------------------------ transport

class SignInTimeout extends Error {}

/** The shared sign-in has no timeout of its own, and the pull code is not ours to change. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SignInTimeout()), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function send(
  creds: CallVibeCreds,
  method: "GET" | "PUT" | "POST",
  path: string,
  body?: unknown,
  context: { assignedTo?: string | null } = {}
): Promise<WriteResult<unknown>> {
  const timeoutMs = intEnv("CALLVIBE_PUSH_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);

  for (let attempt = 0; attempt < 2; attempt++) {
    const reauthenticated = attempt === 1;
    await throttle();

    let token: string;
    try {
      token = await withTimeout(tokenFor(creds), timeoutMs);
    } catch (e) {
      if (e instanceof SignInTimeout) {
        return { ok: false, error: { kind: "timeout", retryable: true, message: `CallVibe sign-in didn't answer within ${Math.round(timeoutMs / 1000)}s.` } };
      }
      return { ok: false, error: signInError(e) };
    }

    let res: Response;
    try {
      res = await fetch(`${apiBase(creds.baseUrl)}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        return { ok: false, error: { kind: "timeout", retryable: true, message: `CallVibe didn't answer within ${Math.round(timeoutMs / 1000)}s.` } };
      }
      return { ok: false, error: { kind: "network", retryable: true, message: "Couldn't reach CallVibe. Check the API address, or try again shortly." } };
    }

    // An expired or revoked session: sign in again once, then retry the request.
    if (res.status === 401 && !reauthenticated) {
      forgetCallVibeToken(creds);
      continue;
    }

    const data = await readBody(res);
    if (res.ok) return { ok: true, status: res.status, data };

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: { kind: "auth", status: res.status, retryable: false, message: "CallVibe rejected the saved account. Check the email and password in the CallVibe settings." },
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        error: {
          kind: "rate_limited",
          status: 429,
          retryable: true,
          retryAfterMs: parseRetryAfter(res.headers.get("retry-after")) ?? DEFAULT_RETRY_AFTER_MS,
          message: "CallVibe is limiting requests right now. The push will be retried.",
        },
      };
    }
    if (res.status === 404) {
      return { ok: false, error: { kind: "not_found", status: 404, retryable: false, message: "CallVibe has no such lead." } };
    }
    if (res.status >= 500) {
      return { ok: false, error: { kind: "server", status: res.status, retryable: true, message: `CallVibe had a problem (HTTP ${res.status}). The push will be retried.` } };
    }
    return { ok: false, error: describeValidationError(res.status, data, context) };
  }
  // Unreachable: the second pass always returns.
  return { ok: false, error: { kind: "auth", retryable: false, message: "CallVibe rejected the saved account." } };
}

function signInError(e: unknown): CallVibeWriteError {
  const status = (e as { status?: number })?.status;
  if (status === 429) {
    return { kind: "rate_limited", status, retryable: true, retryAfterMs: DEFAULT_RETRY_AFTER_MS, message: "CallVibe is limiting sign-ins right now. The push will be retried." };
  }
  if (status && status >= 500) {
    return { kind: "server", status, retryable: true, message: `CallVibe sign-in failed (HTTP ${status}). The push will be retried.` };
  }
  if (!status) {
    return { kind: "network", retryable: true, message: "Couldn't sign in to CallVibe. Check the API address, or try again shortly." };
  }
  return { kind: "auth", status, retryable: false, message: "CallVibe rejected the saved account. Check the email and password in the CallVibe settings." };
}

// ------------------------------------------------------------ operations

/** A lead id from an undocumented response, if there is one. */
export function extractLeadId(body: unknown): string | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const nested = [b, b.lead, b.data, b.profile, b.lead_profile].filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  for (const o of nested) {
    for (const k of ["id", "lead_id", "leadId", "profile_id"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
  }
  return null;
}

/**
 * The PUT body. Only fields the caller set are sent: whether CallVibe treats an
 * explicit null as "clear" is unverified, and fields like status are worked by
 * agents inside CallVibe, so a push must never blank them by omission.
 */
export function leadBody(lead: CallVibeLeadPayload): Record<string, unknown> {
  const fields: [string, unknown][] = [
    ["name", lead.name],
    ["email", lead.email],
    ["status", lead.status],
    ["human_status", lead.humanStatus],
    ["assigned_to", lead.assignedTo],
    ["scheduled_at", lead.scheduledAt],
    ["source", lead.source],
    ["custom_fields", lead.customFields],
  ];
  return Object.fromEntries(fields.filter(([, v]) => v !== undefined));
}

/** PUT /api/leads/{phone} — create the lead, or update the one that phone already has. */
export async function upsertLeadByPhone(
  creds: CallVibeCreds,
  e164: string,
  lead: CallVibeLeadPayload
): Promise<WriteResult<UpsertedLead>> {
  const r = await send(
    creds,
    "PUT",
    `/api/leads/${callVibePathPhone(e164)}`,
    leadBody(lead),
    { assignedTo: lead.assignedTo }
  );
  if (!r.ok) return r;
  const keys = r.data && typeof r.data === "object" && !Array.isArray(r.data) ? Object.keys(r.data as object) : [];
  return { ok: true, status: r.status, data: { leadId: extractLeadId(r.data), responseKeys: keys, raw: r.data } };
}

/** GET /api/leads/{phone}. A 404 comes back as kind "not_found" (unverified that CallVibe uses 404). */
export async function getLeadByPhone(creds: CallVibeCreds, e164: string): Promise<WriteResult<unknown>> {
  return send(creds, "GET", `/api/leads/${callVibePathPhone(e164)}`);
}

/** POST /api/leads/{phone}/notes. */
export async function addLeadNote(creds: CallVibeCreds, e164: string, text: string): Promise<WriteResult<unknown>> {
  return send(creds, "POST", `/api/leads/${callVibePathPhone(e164)}/notes`, { note_text: text.slice(0, 4000) });
}

/**
 * GET /agent-list → agent names. Returns null when no names can be read from
 * the response (not the documented [{ name, phone }] shape, or empty), so the
 * caller skips the check instead of refusing every push.
 */
export async function listAgentNames(creds: CallVibeCreds): Promise<WriteResult<string[] | null>> {
  const r = await send(creds, "GET", "/agent-list");
  if (!r.ok) return r;
  const b = r.data as unknown;
  const arr = Array.isArray(b)
    ? b
    : b && typeof b === "object"
      ? ((b as Record<string, unknown>).agents ?? (b as Record<string, unknown>).data ?? (b as Record<string, unknown>).items)
      : null;
  if (!Array.isArray(arr)) return { ok: true, status: r.status, data: null };
  const names = arr
    .map((a) => (typeof a === "string" ? a : a && typeof a === "object" ? (a as Record<string, unknown>).name : null))
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .map((n) => n.trim());
  // No readable names (an empty list, or entries without "name") can't be told
  // apart from a shape we don't know, so don't let it veto every assignment.
  if (names.length === 0) return { ok: true, status: r.status, data: null };
  return { ok: true, status: r.status, data: names };
}

/** Test hook: reset the per-process throttle. */
export function resetCallVibeThrottle(): void {
  nextSlot = 0;
}
