// ============================================================
// Quote AI Caption generator — LLM-first with deterministic fallback.
// ------------------------------------------------------------
// NOT "use server": reusable from the caption actions AND the nudge cron.
// Mirrors src/lib/ai/sentiment.ts's shape: try the configured LLM, ALWAYS fall
// back to a deterministic template when the provider is 'none', or the LLM
// returns empty / over-length / errors. Degrades gracefully so a missing AI key
// never breaks the share/nudge flow.
//
// MONEY SAFETY (see spec risk): the ₹ figures in the caption come ONLY from the
// caller-supplied grandTotal / advance (formatted server-side). We never trust
// the LLM to produce a price — its job is the wording, and we append/repair the
// price + link deterministically so the model can't fabricate a wrong amount.
// ============================================================

import { Prisma } from "@prisma/client";
import { getAIProvider, getDefaultModel, chatCompletionWithSystem } from "@/lib/ai/openai-client";
import { SLOT_LABEL, plannerSlotToEnum } from "@/lib/sales/slot";

export type QuoteCaptionKind = "SHARE" | "NUDGE";

export interface QuoteCaptionInput {
  kind: QuoteCaptionKind;
  clientName?: string | null;
  occasion?: string | null;
  eventDate?: Date | string | null;
  timeSlot?: string | null;
  grandTotal: Prisma.Decimal | number | string | null | undefined;
  /** Optional 20% booking-advance figure for the "block your date" hook. */
  advanceAmount?: Prisma.Decimal | number | string | null;
  payInvoiceId?: string | null;
  paymentLinkUrl?: string | null;
  /** e.g. "Only Evening left for this date" — urgency hook from live scarcity. */
  slotScarcityHint?: string | null;
}

export interface QuoteCaptionResult {
  text: string;
  method: "LLM" | "TEMPLATE";
  model: string | null;
}

const MAX_CAPTION_LEN = 600;

// C0/C1 control chars EXCEPT newline, matched via escapes (no literal control
// chars in source) so the sanitizer is robust to copy/paste mangling.
const CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0009\\u000B-\\u001F\\u007F-\\u009F]",
  "g"
);

/** Decimal | number | string → integer-rupee INR string. Never throws. */
export function fmtINR(value: Prisma.Decimal | number | string | null | undefined): string {
  let n = 0;
  try {
    n = value == null ? 0 : Number(value);
  } catch {
    n = 0;
  }
  if (!Number.isFinite(n)) n = 0;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function firstName(name?: string | null): string {
  const n = (name ?? "").trim();
  return n ? n.split(/\s+/)[0] : "there";
}

function dateLabel(d?: Date | string | null): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function slotPhrase(timeSlot?: string | null): string | null {
  if (!timeSlot) return null;
  return SLOT_LABEL[plannerSlotToEnum(timeSlot)] ?? null;
}

/**
 * Strip control chars (keeping newlines), collapse 3+ blank lines, hard-cap
 * length. Defends the customer-facing message against injected control chars
 * and runaway LLM output.
 */
function sanitize(text: string): string {
  const cleaned = text
    .replace(CONTROL_CHARS, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= MAX_CAPTION_LEN) return cleaned;
  return cleaned.slice(0, MAX_CAPTION_LEN).trim();
}

/**
 * Build the deterministic, money-correct caption. This is BOTH the fallback and
 * the price/link source of truth. Two short lines, INR exact, one urgency hook.
 */
export function buildTemplateCaption(input: QuoteCaptionInput): string {
  const name = firstName(input.clientName);
  const occasion = (input.occasion ?? "").trim();
  const when = dateLabel(input.eventDate);
  const slot = slotPhrase(input.timeSlot);
  const total = fmtINR(input.grandTotal);
  const advance = input.advanceAmount != null ? fmtINR(input.advanceAmount) : null;
  const link = (input.paymentLinkUrl ?? "").trim();
  const scarcity = (input.slotScarcityHint ?? "").trim();

  const pkg = occasion ? `${occasion} package` : "event quote";
  const dateBit = when ? ` for ${when}${slot ? ` (${slot})` : ""}` : "";

  const lines: string[] = [];
  if (input.kind === "NUDGE") {
    lines.push(`Hi ${name}, your ${pkg}${dateBit} is ready — total ${total}.`);
    const hook = scarcity || (slot ? `${slot} is going fast` : "Dates are filling up");
    if (advance) {
      lines.push(`${hook}. Just ${advance} blocks your date today.`);
    } else {
      lines.push(`${hook}. Reply here to lock it in.`);
    }
  } else {
    lines.push(`Hi ${name}! Your ${pkg}${dateBit} comes to ${total}.`);
    if (advance) {
      lines.push(
        scarcity
          ? `${scarcity} — just ${advance} blocks your date today.`
          : `Just ${advance} blocks your date today.`
      );
    } else if (scarcity) {
      lines.push(scarcity);
    }
  }
  if (link) lines.push(link);
  return sanitize(lines.join("\n"));
}

/** True if a free-text caption already contains the exact INR total figure. */
function hasAmount(text: string, total: string): boolean {
  const digits = total.replace(/[^\d]/g, "");
  if (!digits) return true;
  return text.replace(/[^\d]/g, "").includes(digits);
}

/**
 * Generate a personalized WhatsApp caption. LLM-first when a provider is
 * configured; otherwise (or on any failure / empty / over-length) the
 * deterministic template. Always returns — never throws.
 */
export async function generateQuoteCaption(
  input: QuoteCaptionInput
): Promise<QuoteCaptionResult> {
  const template = buildTemplateCaption(input);
  const provider = getAIProvider();
  if (provider === "none") {
    return { text: template, method: "TEMPLATE", model: null };
  }

  const total = fmtINR(input.grandTotal);
  const advance = input.advanceAmount != null ? fmtINR(input.advanceAmount) : null;
  const link = (input.paymentLinkUrl ?? "").trim();
  const name = firstName(input.clientName);
  const occasion = (input.occasion ?? "").trim() || "event";
  const when = dateLabel(input.eventDate);
  const slot = slotPhrase(input.timeSlot);
  const scarcity = (input.slotScarcityHint ?? "").trim();

  const system = [
    "You are a warm, concise sales copywriter for Veloria Grand, a premium event venue in India.",
    "Write a single WhatsApp message to a prospective customer about their event quote.",
    "Rules: at most 2 short lines. At most 1 emoji. Friendly, not pushy. Indian English.",
    "Create gentle urgency to secure the date. Do NOT invent any price, date, or fact.",
    "Use ONLY the figures and details provided. Do NOT add links (one is appended after).",
    "Return ONLY the message text — no preamble, quotes, or markdown.",
  ].join(" ");

  const facts = [
    `Customer first name: ${name}`,
    `Occasion: ${occasion}`,
    when ? `Event date: ${when}${slot ? ` (${slot})` : ""}` : null,
    `Quote total (use exactly): ${total}`,
    advance ? `Booking advance to block the date (use exactly): ${advance}` : null,
    scarcity ? `Scarcity hint: ${scarcity}` : null,
    input.kind === "NUDGE"
      ? "Context: the customer opened this quote ~24h ago but hasn't paid. Nudge them gently."
      : "Context: this is the first time the rep is sharing the quote.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await chatCompletionWithSystem({
      system,
      user: facts,
      temperature: 0.6,
      maxTokens: 220,
    });
    let text = (raw ?? "").trim();
    // Provider sentinel / empty → fall back deterministically.
    if (!text || text === "AI not configured") {
      return { text: template, method: "TEMPLATE", model: null };
    }
    text = sanitize(text);
    if (!text || text.length > MAX_CAPTION_LEN) {
      return { text: template, method: "TEMPLATE", model: null };
    }
    // MONEY GUARD: if the model dropped/garbled the price, append the correct
    // figure rather than ship a caption that omits or fabricates the amount.
    if (!hasAmount(text, total)) {
      text = sanitize(`${text}\nTotal ${total}${advance ? ` · ${advance} blocks your date` : ""}`);
    }
    // Always append the canonical payment link (the model was told not to add one).
    if (link && !text.includes(link)) {
      text = sanitize(`${text}\n${link}`);
    }
    return { text, method: "LLM", model: getDefaultModel() };
  } catch (e) {
    console.error("[QUOTE_CAPTION_LLM_ERROR]", e);
    return { text: template, method: "TEMPLATE", model: null };
  }
}
