// Pure helper (safe on client + server): turn a stored WhatsApp template payload of the
// form `[Template: day_of_welcome] {"guestName":"…","eventName":"…"}` into a readable,
// brace-free line for the activity timeline. Leaves already-readable content untouched.
export function humanizeWhatsAppContent(content: string | null | undefined): string {
  const text = (content ?? "").trim();
  // Title-case a raw template name like `booking_confirmation` → `Booking Confirmation`.
  const titleCase = (name: string) =>
    name
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // Full form: `[Template: name] {json}` → "Label — v1 · v2".
  const full = /^\[Template:\s*([^\]]+)\]\s*(\{[\s\S]*\})\s*$/.exec(text);
  if (full) {
    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(full[2]);
    } catch {
      // Unparseable JSON — fall back to the human label, never the raw braces.
      return titleCase(full[1]);
    }
    const label = titleCase(full[1]);
    const values = Object.values(params)
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
    return values.length ? `${label} — ${values.join(" · ")}` : label;
  }

  // Label-only form: `[Template: name]` (no payload) → "Label".
  const labelOnly = /^\[Template:\s*([^\]]+)\]\s*$/.exec(text);
  if (labelOnly) return titleCase(labelOnly[1]);

  // Already-readable content — leave untouched.
  return content ?? "";
}
