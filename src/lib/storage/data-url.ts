// ============================================================
// The bridge between the app's data-URL convention and object storage.
//
//   storeIncomingFile(dataUrl, { prefix })   write boundary — call AFTER the
//                                            caller's own validation (mime /
//                                            size / isSafeReceipt*) and BEFORE
//                                            persisting. Returns the value to
//                                            store: an s3 ref when object
//                                            storage is enabled, otherwise the
//                                            data-URL untouched.
//   resolveFileValue(value)                  display boundary — refs become a
//                                            URL the browser can load; every
//                                            other value passes through.
//   readFileValueAsDataUrl(value)            for callers whose contract is
//                                            "return the bytes as a data-URL"
//                                            (fetches the object when needed).
//   normalizeFileValueForStorage(value)      edit-form round-trip — a proxy URL
//                                            the UI echoed back becomes the ref
//                                            again; data-URLs and refs pass.
//
// Server-only: imports the S3 SDK and Prisma. Client code uses ./refs.
// ============================================================

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getObject, getObjectUrl, isObjectStorageEnabled, putObject } from "./index";
import {
  isDataUrl,
  isStorageRef,
  keyFromProxyUrl,
  makeStorageRef,
  parseStorageRef,
} from "./refs";
import { readS3Config } from "./s3";

export * from "./refs";

/** `data:<mime>;base64,<payload>` → bytes. Null when the value is not one. */
export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(dataUrl ?? "");
  if (!m) return null;
  const buffer = Buffer.from(m[2].replace(/[\r\n]/g, ""), "base64");
  if (buffer.length === 0) return null;
  return { mime: m[1].toLowerCase(), buffer };
}

export function toDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime || "application/octet-stream"};base64,${buffer.toString("base64")}`;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
};

export function extensionForMime(mime: string): string {
  const known = EXT_BY_MIME[mime.toLowerCase()];
  if (known) return known;
  const sub = mime.split("/")[1]?.replace(/^x-/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return sub && sub.length <= 8 ? sub : "bin";
}

/** cuid-style id: sortable timestamp + 64 bits of randomness, lowercase alnum. */
function newFileId(): string {
  return `c${Date.now().toString(36)}${randomBytes(8).toString("hex")}`;
}

const PREFIX_RE = /^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/;

/** `<prefix>/<yyyy>/<mm>/<id>.<ext>` */
export function buildObjectKey(prefix: string, mime: string, now = new Date()): string {
  if (!PREFIX_RE.test(prefix)) throw new Error(`Invalid storage prefix "${prefix}"`);
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${yyyy}/${mm}/${newFileId()}.${extensionForMime(mime)}`;
}

export interface StoreFileOptions {
  /** Folder for the key, e.g. "hr/claims", "leads", "bd/deals". */
  prefix: string;
  /** Registry metadata (best-effort, for the StoredFile table). */
  ownerType?: string;
  ownerId?: string;
  createdById?: string;
}

/** Best-effort registry row. Never throws: a missing row must not fail an upload. */
async function registerStoredFile(row: {
  key: string;
  bucket: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  ownerType?: string;
  ownerId?: string;
  createdById?: string;
}): Promise<void> {
  try {
    await prisma.storedFile.create({
      data: {
        key: row.key,
        bucket: row.bucket,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        sha256: row.sha256,
        ownerType: row.ownerType ?? null,
        ownerId: row.ownerId ?? null,
        createdById: row.createdById ?? null,
      },
    });
  } catch (e) {
    console.warn("[storage] StoredFile registry write failed for", row.key, e instanceof Error ? e.message : e);
  }
}

/**
 * Upload a validated data-URL and return the s3 ref to persist in its place.
 * With object storage disabled (the default) the data-URL is returned as-is,
 * so call sites behave exactly as before the storage layer existed. Values that
 * are not data-URLs (refs, https links) are returned untouched.
 */
export async function storeIncomingFile(value: string, opts: StoreFileOptions): Promise<string> {
  if (!isObjectStorageEnabled()) return value;
  if (!isDataUrl(value)) return value;
  const parsed = parseDataUrl(value);
  if (!parsed) return value;

  const key = buildObjectKey(opts.prefix, parsed.mime);
  const { bucket } = await putObject({ key, body: parsed.buffer, contentType: parsed.mime });
  await registerStoredFile({
    key,
    bucket,
    contentType: parsed.mime,
    sizeBytes: parsed.buffer.length,
    sha256: createHash("sha256").update(parsed.buffer).digest("hex"),
    ownerType: opts.ownerType,
    ownerId: opts.ownerId,
    createdById: opts.createdById,
  });
  return makeStorageRef(bucket, key);
}

/** storeIncomingFile over a list, preserving order. */
export async function storeIncomingFiles(values: string[], opts: StoreFileOptions): Promise<string[]> {
  const out: string[] = [];
  for (const v of values) out.push(await storeIncomingFile(v, opts));
  return out;
}

/**
 * Display boundary: s3 refs become a loadable URL; everything else (data-URLs,
 * https links, proxy URLs, null) passes through unchanged.
 */
export async function resolveFileValue<T extends string | null | undefined>(value: T): Promise<T | string> {
  const ref = parseStorageRef(value);
  if (!ref) return value;
  return getObjectUrl(ref.key);
}

export async function resolveFileValues(values: readonly string[] | null | undefined): Promise<string[]> {
  if (!values?.length) return [];
  return Promise.all(values.map((v) => resolveFileValue(v)));
}

/** The bucket a bare key lives in: registry first, then the configured bucket. */
async function bucketForKey(key: string): Promise<string | null> {
  try {
    const row = await prisma.storedFile.findUnique({ where: { key }, select: { bucket: true } });
    if (row?.bucket) return row.bucket;
  } catch {
    // Registry unavailable (e.g. client not regenerated yet) — fall through.
  }
  return readS3Config()?.bucket ?? null;
}

/**
 * Edit-form round-trip: the UI was handed proxy URLs for already-stored files
 * and sends them straight back on save. Turn them into refs again. Data-URLs
 * and refs pass through; anything else returns null (the caller decides
 * whether that is a validation error or a silent drop).
 */
export async function normalizeFileValueForStorage(value: unknown): Promise<string | null> {
  if (typeof value !== "string" || !value) return null;
  if (isDataUrl(value) || isStorageRef(value)) return value;
  const key = keyFromProxyUrl(value);
  if (!key) return null;
  const bucket = await bucketForKey(key);
  return bucket ? makeStorageRef(bucket, key) : null;
}

/** Fetch the bytes behind a stored value (data-URL decoded, or object read). */
export async function readFileValueBytes(
  value: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const ref = parseStorageRef(value);
  if (ref) {
    const obj = await getObject(ref.key, ref.bucket);
    return { buffer: obj.body, contentType: obj.contentType || "application/octet-stream" };
  }
  const parsed = parseDataUrl(value);
  return parsed ? { buffer: parsed.buffer, contentType: parsed.mime } : null;
}

/**
 * For callers whose return contract is "a data-URL": refs are fetched and
 * re-encoded; data-URLs come back unchanged; other strings unchanged too.
 */
export async function readFileValueAsDataUrl(value: string): Promise<string> {
  if (!isStorageRef(value)) return value;
  const bytes = await readFileValueBytes(value);
  if (!bytes) return value;
  return toDataUrl(bytes.buffer, bytes.contentType);
}
