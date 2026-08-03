// ============================================================
// WATI provider — WhatsApp Business API via wati.io
// ------------------------------------------------------------
// Outbound template + session (free-text) messages. Returns the SAME shape as
// the Meta sender (`{ success, messageId, error }`) so sendWhatsApp() can branch
// on the configured provider transparently and none of the ~25 callers change.
//
// API base for a WATI tenant looks like:  https://live-mt-server.wati.io/<tenantId>
// Auth is a Bearer access token (WATI dashboard → Account → API Docs).
// Docs: https://docs.wati.io/reference
// ============================================================

export interface WatiCreds {
  /** Tenant API base, e.g. https://live-mt-server.wati.io/10217207 (with or
   *  without a trailing slash or /api/v1 suffix — normalised here). */
  endpoint: string;
  /** WATI access token (with or without a leading "Bearer "). */
  token: string;
}

export interface WatiResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Strip trailing slashes and any accidental /api/v1 suffix so we can append
 *  the versioned path exactly once. */
function apiBase(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}

function authHeaders(token: string): Record<string, string> {
  const t = token.trim();
  return {
    Authorization: t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`,
    "Content-Type": "application/json",
  };
}

/** WATI returns a WhatsApp message id in a couple of shapes across endpoints. */
function extractMessageId(data: unknown): string | undefined {
  const d = data as Record<string, unknown> | null;
  const msg = (d?.message ?? null) as Record<string, unknown> | null;
  return (
    (msg?.whatsappMessageId as string) ||
    (msg?.id as string) ||
    (d?.whatsappMessageId as string) ||
    (d?.id as string) ||
    undefined
  );
}

/** WATI can answer 200 with a logical failure body ({ ok:false } / result != "success"). */
function isOk(status: number, data: unknown): boolean {
  if (!status || status >= 400) return false;
  const d = data as Record<string, unknown> | null;
  if (d?.ok === false) return false;
  if (typeof d?.result === "string" && d.result.toLowerCase() !== "success") return false;
  if (typeof d?.validWhatsAppNumber === "boolean" && d.validWhatsAppNumber === false) return false;
  return true;
}

function errorOf(status: number, data: unknown): string {
  const d = data as Record<string, unknown> | null;
  return (
    (d?.info as string) ||
    (d?.message as string) ||
    (typeof d?.result === "string" ? (d.result as string) : "") ||
    (d?.error as string) ||
    `WATI API error ${status}`
  );
}

/**
 * Free-text message — only deliverable inside the 24h customer-service window.
 * `messageText` is a QUERY parameter per WATI's API (not a JSON body).
 */
export async function watiSendSession(
  creds: WatiCreds,
  to: string,
  message: string
): Promise<WatiResult> {
  try {
    const url =
      `${apiBase(creds.endpoint)}/api/v1/sendSessionMessage/${encodeURIComponent(to)}` +
      `?messageText=${encodeURIComponent(message)}`;
    const res = await fetch(url, { method: "POST", headers: authHeaders(creds.token) });
    const data = await res.json().catch(() => ({}));
    if (!isOk(res.status, data)) {
      console.error("[WATI] session send failed", res.status, JSON.stringify(data));
      return { success: false, error: errorOf(res.status, data) };
    }
    return { success: true, messageId: extractMessageId(data) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Pre-approved template message — the only thing deliverable OUTSIDE the 24h
 * window. Params are sent as WATI's named `{ name, value }` pairs; the caller's
 * `Record<string,string>` keys become the parameter names (so template
 * placeholders must match those keys, e.g. {{name}} ← params.name).
 */
export async function watiSendTemplate(
  creds: WatiCreds,
  to: string,
  templateName: string,
  params?: Record<string, string>
): Promise<WatiResult> {
  try {
    const parameters = params
      ? Object.entries(params).map(([name, value]) => ({ name, value: String(value ?? "") }))
      : [];
    const url =
      `${apiBase(creds.endpoint)}/api/v1/sendTemplateMessage` +
      `?whatsappNumber=${encodeURIComponent(to)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(creds.token),
      body: JSON.stringify({
        template_name: templateName,
        broadcast_name: templateName,
        parameters,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!isOk(res.status, data)) {
      console.error("[WATI] template send failed", res.status, JSON.stringify(data));
      return { success: false, error: errorOf(res.status, data) };
    }
    return { success: true, messageId: extractMessageId(data) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/**
 * Validate the endpoint + token with a cheap authenticated GET. Used by the
 * settings "Test connection" button.
 */
export async function watiTestConnection(
  creds: WatiCreds
): Promise<{ success: boolean; message: string }> {
  try {
    if (!creds.endpoint || !creds.token) {
      return { success: false, message: "WATI API endpoint and access token are both required." };
    }
    const url = `${apiBase(creds.endpoint)}/api/v1/getMessageTemplates?pageSize=1`;
    const res = await fetch(url, { headers: authHeaders(creds.token) });
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        message: "WATI rejected the access token (401/403). Re-copy the token from WATI → Account → API Docs.",
      };
    }
    if (!res.ok) {
      return { success: false, message: `WATI API error ${res.status}. Check the API endpoint URL.` };
    }
    return { success: true, message: "Connected to WATI successfully." };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
