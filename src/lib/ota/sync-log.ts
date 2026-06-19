import { prisma } from "@/lib/prisma";
import type { OtaSyncDirection, OtaSyncStatus } from "@prisma/client";

// ============================================================
// OtaSyncLog writer (best-effort, append-only)
// ============================================================
// Records every outbound feed fetch and inbound ingest for observability.
// MUST never throw: a logging failure can't be allowed to break a PUBLIC
// feed/ingest response. On error we console.error and move on.

const PAYLOAD_REF_MAX = 4000; // cap stored payload snapshot to avoid huge rows

export interface LogOtaSyncParams {
  channelId: string;
  direction: OtaSyncDirection;
  status: OtaSyncStatus;
  recordCount?: number;
  errorCount?: number;
  message?: string;
  payloadRef?: string;
}

/**
 * Append an OtaSyncLog row and bump the channel's last*SyncAt timestamp.
 * Returns void; all failures are swallowed.
 */
export async function logOtaSync(params: LogOtaSyncParams): Promise<void> {
  const {
    channelId,
    direction,
    status,
    recordCount = 0,
    errorCount = 0,
    message,
    payloadRef,
  } = params;

  try {
    await prisma.otaSyncLog.create({
      data: {
        channelId,
        direction,
        status,
        recordCount,
        errorCount,
        message: message ? message.slice(0, 2000) : null,
        payloadRef: payloadRef ? payloadRef.slice(0, PAYLOAD_REF_MAX) : null,
      },
    });
  } catch (error) {
    console.error("[OtaSyncLog] Failed to write sync log:", error);
  }

  // Bump the appropriate last-sync marker (separate try so a failure here
  // never affects the log write above or the caller's response).
  try {
    await prisma.otaChannel.update({
      where: { id: channelId },
      data:
        direction === "OUTBOUND"
          ? { lastOutboundSyncAt: new Date() }
          : { lastInboundSyncAt: new Date() },
    });
  } catch (error) {
    console.error("[OtaSyncLog] Failed to bump lastSyncAt:", error);
  }
}
