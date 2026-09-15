// ============================================================
// S3-compatible driver (AWS S3, MinIO, Cloudflare R2, Backblaze B2, …).
//
// Env:
//   STORAGE_S3_ENDPOINT          e.g. http://127.0.0.1:9000 (MinIO) — omit for AWS
//   STORAGE_S3_REGION            default "us-east-1"
//   STORAGE_S3_BUCKET            required
//   STORAGE_S3_ACCESS_KEY        required
//   STORAGE_S3_SECRET_KEY        required
//   STORAGE_S3_FORCE_PATH_STYLE  "true" for MinIO (bucket in the path, not the host)
//
// The client is built lazily and cached on globalThis so a hot-reloaded dev
// server and a warm serverless instance both reuse one connection pool.
// ============================================================

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import type { StorageDriver, StoredObject, StoredObjectStream } from "./driver";

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
}

/** Reads the STORAGE_S3_* env; null when a required value is missing. */
export function readS3Config(): S3Config | null {
  const bucket = process.env.STORAGE_S3_BUCKET?.trim();
  const accessKey = process.env.STORAGE_S3_ACCESS_KEY?.trim();
  const secretKey = process.env.STORAGE_S3_SECRET_KEY?.trim();
  if (!bucket || !accessKey || !secretKey) return null;
  return {
    endpoint: process.env.STORAGE_S3_ENDPOINT?.trim() || undefined,
    region: process.env.STORAGE_S3_REGION?.trim() || "us-east-1",
    bucket,
    accessKey,
    secretKey,
    forcePathStyle: /^(1|true|yes)$/i.test(process.env.STORAGE_S3_FORCE_PATH_STYLE ?? ""),
  };
}

const g = globalThis as unknown as { __veloriaS3?: { client: S3Client; config: S3Config } };

function getClient(): { client: S3Client; config: S3Config } {
  if (g.__veloriaS3) return g.__veloriaS3;
  const config = readS3Config();
  if (!config) {
    throw new Error(
      "Object storage is not configured: set STORAGE_S3_BUCKET, STORAGE_S3_ACCESS_KEY and STORAGE_S3_SECRET_KEY."
    );
  }
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
  });
  g.__veloriaS3 = { client, config };
  return g.__veloriaS3;
}

export class ObjectNotFoundError extends Error {
  constructor(bucket: string, key: string) {
    super(`Object not found: s3://${bucket}/${key}`);
    this.name = "ObjectNotFoundError";
  }
}

function isNotFound(e: unknown): boolean {
  if (e instanceof S3ServiceException) {
    return e.name === "NoSuchKey" || e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
  }
  return false;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  // Node runtime: the SDK returns a Readable with transformToByteArray().
  const b = body as { transformToByteArray?: () => Promise<Uint8Array> } & Readable;
  if (typeof b.transformToByteArray === "function") return Buffer.from(await b.transformToByteArray());
  const chunks: Buffer[] = [];
  for await (const chunk of b as Readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export const s3Driver: StorageDriver = {
  name: "s3",

  bucket() {
    return getClient().config.bucket;
  },

  async putObject({ key, body, contentType, bucket }) {
    const { client, config } = getClient();
    const target = bucket ?? config.bucket;
    await client.send(
      new PutObjectCommand({ Bucket: target, Key: key, Body: body, ContentType: contentType, ContentLength: body.length })
    );
    return { bucket: target, key };
  },

  async getObject(key, bucket): Promise<StoredObject> {
    const { client, config } = getClient();
    const target = bucket ?? config.bucket;
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: target, Key: key }));
      const buffer = await streamToBuffer(res.Body);
      return {
        body: buffer,
        contentType: res.ContentType ?? null,
        contentLength: res.ContentLength ?? buffer.length,
        etag: res.ETag ?? null,
      };
    } catch (e) {
      if (isNotFound(e)) throw new ObjectNotFoundError(target, key);
      throw e;
    }
  },

  async getObjectStream(key, bucket): Promise<StoredObjectStream> {
    const { client, config } = getClient();
    const target = bucket ?? config.bucket;
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: target, Key: key }));
      const body = res.Body as { transformToWebStream?: () => ReadableStream<Uint8Array> } | undefined;
      let stream: ReadableStream<Uint8Array>;
      if (body && typeof body.transformToWebStream === "function") {
        stream = body.transformToWebStream();
      } else {
        const buf = await streamToBuffer(res.Body);
        stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(buf));
            controller.close();
          },
        });
      }
      return {
        stream,
        contentType: res.ContentType ?? null,
        contentLength: res.ContentLength ?? null,
        etag: res.ETag ?? null,
      };
    } catch (e) {
      if (isNotFound(e)) throw new ObjectNotFoundError(target, key);
      throw e;
    }
  },

  async deleteObject(key, bucket) {
    const { client, config } = getClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket ?? config.bucket, Key: key }));
  },

  async presignGetUrl(key, bucket, expiresInSeconds = 3600) {
    const { client, config } = getClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket ?? config.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  },
};
