// ============================================================
// "db" driver — the default, and a deliberate no-op.
//
// With STORAGE_DRIVER unset (or "db") nothing leaves Postgres: uploads stay as
// base64 data-URLs in their @db.Text columns exactly as before, and
// storeIncomingFile() returns the data-URL it was given. Every method here
// throws, because reaching one means a caller skipped isObjectStorageEnabled()
// — a loud failure beats a silent write to nowhere.
// ============================================================

import type { StorageDriver } from "./driver";

const DISABLED =
  "Object storage is disabled (STORAGE_DRIVER is not \"s3\"). Files are stored inline in the database.";

export const dbDriver: StorageDriver = {
  name: "db",
  bucket() {
    throw new Error(DISABLED);
  },
  async putObject() {
    throw new Error(DISABLED);
  },
  async getObject() {
    throw new Error(DISABLED);
  },
  async getObjectStream() {
    throw new Error(DISABLED);
  },
  async deleteObject() {
    throw new Error(DISABLED);
  },
  async presignGetUrl() {
    throw new Error(DISABLED);
  },
};
