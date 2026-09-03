// ============================================================
// Attachment limits for reimbursement claims — enforced, and LOUD.
//
// There is no object storage in this app: uploads are base64 data-URLs stored
// in Postgres text columns, and they reach the server through a server action
// whose request body the platform caps at roughly 4.5MB. One phone photo of a
// bill is 2-4MB before compression, so "attach all your receipts" collides with
// that ceiling almost immediately.
//
// The wrong answer is to accept what fits and drop the rest, or to let the
// request fail with a platform error the employee cannot interpret. Either way
// HR ends up approving money against evidence that silently is not there.
//
// So the budget is explicit, checked before anything is written, and reported
// with the numbers in the message. Images are compressed in the browser first;
// PDFs cannot be compressed and are checked as-is.
//
// When object storage is added, these limits can go — the browser will upload
// direct and the body cap stops applying. Until then this is the honest edge.
// ============================================================

/** Base64 inflates bytes by ~4/3; the cap must be read in ENCODED terms. */
const BASE64_OVERHEAD = 4 / 3;

/** Server-action body ceiling, with headroom for the rest of the payload. */
export const CLAIM_ATTACHMENT_BUDGET_BYTES = 3_200_000;

/** More than this and it is a filing cabinet, not a claim. */
export const CLAIM_ATTACHMENT_MAX_COUNT = 8;

/** A single file larger than this cannot share a request with anything else. */
export const CLAIM_ATTACHMENT_MAX_ONE_BYTES = 2_500_000;

export const CLAIM_ATTACHMENT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export interface IncomingAttachment {
  fileName: string;
  mimeType: string;
  /** Full data-URL, e.g. "data:image/jpeg;base64,…". */
  data: string;
}

/** Decoded byte size of a base64 data-URL, without decoding it. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function human(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1000))}KB`;
}

export interface AttachmentCheck {
  ok: boolean;
  error?: string;
  /** Sizes in the same order as the input, so callers can persist them. */
  sizes: number[];
  totalBytes: number;
}

/**
 * Validate a set of attachments against type, count and the size budget.
 *
 * Returns a message naming the offending file and the actual numbers — "too
 * large" without saying which file or by how much leaves someone guessing at a
 * limit they cannot see.
 */
export function checkAttachments(
  files: IncomingAttachment[],
  alreadyAttached = 0,
  alreadyBytes = 0
): AttachmentCheck {
  const sizes: number[] = [];
  let total = alreadyBytes;

  if (files.length + alreadyAttached > CLAIM_ATTACHMENT_MAX_COUNT) {
    return {
      ok: false,
      sizes: [],
      totalBytes: total,
      error: `A claim can carry ${CLAIM_ATTACHMENT_MAX_COUNT} attachments. This would make ${
        files.length + alreadyAttached
      }. Combine the receipts into one PDF, or raise a second claim.`,
    };
  }

  for (const f of files) {
    const name = f.fileName?.trim() || "that file";
    if (!(CLAIM_ATTACHMENT_MIME as readonly string[]).includes(f.mimeType)) {
      return {
        ok: false,
        sizes: [],
        totalBytes: total,
        error: `${name} is a ${f.mimeType || "unknown"} file. Attach a JPG, PNG, WEBP or PDF.`,
      };
    }
    const bytes = dataUrlBytes(f.data);
    if (bytes <= 0) {
      return { ok: false, sizes: [], totalBytes: total, error: `${name} appears to be empty.` };
    }
    if (bytes > CLAIM_ATTACHMENT_MAX_ONE_BYTES) {
      return {
        ok: false,
        sizes: [],
        totalBytes: total,
        error: `${name} is ${human(bytes)}. A single attachment must be under ${human(
          CLAIM_ATTACHMENT_MAX_ONE_BYTES
        )} — photograph it at a lower resolution, or attach it as a PDF.`,
      };
    }
    sizes.push(bytes);
    total += bytes;
  }

  // The encoded payload is what the platform actually measures.
  if (total * BASE64_OVERHEAD > CLAIM_ATTACHMENT_BUDGET_BYTES * BASE64_OVERHEAD) {
    if (total > CLAIM_ATTACHMENT_BUDGET_BYTES) {
      return {
        ok: false,
        sizes: [],
        totalBytes: total,
        error: `These attachments total ${human(total)}. A claim can carry ${human(
          CLAIM_ATTACHMENT_BUDGET_BYTES
        )} in one go — remove one and add it after saving, or raise a second claim.`,
      };
    }
  }

  return { ok: true, sizes, totalBytes: total };
}
