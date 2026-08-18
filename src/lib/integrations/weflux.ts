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

import { toPositionalVars } from "@/lib/whatsapp/template-vars";

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

// Weflux public REST API base (per the CRM integration spec). The API key
// identifies the workspace, so the host is the same for everyone.
const DEFAULT_BASE = "https://app.weflux.in/api/public/v1";

/** Normalise the base: default host, strip trailing slashes. A custom endpoint
 *  is used verbatim (minus any trailing slash). */
function apiBase(endpoint?: string | null): string {
  const raw = (endpoint || "").trim().replace(/\/+$/, "");
  return raw || DEFAULT_BASE;
}

function authHeaders(token: string): Record<string, string> {
  const t = token.trim();
  return {
    Authorization: t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`,
    "Content-Type": "application/json",
  };
}

/** Weflux's public API keys the recipient by digits-with-country-code (no "+"),
 *  e.g. 919812345678. A bare 10-digit Indian mobile gets a 91 prefix. */
function toPhone(to: string): string {
  let d = (to || "").replace(/[^\d]/g, "").replace(/^0+/, "");
  if (/^[6-9]\d{9}$/.test(d)) d = "91" + d;
  return d;
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
    // Meta only supports POSITIONAL placeholders; map the named params to their
    // authoritative order ({{1}},{{2}},…) before sending.
    const { object: positional } = toPositionalVars(templateName, params);
    const res = await fetch(`${apiBase(creds.endpoint)}/messages`, {
      method: "POST",
      headers: authHeaders(creds.token),
      body: JSON.stringify({
        phone: toPhone(to),
        template: { name: templateName },
        language: "en",
        variables: positional,
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

/** Free-text message — only deliverable inside the 24h customer-service window.
 *  Weflux returns `window_closed` (rather than a downstream failure) when the
 *  window has lapsed; we surface that as a clear, actionable error. */
export async function wefluxSendText(
  creds: WefluxCreds,
  to: string,
  message: string
): Promise<WefluxResult> {
  try {
    const res = await fetch(`${apiBase(creds.endpoint)}/messages`, {
      method: "POST",
      headers: authHeaders(creds.token),
      body: JSON.stringify({ phone: toPhone(to), text: message }),
    });
    const data = await res.json().catch(() => ({}));
    // 24h-window guard — Weflux signals this in the body rather than failing.
    if (JSON.stringify(data).includes("window_closed")) {
      return {
        success: false,
        error: "24-hour window closed — send an approved template instead of free text.",
      };
    }
    if (!res.ok) {
      console.error("[Weflux] text send failed", res.status, JSON.stringify(data));
      return { success: false, error: errorOf(res.status, data) };
    }
    return { success: true, messageId: extractMessageId(data) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Validate the key with a cheap authenticated GET (contacts lookup). A 401/403
 *  means the key is wrong; other responses mean the endpoint is reachable. */
export async function wefluxTestConnection(
  creds: WefluxCreds
): Promise<{ success: boolean; message: string }> {
  try {
    if (!creds.token) {
      return { success: false, message: "Weflux API key is required." };
    }
    const res = await fetch(`${apiBase(creds.endpoint)}/contacts?phone=910000000000`, {
      headers: authHeaders(creds.token),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        message: "Weflux rejected the API key (401/403). Re-copy it from your weflux workspace (API keys).",
      };
    }
    if (res.status === 404) {
      // Auth passed, contact simply not found — the key + endpoint are good.
      return { success: true, message: "Connected to Weflux successfully." };
    }
    if (res.ok) {
      return { success: true, message: "Connected to Weflux successfully." };
    }
    return {
      success: true,
      message: `Weflux reachable (endpoint responded ${res.status}). Send a test message to fully confirm.`,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
