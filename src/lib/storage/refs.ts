// ============================================================
// Storage references — the PURE string helpers.
//
// A file column in this app holds one of three shapes:
//   1. a base64 data-URL              "data:image/jpeg;base64,…"   (legacy, inline)
//   2. an object-storage reference    "s3://<bucket>/<key>"        (moved out of the DB)
//   3. an https link                   "https://…"                  (staff-entered)
//
// The ref (2) is written IN PLACE of the data-URL in the existing column, so
// no model needed a schema change. The browser can never load "s3://", so at
// the display boundary a ref becomes a proxy URL "/api/files/<key>" — and when
// an edit form sends that proxy URL back, it is normalised to the ref again
// before it is persisted (otherwise a round-trip through any edit form would
// silently drop every already-migrated photo).
//
// This file has NO imports so a client component can use it for previews and
// the same rules are applied on both sides of the wire.
// ============================================================

export const STORAGE_REF_SCHEME = "s3://";
export const FILE_PROXY_PREFIX = "/api/files/";

/** Object keys: <prefix>/<yyyy>/<mm>/<id>.<ext> — segment-safe characters only. */
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,62}$/;

export function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(value);
}

/** A well-formed object key (no "..", no empty segments, no odd characters). */
export function isValidObjectKey(key: unknown): key is string {
  return typeof key === "string" && key.length <= 512 && KEY_RE.test(key) && !key.split("/").includes("..");
}

export function parseStorageRef(value: unknown): { bucket: string; key: string } | null {
  if (typeof value !== "string" || !value.startsWith(STORAGE_REF_SCHEME)) return null;
  const rest = value.slice(STORAGE_REF_SCHEME.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const key = rest.slice(slash + 1);
  if (!BUCKET_RE.test(bucket) || !isValidObjectKey(key)) return null;
  return { bucket, key };
}

/** `s3://<bucket>/<key>` — the form stored in the DB column. */
export function isStorageRef(value: unknown): value is string {
  return parseStorageRef(value) !== null;
}

export function makeStorageRef(bucket: string, key: string): string {
  return `${STORAGE_REF_SCHEME}${bucket}/${key}`;
}

/** The app-relative proxy URL that streams an object to a signed-in user. */
export function proxyUrlForKey(key: string): string {
  return `${FILE_PROXY_PREFIX}${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * The object key inside a proxy URL, or null when the value is not one.
 * Accepts the site-relative form and an absolute URL on any origin — the
 * form only ever echoes back what the server handed it.
 */
export function keyFromProxyUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      path = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith(FILE_PROXY_PREFIX)) return null;
  const raw = path.slice(FILE_PROXY_PREFIX.length).split("?")[0].split("#")[0];
  let key: string;
  try {
    key = raw.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
  return isValidObjectKey(key) ? key : null;
}

export function isProxyFileUrl(value: unknown): value is string {
  return keyFromProxyUrl(value) !== null;
}

/** Any value the storage layer knows how to display: data-URL, ref or proxy URL. */
export function isStoredFileValue(value: unknown): value is string {
  return isDataUrl(value) || isStorageRef(value) || isProxyFileUrl(value);
}
