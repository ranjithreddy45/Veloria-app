// ============================================================
// Weflux provider — WhatsApp Business API via weflux (bulkmessagesender.com)
// ------------------------------------------------------------
// Weflux is a Meta-approved BSP with its own REST API. Returns the SAME shape
// as the Meta sender (`{ success, messageId, error }`) so sendWhatsApp() can
// branch on the configured provider transparently — none of the ~25 callers
// change.
//
// Confirmed from the weflux API reference (api.weflux.in/v2):
//   • Auth:     Authorization: Bearer <wfx_live_… key>
//   • Send:     POST /v2/messages
//   • Template: { to:"+E164", template:"name", language:"en", vars:{...} }
//   • Recipient is E.164 WITH a leading "+".
// The plain-text body shape ({ to, text }) is inferred by symmetry and may be
// adjusted once confirmed against a live send.
// ============================================================

export interface WefluxCreds {
  /** API base, defaults to https://api.weflux.in/v2 (a fixed host for all
   *  weflux workspaces — the key identifies the workspace). Overridable. */
  endpoint?: string | null;
  /** weflux API key (wfx_live_…), with or without a leading "Bearer ". */
  token: string;
}

export interface WefluxResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const DEFAULT_BASE = "https://api.weflux.in/v2";

/** Normalise the base: default host, strip trailing slashes, tolerate a value
 *  entered with or without the /v2 suffix. */
function apiBase(endpoint?: string | null): string {
  const raw = (endpoint || "").trim().replace(/\/+$/, "");
  if (!raw) return DEFAULT_BASE;
  return /\/v\d+$/i.test(raw) ? raw : `${raw}/v2`;
}

function authHeaders(token: string): Record<string, string> {
  const t = token.trim();
  return {
    Authorization: t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`,
    "Content-Type": "application/json",
  };
}

/** weflux wants the recipient in E.164 with a leading "+". */
function toE164(to: string): string {
  const digits = to.trim().replace(/^\+/, "");
  return `+${digits}`;
}

function extractMessageId(data: unknown): string | undefined {
  const d = data as Record<string, unknown> | null;
  const msg = (d?.message ?? null) as Record<string, unknown> | null;
  return (
    (d?.id as string) ||
    (d?.messageId as string) ||
    (d?.message_id as string) ||
    (msg?.id as string) ||
    undefined
  );
}

function errorOf(status: number, data: unknown): string {
  const d = data as Record<string, unknown> | null;
  const err = (d?.error ?? null) as Record<string, unknown> | string | null;
  if (typeof err === "string") return err;
  return (
    (err?.message as string) ||
    (d?.message as string) ||
    (d?.detail as string) ||
    `Weflux API error ${status}`
  );
}

/** Pre-approved template message — the only thing deliverable OUTSIDE the 24h
 *  window. The caller's `Record<string,string>` params become weflux `vars`,
 *  so template placeholders must match those keys. */
export async function wefluxSendTemplate(
  creds: WefluxCreds,
  to: string,
  templateName: string,
  params?: Record<string, string>
): Promise<WefluxResult> {
  try {
    const res = await fetch(`${apiBase(creds.endpoint)}/messages`, {
      method: "POST",
      headers: authHeaders(creds.token),
      body: JSON.stringify({
        to: toE164(to),
        template: templateName,
        language: "en",
        vars: params ?? {},
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[Weflux] template send failed", res.status, JSON.stringify(data));
      return { success: false, error: errorOf(res.status, data) };
    }
    return { success: true, messageId: extractMessageId(data) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Free-text message — only deliverable inside the 24h customer-service window. */
export async function wefluxSendText(
  creds: WefluxCreds,
  to: string,
  message: string
): Promise<WefluxResult> {
  try {
    const res = await fetch(`${apiBase(creds.endpoint)}/messages`, {
      method: "POST",
      headers: authHeaders(creds.token),
      body: JSON.stringify({ to: toE164(to), text: message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[Weflux] text send failed", res.status, JSON.stringify(data));
      return { success: false, error: errorOf(res.status, data) };
    }
    return { success: true, messageId: extractMessageId(data) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Validate the key with a cheap authenticated GET. A 401/403 means the key is
 *  wrong; other responses mean the endpoint is reachable. */
export async function wefluxTestConnection(
  creds: WefluxCreds
): Promise<{ success: boolean; message: string }> {
  try {
    if (!creds.token) {
      return { success: false, message: "Weflux API key is required." };
    }
    const res = await fetch(`${apiBase(creds.endpoint)}/templates`, {
      headers: authHeaders(creds.token),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        message: "Weflux rejected the API key (401/403). Re-copy it from your weflux workspace.",
      };
    }
    if (res.ok) {
      return { success: true, message: "Connected to Weflux successfully." };
    }
    // Reachable but unexpected status — key auth wasn't rejected, so it's likely
    // fine; the true proof is a live send.
    return {
      success: true,
      message: `Weflux reachable (endpoint responded ${res.status}). Send a test message to fully confirm.`,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
