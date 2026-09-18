import { PushApiError } from "./errors";

// ============================================================
// Read a JSON body without trusting it.
//
// Content-Length is checked first, but it is only a claim, so the stream is
// also counted as it is read and abandoned the moment it passes the cap — a
// chunked upload with no length header can't smuggle a large body past us.
// ============================================================

export async function readJsonObject(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("application/json")) {
    throw new PushApiError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PushApiError("PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
  }

  const text = await readCapped(req, maxBytes);
  if (text.trim() === "") throw new PushApiError("INVALID_JSON", "Request body is empty.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PushApiError("INVALID_JSON", "Request body is not valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PushApiError("INVALID_JSON", "Request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

async function readCapped(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new PushApiError("PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}
