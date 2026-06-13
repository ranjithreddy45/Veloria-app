// Pure helper (safe on client + server): turn a stored WhatsApp template payload of the
// form `[Template: day_of_welcome] {"guestName":"…","eventName":"…"}` into a readable,
// brace-free line for the activity timeline. Leaves already-readable content untouched.
export function humanizeWhatsAppContent(content: string | null | undefined): string {
  const text = (content ?? "").trim();
  const m = /^\[Template:\s*([^\]]+)\]\s*(\{[\s\S]*\})\s*$/.exec(text);
  if (!m) return content ?? "";
  let params: Record<string, unknown> = {};
  try {
    params = JSON.parse(m[2]);
  } catch {
    return content ?? "";
  }
  const label = m[1]
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const values = Object.values(params)
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return values.length ? `${label} — ${values.join(" · ")}` : label;
}
