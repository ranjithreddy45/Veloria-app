import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export function getOpenAIClient(): OpenAI | null {
  return getOpenAI();
}

// Backward-compatible simple completion
export async function chatCompletion(prompt: string): Promise<string> {
  const client = getOpenAI();
  if (!client) {
    console.warn("[AI] OPENAI_API_KEY not configured — returning placeholder");
    return "AI placeholder response — configure OPENAI_API_KEY for real responses";
  }
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1024,
  });
  return response.choices[0]?.message?.content ?? "";
}

// With system prompt
export async function chatCompletionWithSystem(params: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const client = getOpenAI();
  if (!client) {
    return "AI not configured";
  }
  const response = await client.chat.completions.create({
    model: params.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 2048,
  });
  return response.choices[0]?.message?.content ?? "";
}

// JSON mode for structured output
export async function chatCompletionJSON<T>(params: {
  system: string;
  user: string;
  model?: string;
}): Promise<T | null> {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const response = await client.chat.completions.create({
      model: params.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: params.system + "\n\nRespond ONLY with valid JSON." },
        { role: "user", content: params.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const text = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(text) as T;
  } catch (e) {
    console.error("[AI JSON Parse Error]", e);
    return null;
  }
}
