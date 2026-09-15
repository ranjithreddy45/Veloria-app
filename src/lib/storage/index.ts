// ============================================================
// Object storage facade.
//
// Selects a driver from STORAGE_DRIVER ("db" default | "s3") and exposes the
// small surface the rest of the app uses. With the default driver nothing
// changes: files keep living inline in the DB. Flip STORAGE_DRIVER=s3 (plus the
// STORAGE_S3_* vars) and new uploads go to the bucket while every existing
// data-URL keeps working — readers accept both forms (see ./data-url).
//
// URLs: getObjectUrl() returns the app's own authenticated proxy route by
// default (/api/files/<key>), so bucket hostnames never reach the browser. Set
// STORAGE_PUBLIC_BASE_URL (a CDN / public bucket origin) to hand out direct
// public URLs instead. presignObjectUrl() is there for the rare caller that
// needs a time-limited direct link.
// ============================================================

import { dbDriver } from "./db";
import type { PutObjectInput, StorageDriver, StoredObject } from "./driver";
import { proxyUrlForKey } from "./refs";
import { readS3Config, s3Driver } from "./s3";

export type { PutObjectInput, StorageDriver, StoredObject, StoredObjectStream } from "./driver";
export { ObjectNotFoundError } from "./s3";
export * from "./refs";

export type StorageDriverName = "db" | "s3";

export function storageDriverName(): StorageDriverName {
  return (process.env.STORAGE_DRIVER ?? "db").trim().toLowerCase() === "s3" ? "s3" : "db";
}

let warnedMisconfigured = false;

/**
 * True only when STORAGE_DRIVER=s3 AND the bucket/credentials are present.
 * A half-configured "s3" is treated as disabled (with one warning) rather than
 * failing every upload in the app.
 */
export function isObjectStorageEnabled(): boolean {
  if (storageDriverName() !== "s3") return false;
  if (readS3Config()) return true;
  if (!warnedMisconfigured) {
    warnedMisconfigured = true;
    console.warn(
      "[storage] STORAGE_DRIVER=s3 but STORAGE_S3_BUCKET / STORAGE_S3_ACCESS_KEY / STORAGE_S3_SECRET_KEY are missing — falling back to inline (db) storage."
    );
  }
  return false;
}

/**
 * The active driver. Reads of EXISTING s3 refs must work even when new writes
 * are pointed back at the DB (e.g. a rollback of STORAGE_DRIVER after a partial
 * migration), so the S3 driver is returned whenever its config is present.
 */
export function getStorageDriver(): StorageDriver {
  if (readS3Config()) return s3Driver;
  return dbDriver;
}

export function putObject(input: PutObjectInput): Promise<{ bucket: string; key: string }> {
  return getStorageDriver().putObject(input);
}

export function getObject(key: string, bucket?: string): Promise<StoredObject> {
  return getStorageDriver().getObject(key, bucket);
}

export function deleteObject(key: string, bucket?: string): Promise<void> {
  return getStorageDriver().deleteObject(key, bucket);
}

/**
 * A URL the browser can load for this key. Public base URL when configured,
 * else the authenticated proxy route. Async so a presigning driver could be
 * swapped in without changing callers.
 */
export async function getObjectUrl(key: string): Promise<string> {
  const base = process.env.STORAGE_PUBLIC_BASE_URL?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return proxyUrlForKey(key);
}

/** A time-limited direct link to the object (default 1h). Requires the s3 driver. */
export function presignObjectUrl(key: string, bucket?: string, expiresInSeconds = 3600): Promise<string> {
  return getStorageDriver().presignGetUrl(key, bucket, expiresInSeconds);
}
