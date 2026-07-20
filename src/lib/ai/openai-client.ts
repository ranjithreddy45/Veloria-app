import OpenAI from "openai";

// ============================================================
// AI Client — Supports OpenAI, Google Gemini, and Groq
// ============================================================
// Priority: OPENAI_API_KEY > GROQ_API_KEY > GOOGLE_AI_API_KEY > null
// OpenAI & Groq use the OpenAI SDK. Gemini uses direct fetch
// to avoid URL construction issues in Next.js bundled standalone.

export type AIProvider = "openai" | "gemini" | "groq" | "none";

let _client: OpenAI | null = null;
let _provider: AIProvider = "none";
let _initialized = false;

function initProvider(): void {
  if (_initialized) return;
  _initialized = true;

  // 1. OpenAI (paid — best quality)
  if (process.env.OPENAI_API_KEY) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    _provider = "openai";
    return;
  }

  // 2. Groq (FREE — 14,400 req/day, very fast, llama-3.3-70b)
  if (process.env.GROQ_API_KEY) {
    _client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    _provider = "groq";
    return;
  }

  // 3. Google Gemini — uses direct fetch (not SDK) to avoid
  //    URL construction issues in bundled standalone builds
  if (process.env.GOOGLE_AI_API_KEY) {
    _provider = "gemini";
    return;
  }

  _provider = "none";
}

/** Get the default model name for the active provider. Each provider honours its
 * own model override — OPENAI_MODEL must NOT leak an OpenAI id into a Groq/Gemini
 * request (which rejects it as an unknown model, breaking every AI feature). */
export function getDefaultModel(): string {
  initProvider();
  if (_provider === "groq") return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  if (_provider === "gemini") return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

/** Public getter — returns the raw client (for checking availability) */
export function getOpenAIClient(): OpenAI | null {
  initProvider();
  // For Gemini, return a non-null marker so callers know AI is available
  if (_provider === "gemini") return {} as OpenAI;
  return _client;
}

/** Which AI provider is active */
export function getAIProvider(): AIProvider {
  initProvider();
  return _provider;
}

// ============================================================
// Gemini direct fetch — bypasses OpenAI SDK bundling issues
// ============================================================

const GEMINI_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GeminiRequestBody {
  model: string;
  messages: GeminiMessage[];
  temperature?: number;
  max_tokens?: number;
}

async function geminiCompletion(body: GeminiRequestBody): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  // Use Node.js native https module to bypass Next.js fetch
  // patching which can add caching/revalidation headers that
  // break external API calls in standalone builds.
  const https = await import("https");
  const payload = JSON.stringify(body);

  const responseText = await new Promise<string>((resolve, reject) => {
    const url = new URL(GEMINI_OPENAI_URL);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode !== 200) {
            console.error(
              `[Gemini API] HTTP ${res.statusCode}:`,
              text.slice(0, 500)
            );
            let errorMsg = `Gemini API error ${res.statusCode}`;
            try {
              const errorJson = JSON.parse(text);
              errorMsg = errorJson?.error?.message || errorMsg;
            } catch {
              // keep default
            }
            reject(new Error(errorMsg));
          } else {
            resolve(text);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });

  const data = JSON.parse(responseText);
  return data?.choices?.[0]?.message?.content ?? "";
}

// ============================================================
// Simple completion (backward-compatible)
// ============================================================

export async function chatCompletion(prompt: string): Promise<string> {
  initProvider();

  if (_provider === "none") {
    console.warn("[AI] No AI API key configured — returning placeholder");
    return "AI placeholder response — configure GROQ_API_KEY (free) or OPENAI_API_KEY for real responses";
  }

  if (_provider === "gemini") {
    return geminiCompletion({
      model: getDefaultModel(),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    });
  }

  const response = await _client!.chat.completions.create({
    model: getDefaultModel(),
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1024,
  });
  return response.choices[0]?.message?.content ?? "";
}

// ============================================================
// Completion with system prompt
// ============================================================

export async function chatCompletionWithSystem(params: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  initProvider();

  if (_provider === "none") {
    return "AI not configured";
  }

  const model = params.model ?? getDefaultModel();
  const messages: GeminiMessage[] = [
    { role: "system", content: params.system },
    { role: "user", content: params.user },
  ];

  if (_provider === "gemini") {
    return geminiCompletion({
      model,
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 2048,
    });
  }

  const response = await _client!.chat.completions.create({
    model,
    messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 2048,
  });
  return response.choices[0]?.message?.content ?? "";
}

// ============================================================
// JSON mode completion
// ============================================================

export async function chatCompletionJSON<T>(params: {
  system: string;
  user: string;
  model?: string;
}): Promise<T | null> {
  initProvider();

  if (_provider === "none") return null;

  try {
    const model = params.model ?? getDefaultModel();
    const systemPrompt =
      params.system + "\n\nRespond ONLY with valid JSON.";

    let text: string;

    if (_provider === "gemini") {
      text = await geminiCompletion({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: params.user },
        ],
        temperature: 0.3,
      });
    } else {
      const useJsonMode = _provider === "openai";
      const response = await _client!.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: params.user },
        ],
        ...(useJsonMode
          ? { response_format: { type: "json_object" as const } }
          : {}),
        temperature: 0.3,
      });
      text = response.choices[0]?.message?.content ?? "{}";
    }

    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?\s*```$/, "");
    }
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error("[AI JSON Parse Error]", e);
    return null;
  }
}
