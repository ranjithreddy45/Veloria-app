// ============================================================
// AI — personalized speed-to-lead first-response message.
// ------------------------------------------------------------
// Composes the sub-60s first WhatsApp message that runSpeedToLead sends to a
// brand-new lead. Instead of one generic line, it names the actual event and
// date and (when resolvable) softly references slot availability — while
// degrading GRACEFULLY to a deterministic static template whenever no LLM key
// is configured, the call errors/times out, or the output fails a sanity guard.
//
// Mirrors the LLM-first + static-fallback shape of src/lib/ai/sentiment.ts:
//   - gate on getAIProvider() (=== 'none' → static),
//   - try chatCompletionWithSystem with a tight, brand-safe system prompt,
//   - validate the output (length / no URLs / no rupee figures / no template
//     leak), and fall back to STATIC on any miss.
//
// Pure of DB IO: the slot-availability signal is INJECTED via `slotLikelyFree`
// (resolved by the caller through slot-availability-internal.ts), so this
// module never queries the database and stays trivially testable.
//
// SECURITY (see spec risks): the LLM writes a customer-facing message and lead
// free-text (eventType, name) feeds the prompt. Raw lead.description is NEVER
// passed. The hard output guard rejects URLs / price figures / over-length /
// template-leak markers so a malicious/garbage lead can't steer the copy.
// ============================================================

import {
  getAIProvider,
  chatCompletionWithSystem,
  getDefaultModel,
} from "@/lib/ai/openai-client";

export interface BuildAiFirstResponseArgs {
  firstName?: string | null;
  /** Free-text event type / occasion, e.g. "Wedding", "Corporate offsite". */
  eventType?: string | null;
  /** The requested event date (any Date) — formatted to IST in the copy. */
  eventDate?: Date | null;
  /** Human slot label, e.g. "Evening (5pm–10pm)" — display only. */
  slotLabel?: string | null;
  /**
   * Advisory availability signal from slot-availability-internal.ts:
   *   true  → "that date looks open!" (soft, never a promise),
   *   false → "let me double-check that date for you",
   *   null  → omit any availability claim (venue/date/slot unresolved).
   */
  slotLikelyFree?: boolean | null;
}

export interface BuildAiFirstResponseResult {
  text: string;
  method: "LLM" | "STATIC";
  slotLikelyFree: boolean | null;
}

// Hard cap so a synchronous LLM call inside runSpeedToLead can never blow the
// sub-60s speed-to-lead promise on a cold provider. On timeout → STATIC.
const LLM_TIMEOUT_MS = 3500;

// Output sanity bounds. Single WhatsApp paragraph, no links, no prices.
const MAX_OUTPUT_CHARS = 600;
const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|co)\b/i;
// Rupee figures: "₹50,000", "Rs. 5000", "INR 5000", "50000 rupees".
const PRICE_RE = /(₹|\bRs\.?\b|\bINR\b|\brupees?\b)/i;
const TEMPLATE_LEAK_RE = /\[(template|firstname|name|event|date|slot)/i;

// ------------------------------------------------------------
// IST date formatting (e.g. "14 Feb 2026"). Asia/Kolkata, no TZ drift.
// ------------------------------------------------------------
function formatEventDateIST(date?: Date | null): string | null {
  if (!date) return null;
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(t));
  } catch {
    return null;
  }
}

function cleanName(firstName?: string | null): string {
  const n = (firstName || "").trim();
  // First token only; strip anything non-name-ish to avoid prompt-steering.
  const token = n.split(/\s+/)[0] || "";
  return /^[\p{L}][\p{L}'.-]{0,40}$/u.test(token) ? token : "";
}

function cleanEventType(eventType?: string | null): string {
  const e = (eventType || "").trim();
  if (!e) return "";
  // Cap length and drop newlines (newlines-as-instructions guard).
  const flat = e.replace(/\s+/g, " ").slice(0, 60);
  // Reject anything that looks like an injected instruction / link / price.
  if (URL_RE.test(flat) || PRICE_RE.test(flat)) return "";
  return flat;
}

// ------------------------------------------------------------
// STATIC fallback — deterministic, always valid, names event/date when present.
// Exported as both the fallback and the unit-test anchor.
// ------------------------------------------------------------
export function buildStaticFirstResponse(
  args: BuildAiFirstResponseArgs
): string {
  const name = cleanName(args.firstName);
  const eventType = cleanEventType(args.eventType);
  const dateLabel = formatEventDateIST(args.eventDate ?? null);

  const hello = name ? `Hi ${name}` : "Hello";

  // Name the occasion + date when we have them; stay warm and on-brand.
  let eventClause = "your enquiry";
  if (eventType && dateLabel) {
    eventClause = `your ${eventType} on ${dateLabel}`;
  } else if (eventType) {
    eventClause = `your ${eventType}`;
  } else if (dateLabel) {
    eventClause = `your event on ${dateLabel}`;
  }

  let availability = "";
  if (args.slotLikelyFree === true) {
    availability = ` Good news — that date looks open! Our team will confirm shortly.`;
  } else if (args.slotLikelyFree === false) {
    availability = ` Let me double-check that date for you and get right back.`;
  }

  return (
    `${hello}, thanks for reaching out to Veloria Grand! 🎉 ` +
    `We've received ${eventClause} and one of our event consultants will reach you shortly.` +
    availability +
    ` For anything urgent, just reply to this message and we'll help right away.`
  );
}

// ------------------------------------------------------------
// Output guard — reject anything off-brand / unsafe → fall back to static.
// ------------------------------------------------------------
function passesSanityGuard(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.length > MAX_OUTPUT_CHARS) return false;
  if (URL_RE.test(t)) return false;
  if (PRICE_RE.test(t)) return false;
  if (TEMPLATE_LEAK_RE.test(t)) return false;
  return true;
}

function buildSystemPrompt(): string {
  return [
    "You are the warm, polished WhatsApp voice of Veloria Grand, a premium event venue in India.",
    "Write the FIRST reply to a brand-new enquiry. Audience: an Indian B2C customer on WhatsApp.",
    "Rules:",
    "- One short, warm paragraph. Plain text only. No markdown, no bullet points, no line breaks used as instructions.",
    "- 55 words or fewer.",
    "- Greet by first name if given. Warmly acknowledge their event type and event date if given.",
    "- If told the date 'looks open', say so softly and add that the team will confirm — NEVER promise or guarantee a booking.",
    "- If told to double-check the date, say you'll check and get right back.",
    "- NEVER mention prices, rupee amounts, discounts, internal notes, staff names, or any internal data.",
    "- NEVER include links, URLs, or phone numbers.",
    "- Close by inviting them to reply for anything urgent.",
    "Output ONLY the message text — no quotes, no preamble.",
  ].join("\n");
}

function buildUserPrompt(args: BuildAiFirstResponseArgs): string {
  const name = cleanName(args.firstName);
  const eventType = cleanEventType(args.eventType);
  const dateLabel = formatEventDateIST(args.eventDate ?? null);
  const slotLabel = (args.slotLabel || "").trim().slice(0, 40);

  const lines: string[] = [];
  lines.push(`First name: ${name || "(unknown)"}`);
  lines.push(`Event type: ${eventType || "(unknown)"}`);
  lines.push(`Event date: ${dateLabel || "(unknown)"}`);
  if (slotLabel) lines.push(`Requested slot: ${slotLabel}`);
  if (args.slotLikelyFree === true) {
    lines.push("Availability: that date looks open (say so softly; team will confirm).");
  } else if (args.slotLikelyFree === false) {
    lines.push("Availability: unverified — tell them you'll double-check the date.");
  } else {
    lines.push("Availability: unknown — do not mention availability at all.");
  }
  return lines.join("\n");
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("LLM_TIMEOUT")), ms)
    ),
  ]);
}

/**
 * Build the personalized first-response WhatsApp text. LLM-first with a hard
 * timeout + output guard, falling back to the deterministic static template on
 * any miss. Never throws — returns a usable string in every case.
 */
export async function buildAiFirstResponse(
  args: BuildAiFirstResponseArgs
): Promise<BuildAiFirstResponseResult> {
  const slotLikelyFree =
    args.slotLikelyFree === undefined ? null : args.slotLikelyFree;

  // Gate: no provider configured → deterministic static.
  if (getAIProvider() === "none") {
    return {
      text: buildStaticFirstResponse(args),
      method: "STATIC",
      slotLikelyFree,
    };
  }

  try {
    const raw = await withTimeout(
      chatCompletionWithSystem({
        system: buildSystemPrompt(),
        user: buildUserPrompt(args),
        model: getDefaultModel(),
        temperature: 0.6,
        maxTokens: 160,
      }),
      LLM_TIMEOUT_MS
    );

    const text = (raw || "").trim();
    // chatCompletionWithSystem returns "AI not configured" when no provider —
    // the guard rejects nothing special there, but the getAIProvider gate above
    // already handled that. Reject empty / off-brand / leaky output.
    if (text && text !== "AI not configured" && passesSanityGuard(text)) {
      return { text, method: "LLM", slotLikelyFree };
    }
  } catch (e) {
    console.error("[buildAiFirstResponse] LLM error — using static:", e);
  }

  return {
    text: buildStaticFirstResponse(args),
    method: "STATIC",
    slotLikelyFree,
  };
}
