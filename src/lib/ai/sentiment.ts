import { chatCompletionJSON, getOpenAIClient } from "@/lib/ai/openai-client";

// ============================================================
// Sentiment Analysis Engine
// ============================================================

export interface SentimentResult {
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  score: number; // -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
}

// ============================================================
// Keyword-based fallback
// ============================================================

const POSITIVE_KEYWORDS = [
  "thank",
  "great",
  "excellent",
  "wonderful",
  "happy",
  "pleased",
  "amazing",
  "perfect",
  "love",
  "fantastic",
  "appreciate",
  "excited",
  "delighted",
  "impressed",
  "outstanding",
  "brilliant",
];

const NEGATIVE_KEYWORDS = [
  "disappointed",
  "unhappy",
  "frustrated",
  "terrible",
  "awful",
  "horrible",
  "complaint",
  "issue",
  "problem",
  "concern",
  "delay",
  "cancel",
  "refund",
  "angry",
  "upset",
  "worst",
  "unacceptable",
];

function keywordFallback(text: string): SentimentResult {
  const lower = text.toLowerCase();

  let positive = 0;
  let negative = 0;

  for (const kw of POSITIVE_KEYWORDS) {
    if (lower.includes(kw)) positive++;
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (lower.includes(kw)) negative++;
  }

  const score = (positive - negative) / (positive + negative + 1);
  const confidence = Math.min(1, (positive + negative) / 5);

  let sentiment: SentimentResult["sentiment"] = "NEUTRAL";
  if (score > 0.2) sentiment = "POSITIVE";
  else if (score < -0.2) sentiment = "NEGATIVE";

  return { sentiment, score: Math.round(score * 100) / 100, confidence };
}

// ============================================================
// Main Sentiment Analysis
// ============================================================

const SYSTEM_PROMPT =
  "You are a sentiment analysis expert. Analyze the following communication text and return a JSON object with: sentiment (POSITIVE, NEUTRAL, or NEGATIVE), score (float from -1.0 to 1.0 where -1 is very negative and 1 is very positive), confidence (float from 0.0 to 1.0). Consider business context — this is from a CRM for an event/venue management company.";

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  // Try LLM first if OpenAI is available
  const client = getOpenAIClient();
  if (client) {
    try {
      const result = await chatCompletionJSON<SentimentResult>({
        system: SYSTEM_PROMPT,
        user: text,
      });

      if (
        result &&
        result.sentiment &&
        typeof result.score === "number" &&
        typeof result.confidence === "number" &&
        ["POSITIVE", "NEUTRAL", "NEGATIVE"].includes(result.sentiment)
      ) {
        return {
          sentiment: result.sentiment,
          score: Math.max(-1, Math.min(1, result.score)),
          confidence: Math.max(0, Math.min(1, result.confidence)),
        };
      }
    } catch (err) {
      console.error("[SENTIMENT_LLM_ERROR] Falling back to keywords:", err);
    }
  }

  // Fallback to keyword-based analysis
  return keywordFallback(text);
}
