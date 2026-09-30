// ============================================================
// WhatsApp failure reasons — the text stored in WhatsAppMessage.failureReason
// ------------------------------------------------------------
// Every path that records a failed WhatsApp send writes its reason through
// formatWhatsAppFailure(), so the console says WHY a message failed instead of
// a bare "FAILED" (a provider outage once ran for weeks behind rows like that).
//
// The text comes from providers, so it is treated as untrusted: whitespace is
// collapsed, anything that looks like a credential is redacted, and the result
// is capped. Pure and dependency-free, so it is safe to import from anywhere.
// ============================================================

/** Stored when a send failed and nothing said why. */
export const WHATSAPP_FAILURE_FALLBACK = "Send failed (no reason returned by provider)";

/** The column is TEXT, but the console shows the reason inline. */
export const WHATSAPP_FAILURE_MAX_LENGTH = 500;

const REDACTED = "[REDACTED]";

// A key whose value is a credential: token, access_token, verifyToken,
// password, apiPassword, X-AiSensy-Project-API-Pwd, client_secret, apiKey …
const SECRET_KEY = String.raw`[\w-]*(?:token|password|passwd|pwd|secret|api[_-]?key)`;

const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Quoted JSON / header dumps: "apiPassword":"…", 'x-api-key': '…'
  [new RegExp(String.raw`(["']${SECRET_KEY}["']\s*:\s*["'])[^"']*(["'])`, "gi"), `$1${REDACTED}$2`],
  // Query strings and assignments: ?token=…, &access_token=…, password=…
  [new RegExp(String.raw`\b(${SECRET_KEY})=[^\s&"',;]+`, "gi"), `$1=${REDACTED}`],
  // Authorization schemes: "Bearer EAAG…", "Basic dXNlcjpw…" — but not a plain
  // lower-case word ("Basic authentication failed"), hence no `i` flag here.
  [/\b([Bb]earer|[Bb]asic|BEARER|BASIC)\s+(?![a-z]+\b)[A-Za-z0-9\-._~+/]{8,}=*/g, `$1 ${REDACTED}`],
  // Raw header lines: "X-AiSensy-Project-API-Pwd: …", "Authorization: …"
  [
    /\b(x-aisensy-project-api-pwd|x-api-key|api-key|authorization)(\s*:\s*)(?!(?:Bearer|Basic)\s)[^\s"',;]+/gi,
    `$1$2${REDACTED}`,
  ],
  // Credentials inside a URL: https://user:pass@host
  [/(\bhttps?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`],
  // Weflux API keys: wfx_live_… / wfx_test_…
  [/\bwfx_[A-Za-z0-9_]{6,}/g, REDACTED],
  // JSON Web Tokens
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+)?/g, REDACTED],
  // Long opaque secrets (hex keys, Meta EAA… tokens): 32+ letters AND digits in
  // one run. Words, template names (snake_case) and URL paths never match.
  [/\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{32,}\b/g, REDACTED],
];

function textOf(error: unknown, depth = 0): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") return String(error);
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && depth < 2) {
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (o.error != null) {
      const nested = textOf(o.error, depth + 1);
      if (nested.trim()) return nested;
    }
  }
  try {
    return JSON.stringify(error) ?? "";
  } catch {
    return String(error);
  }
}

/**
 * The failure reason to store for a WhatsApp send: one trimmed line, anything
 * credential-like redacted, at most WHATSAPP_FAILURE_MAX_LENGTH characters, and
 * WHATSAPP_FAILURE_FALLBACK when there is nothing to say. Accepts a provider
 * error string, an Error, or an error-shaped object. `secrets` are exact values
 * (e.g. the configured API password) that must never appear in the result.
 * Idempotent: a formatted reason comes back unchanged.
 */
export function formatWhatsAppFailure(
  error: unknown,
  opts: { secrets?: ReadonlyArray<string | null | undefined> } = {}
): string {
  let text = textOf(error);
  for (const secret of opts.secrets ?? []) {
    const s = secret?.trim();
    if (s && s.length >= 4) text = text.split(s).join(REDACTED);
  }
  text = text.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  if (!text) return WHATSAPP_FAILURE_FALLBACK;
  return text.length > WHATSAPP_FAILURE_MAX_LENGTH
    ? `${text.slice(0, WHATSAPP_FAILURE_MAX_LENGTH - 1).trimEnd()}…`
    : text;
}
