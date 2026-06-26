import { chatCompletionJSON, getOpenAIClient } from "@/lib/ai/openai-client";

// ============================================================
// Inbound-message Intent Classifier
// ============================================================
// LLM-first + keyword-fallback engine, direct clone of sentiment.ts shape.
// Tags an inbound WhatsApp / Communication message as one of:
//   READY_TO_BUY | DATE_CHECK | PRICE_OBJECTION | COLD | GENERAL
// Degrades gracefully to keyword classification when getOpenAIClient() is
// null (no AI provider configured) or the LLM call/parse fails. Pure — no IO
// except the optional AI call.

export type MessageIntent =
  | "READY_TO_BUY"
  | "DATE_CHECK"
  | "PRICE_OBJECTION"
  | "COLD"
  | "GENERAL";

const INTENTS: MessageIntent[] = [
  "READY_TO_BUY",
  "DATE_CHECK",
  "PRICE_OBJECTION",
  "COLD",
  "GENERAL",
];

export interface IntentResult {
  intent: MessageIntent;
  confidence: number; // 0.0 to 1.0
  method: "LLM" | "KEYWORD";
}

// ============================================================
// Keyword banks (incl. India / Hinglish buying phrases)
// ============================================================

const READY_TO_BUY_KEYWORDS = [
  "book",
  "book kar",
  "booking",
  "confirm",
  "confirmed",
  "final",
  "finalize",
  "finalise",
  "lock",
  "advance",
  "pay",
  "payment",
  "deposit",
  "token",
  "go ahead",
  "proceed",
  "let's do",
  "ready to book",
  "want to book",
  "shaadi pakki",
  "deal",
];

const DATE_CHECK_KEYWORDS = [
  "available",
  "availability",
  "available kya",
  "date",
  "dates",
  "free on",
  "is it free",
  "open on",
  "slot",
  "this weekend",
  "next month",
  "december",
  "calendar",
  "khali hai",
  "available hai",
];

const PRICE_OBJECTION_KEYWORDS = [
  "price",
  "cost",
  "costly",
  "too costly",
  "expensive",
  "mehenga",
  "mehnga",
  "budget",
  "discount",
  "cheaper",
  "rate",
  "kitna",
  "how much",
  "less karo",
  "kam karo",
  "negotiate",
  "out of budget",
  "afford",
];

const COLD_KEYWORDS = [
  "not interested",
  "no thanks",
  "later",
  "maybe later",
  "just looking",
  "stop",
  "unsubscribe",
  "cancel",
  "not now",
  "busy",
  "another time",
  "rehne do",
  "nahi chahiye",
  "baad mein",
];

function countHits(lower: string, bank: string[]): number {
  let n = 0;
  for (const kw of bank) {
    if (lower.includes(kw)) n++;
  }
  return n;
}

export function keywordFallback(text: string): IntentResult {
  const lower = (text || "").toLowerCase();

  const scores: Record<Exclude<MessageIntent, "GENERAL">, number> = {
    READY_TO_BUY: countHits(lower, READY_TO_BUY_KEYWORDS),
    DATE_CHECK: countHits(lower, DATE_CHECK_KEYWORDS),
    PRICE_OBJECTION: countHits(lower, PRICE_OBJECTION_KEYWORDS),
    COLD: countHits(lower, COLD_KEYWORDS),
  };

  // Pick the strongest signal. Order encodes priority on ties: buying
  // intent first (it drives the worklist boost), then date, price, cold.
  const order: Array<Exclude<MessageIntent, "GENERAL">> = [
    "READY_TO_BUY",
    "DATE_CHECK",
    "PRICE_OBJECTION",
    "COLD",
  ];

  let bestIntent: MessageIntent = "GENERAL";
  let bestHits = 0;
  for (const key of order) {
    if (scores[key] > bestHits) {
      bestHits = scores[key];
      bestIntent = key;
    }
  }

  if (bestHits === 0) {
    return { intent: "GENERAL", confidence: 0.2, method: "KEYWORD" };
  }

  // More hits → higher confidence, capped. Keyword path is inherently coarse.
  const confidence = Math.min(0.85, 0.45 + bestHits * 0.15);
  return { intent: bestIntent, confidence, method: "KEYWORD" };
}

// ============================================================
// Main classifier (LLM-first)
// ============================================================

const SYSTEM_PROMPT =
  "You are an intent classifier for an Indian wedding/event venue sales CRM (WhatsApp-first). " +
  "Classify the customer's inbound message into exactly one intent and return a JSON object with: " +
  'intent (one of "READY_TO_BUY", "DATE_CHECK", "PRICE_OBJECTION", "COLD", "GENERAL"), ' +
  "confidence (float 0.0 to 1.0). Guidance: " +
  "READY_TO_BUY = clear buying signal — wants to book/confirm/pay advance/finalize ('book kar do', 'final', 'advance', 'lets proceed'). " +
  "DATE_CHECK = asking about availability or a specific date/slot ('available kya', 'is 12 Dec free', 'open this weekend'). " +
  "PRICE_OBJECTION = pushback on cost/price/budget or asking for a discount ('too costly', 'mehenga', 'discount', 'budget kam hai'). " +
  "COLD = disengaged / not interested / stop / later ('not interested', 'baad mein', 'rehne do'). " +
  "GENERAL = anything else (greetings, generic questions, logistics). " +
  "Hinglish and Hindi phrases are common — interpret them in context.";

export async function classifyIntent(text: string): Promise<IntentResult> {
  const safeText = (text || "").trim();
  if (!safeText) {
    return { intent: "GENERAL", confidence: 0.2, method: "KEYWORD" };
  }

  // Try LLM first if a provider is available.
  const client = getOpenAIClient();
  if (client) {
    try {
      const result = await chatCompletionJSON<{
        intent: string;
        confidence: number;
      }>({
        system: SYSTEM_PROMPT,
        user: safeText,
      });

      if (
        result &&
        typeof result.intent === "string" &&
        INTENTS.includes(result.intent as MessageIntent)
      ) {
        const confidence =
          typeof result.confidence === "number"
            ? Math.max(0, Math.min(1, result.confidence))
            : 0.6;
        return {
          intent: result.intent as MessageIntent,
          confidence,
          method: "LLM",
        };
      }
    } catch (err) {
      console.error("[INTENT_LLM_ERROR] Falling back to keywords:", err);
    }
  }

  // Fallback to keyword-based classification.
  return keywordFallback(safeText);
}
