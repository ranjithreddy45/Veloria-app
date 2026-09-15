// The contract every storage backend implements. Kept in its own file so the
// drivers and the facade can import the types without importing each other.

export interface StoredObject {
  body: Buffer;
  contentType: string | null;
  contentLength: number;
  etag: string | null;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  /** Override the configured bucket (rarely needed). */
  bucket?: string;
}

export interface StoredObjectStream {
  stream: ReadableStream<Uint8Array>;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
}

export interface StorageDriver {
  readonly name: "db" | "s3";
  /** The bucket new objects are written to. Throws when not configured. */
  bucket(): string;
  putObject(input: PutObjectInput): Promise<{ bucket: string; key: string }>;
  getObject(key: string, bucket?: string): Promise<StoredObject>;
  /** Streamed read for the proxy route — bytes are not buffered in memory. */
  getObjectStream(key: string, bucket?: string): Promise<StoredObjectStream>;
  deleteObject(key: string, bucket?: string): Promise<void>;
  /** A time-limited direct URL (not used by default — the app proxies). */
  presignGetUrl(key: string, bucket?: string, expiresInSeconds?: number): Promise<string>;
}
