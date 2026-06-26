// ============================================================
// AI — WhatsApp reply co-pilot (1–3 tone-labelled draft variants).
// ------------------------------------------------------------
// Generates context-aware reply suggestions for a rep inside the /whatsapp
// console, from the recent conversation + a non-sensitive lead headline
// (occasion / date / slot). Clones the LLM-first + static-fallback shape of
// src/lib/ai/sentiment.ts and first-response-message.ts:
//   - gate on getAIProvider() (=== 'none' → deterministic fallback variants),
//   - try chatCompletionJSON<{variants:[]}> with a tight venue-sales system
//     prompt, validate, and fall back to STATIC on any miss,
//   - NEVER throw — always returns a usable set of variants.
//
// SECURITY (see spec risks): the inbound customer text feeds the prompt, but
// the output is INERT text the rep must explicitly review + send — a hostile
// message can't trigger an action. We pass only conversation text + a
// non-sensitive lead headline; NEVER payment/financial data. Output is capped
// and stripped of links/prices so a malicious message can't steer the copy.
// ============================================================

import {
  getAIProvider,
  getDefaultModel,
  chatCompletionJSON,
} from "@/lib/ai/openai-client";

// ------------------------------------------------------------
// Public shapes
// ------------------------------------------------------------

export interface CopilotRecentMessage {
  direction: "INBOUND" | "OUTBOUND";
  /** Already-humanized, plain-text message line. */
  text: string;
}

export interface CopilotLeadHeadline {
  firstName?: string | null;
  /** Free-text occasion / event type, e.g. "Wedding". */
  eventType?: string | null;
  /** Formatted event date label, e.g. "14 Feb 2026" (IST). */
  eventDateLabel?: string | null;
  /** Human slot label, e.g. "Dinner". */
  slotLabel?: string | null;
}

export interface GenerateWhatsAppReplyVariantsArgs {
  contactId: string;
  leadId?: string | null;
  /** Recent thread, oldest→newest, already humanized. */
  recentMessages: CopilotRecentMessage[];
  /** True when the 24h customer-service window is open (free-text allowed). */
  sessionOpen: boolean;
  /** Non-sensitive lead headline for personalization (no money). */
  lead?: CopilotLeadHeadline | null;
}

export interface ReplyVariant {
  /** Short tone label, e.g. "Warm", "Direct", "Date-nudge". */
  tone: string;
  /** The suggested reply text (plain WhatsApp prose). */
  text: string;
}

export interface GenerateWhatsAppReplyVariantsResult {
  variants: ReplyVariant[];
  /** AI provider used: openai | groq | gemini | none. */
  model: string;
}

// ------------------------------------------------------------
// Output bounds — concise WhatsApp prose, no links, no prices.
// ------------------------------------------------------------

const MAX_VARIANT_CHARS = 600;
const MAX_VARIANTS = 3;
const LLM_TIMEOUT_MS = 6000;
const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|co)\b/i;
const PRICE_RE = /(₹|\bRs\.?\b|\bINR\b|\brupees?\b)/i;

function cleanName(firstName?: string | null): string {
  const token = (firstName || "").trim().split(/\s+/)[0] || "";
  return /^[\p{L}][\p{L}'.-]{0,40}$/u.test(token) ? token : "";
}

function cleanFreeText(value?: string | null, cap = 60): string {
  const flat = (value || "").replace(/\s+/g, " ").trim().slice(0, cap);
  if (URL_RE.test(flat) || PRICE_RE.test(flat)) return "";
  return flat;
}

/** Reject off-brand / unsafe variant text → drop it. */
function passesGuard(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.length > MAX_VARIANT_CHARS) return false;
  if (URL_RE.test(t)) return false;
  if (PRICE_RE.test(t)) return false;
  return true;
}

// ------------------------------------------------------------
// STATIC fallback — deterministic, always-valid variants.
// Acknowledge + ask event date + offer to share a quote. When the session is
// closed, bias toward a template-friendly framing (the rep will pick a template
// in the UI; these read as a re-engagement nudge).
// ------------------------------------------------------------

export function buildFallbackVariants(
  args: GenerateWhatsAppReplyVariantsArgs
): ReplyVariant[] {
  const name = cleanName(args.lead?.firstName);
  const eventType = cleanFreeText(args.lead?.eventType);
  const dateLabel = cleanFreeText(args.lead?.eventDateLabel, 30);
  const hello = name ? `Hi ${name}` : "Hi";

  const occasion = eventType ? `your ${eventType}` : "your event";
  const dateClause = dateLabel ? ` on ${dateLabel}` : "";

  if (!args.sessionOpen) {
    // Closed window → re-engagement framing (template-friendly).
    return [
      {
        tone: "Re-engage",
        text: `${hello}! Following up on ${occasion}${dateClause}. We'd love to help you plan it at Veloria Grand — shall we share the details?`,
      },
      {
        tone: "Warm",
        text: `${hello}, hope you're doing well! Just checking in about ${occasion}${dateClause}. Reply here and our team will assist you right away.`,
      },
    ];
  }

  return [
    {
      tone: "Warm",
      text: `${hello}! Thanks for your message. We'd be delighted to host ${occasion}${dateClause} at Veloria Grand. Could you confirm your preferred date and guest count so we can check availability?`,
    },
    {
      tone: "Direct",
      text: `${hello}, happy to help with ${occasion}. What date are you considering? I can confirm availability and share a tailored quote.`,
    },
    {
      tone: "Date-nudge",
      text: `${hello}! To hold the best slot for ${occasion}${dateClause}, may I confirm your event date? Dates fill up fast — I'll prioritise yours and send across a quote.`,
    },
  ];
}

// ------------------------------------------------------------
// Prompt builders
// ------------------------------------------------------------

function buildSystemPrompt(sessionOpen: boolean): string {
  return [
    "You are the warm, polished WhatsApp voice of Veloria Grand, a premium event venue in India.",
    "A sales rep is replying to a customer inside the CRM. Draft 2-3 short reply OPTIONS the rep can pick from.",
    "Each option has a DIFFERENT tone so the rep can choose: e.g. Warm, Direct, Date-nudge.",
    "Audience: an Indian B2C customer on WhatsApp.",
    "Rules:",
    "- Each option is ONE short, warm paragraph of plain text. No markdown, no bullets.",
    "- 55 words or fewer per option.",
    "- Move the conversation forward: acknowledge, ask the event date if unknown, and offer to share a tailored quote / check availability.",
    "- NEVER mention prices, rupee amounts, discounts, internal notes, staff names, or any internal data.",
    "- NEVER include links, URLs, or phone numbers.",
    sessionOpen
      ? "- The 24h chat window is OPEN: a natural conversational reply is fine."
      : "- The 24h chat window is CLOSED: frame options as a gentle re-engagement / follow-up (the rep will send via an approved template).",
    'Respond ONLY with JSON: {"variants":[{"tone":"Warm","text":"..."},{"tone":"Direct","text":"..."}]}',
    "Provide at most 3 variants.",
  ].join("\n");
}

function buildUserPrompt(args: GenerateWhatsAppReplyVariantsArgs): string {
  const name = cleanName(args.lead?.firstName);
  const eventType = cleanFreeText(args.lead?.eventType);
  const dateLabel = cleanFreeText(args.lead?.eventDateLabel, 30);
  const slotLabel = cleanFreeText(args.lead?.slotLabel, 30);

  const lines: string[] = [];
  lines.push("Lead headline:");
  lines.push(`- Customer first name: ${name || "(unknown)"}`);
  lines.push(`- Occasion / event type: ${eventType || "(unknown)"}`);
  lines.push(`- Event date: ${dateLabel || "(unknown)"}`);
  lines.push(`- Requested slot: ${slotLabel || "(unknown)"}`);
  lines.push("");
  lines.push("Recent conversation (oldest first):");

  const recent = args.recentMessages.slice(-8);
  if (recent.length === 0) {
    lines.push("(no prior messages)");
  } else {
    for (const m of recent) {
      const who = m.direction === "INBOUND" ? "Customer" : "Us";
      // Cap each line so a long pasted message can't blow the prompt / steer it.
      const safe = (m.text || "").replace(/\s+/g, " ").trim().slice(0, 300);
      if (safe) lines.push(`${who}: ${safe}`);
    }
  }

  lines.push("");
  lines.push("Draft the reply options now.");
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

// ------------------------------------------------------------
// Main entry
// ------------------------------------------------------------

interface LLMVariantsShape {
  variants?: Array<{ tone?: unknown; text?: unknown }>;
}

/**
 * Generate 1–3 tone-labelled reply variants. LLM-first with a hard timeout and
 * output guard, falling back to deterministic variants on any miss. Never
 * throws — always returns at least one usable variant.
 */
export async function generateWhatsAppReplyVariants(
  args: GenerateWhatsAppReplyVariantsArgs
): Promise<GenerateWhatsAppReplyVariantsResult> {
  const provider = getAIProvider();

  // Gate: no provider → deterministic fallback variants.
  if (provider === "none") {
    return { variants: buildFallbackVariants(args), model: "none" };
  }

  try {
    const result = await withTimeout(
      chatCompletionJSON<LLMVariantsShape>({
        system: buildSystemPrompt(args.sessionOpen),
        user: buildUserPrompt(args),
        model: getDefaultModel(),
      }),
      LLM_TIMEOUT_MS
    );

    const rawVariants = Array.isArray(result?.variants) ? result!.variants : [];
    const variants: ReplyVariant[] = [];
    for (const v of rawVariants) {
      const text = typeof v?.text === "string" ? v.text.trim() : "";
      if (!passesGuard(text)) continue;
      const tone =
        typeof v?.tone === "string" && v.tone.trim()
          ? v.tone.trim().slice(0, 24)
          : "Suggested";
      variants.push({ tone, text });
      if (variants.length >= MAX_VARIANTS) break;
    }

    if (variants.length > 0) {
      return { variants, model: provider };
    }
  } catch (err) {
    console.error("[WHATSAPP_COPILOT_LLM_ERROR] Falling back to static:", err);
  }

  // Any miss (empty / all-rejected / error) → deterministic fallback.
  return { variants: buildFallbackVariants(args), model: "none" };
}
