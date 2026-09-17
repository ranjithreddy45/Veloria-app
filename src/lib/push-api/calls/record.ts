import { CallDisposition, CommunicationDirection, CommunicationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/lead-capture";
import { logActivity } from "@/lib/activity-logger";
import { recordFirstContact } from "@/lib/crm/first-contact";
import { PushApiError } from "../errors";
import { ingestPushLead, samePhone, type IngestContext } from "../leads/ingest";
import { withIngestLocks } from "../leads/ingest-lock";
import { parsePushLead } from "../leads/schema";
import type { CallStatus, PushCall } from "./schema";

// ============================================================
// Recording a pushed call against a lead.
//
// Calls are stored exactly as the CallVibe import stores them — one
// Communication (type CALL) with a CallLog — keyed by
// CallLog.externalCallId = "callvibe:<external_call_id>". A call that arrives
// by push and is later read by the hourly import (or the other way round) is
// therefore recorded once, and the call-insights dialog renders both the same.
//
// Which lead:
//   1. lead_id, when sent — it must exist (a wrong id is an error, not a guess)
//   2. otherwise the phone INCLUDING country code: the contact's newest open
//      lead, else its newest lead of any status
//   3. otherwise a new lead, through the lead push's own ingest (its locks,
//      daily cap, assignment rules and SLA clock), with source "callvibe"
// ============================================================

export const CALLVIBE_PUSH_SOURCE = "callvibe";
const CLOSED_STATUSES = ["WON", "LOST"];

export interface RecordCallResult {
  callId: string;
  leadId: string;
  contactId: string;
  leadCreated: boolean;
  duplicate: boolean;
  matchedBy: "lead_id" | "phone" | "created" | "external_call_id";
}

const DISPOSITION: Record<CallStatus, CallDisposition> = {
  completed: CallDisposition.COMPLETED,
  no_answer: CallDisposition.NO_ANSWER,
  busy: CallDisposition.BUSY,
  voicemail: CallDisposition.VOICEMAIL,
  wrong_number: CallDisposition.WRONG_NUMBER,
  callback_requested: CallDisposition.CALLBACK_REQUESTED,
};

export async function recordPushCall(call: PushCall, ctx: IngestContext): Promise<RecordCallResult> {
  const externalCallId = call.externalCallId ? `callvibe:${call.externalCallId}` : null;
  // Two pushes of one call can't both write it. (The lead-creation step takes its own, different locks.)
  const keys = externalCallId ? [`call:${externalCallId}`] : [];
  return withIngestLocks(keys, () => recordLocked(call, externalCallId, ctx));
}

async function recordLocked(call: PushCall, externalCallId: string | null, ctx: IngestContext): Promise<RecordCallResult> {
  if (externalCallId) {
    const existing = await prisma.callLog.findFirst({
      where: { externalCallId },
      select: { communicationId: true, contactId: true, communication: { select: { metadata: true } } },
    });
    if (existing) {
      const meta = (existing.communication.metadata ?? {}) as { leadId?: string };
      const leadId = meta.leadId ?? (await newestLeadFor([existing.contactId]))?.id ?? "";
      return {
        callId: existing.communicationId,
        leadId,
        contactId: existing.contactId,
        leadCreated: false,
        duplicate: true,
        matchedBy: "external_call_id",
      };
    }
  }

  const target = await resolveLead(call, ctx);
  const agentId = await resolveAgentId(call);
  const at = new Date(call.callDate);

  const metadata = {
    provider: "CALLVIBE",
    via: "push_api",
    callId: call.externalCallId ?? null,
    leadId: target.leadId,
    isAiTranscription: true,
    summary: call.summary,
    actionItems: call.actionItems.length ? call.actionItems : null,
    aiScore: call.aiScore ?? null,
    aiInsights: call.aiInsights ?? null,
    agentName: call.agentName ?? null,
    agentEmail: call.agentEmail ?? null,
    recordingAvailable: Boolean(call.recordingUrl),
    apiKeyId: ctx.apiKeyId,
    requestId: ctx.requestId,
  } as Prisma.InputJsonValue;

  const communication = await prisma.communication.create({
    data: {
      type: CommunicationType.CALL,
      subject: call.summary.slice(0, 180),
      content: call.summary,
      direction: call.direction === "inbound" ? CommunicationDirection.INBOUND : CommunicationDirection.OUTBOUND,
      contactId: target.contactId,
      createdById: agentId.id,
      createdAt: at,
      metadata,
      sentiment: call.sentiment ? call.sentiment.toUpperCase() : null,
      sentimentAt: call.sentiment ? at : null,
      callLog: {
        create: {
          disposition: DISPOSITION[call.status],
          durationSeconds: call.durationSeconds,
          recordingUrl: call.recordingUrl ?? null,
          externalCallId,
          notes: call.summary,
          tags: ["callvibe", ...(call.sentiment ? [call.sentiment] : [])],
          contactId: target.contactId,
          agentId: agentId.id,
          createdAt: at,
        },
      },
    },
    select: { id: true },
  });

  try {
    await logActivity({
      userId: agentId.id,
      action: "CALLVIBE_CALL_RECORDED",
      entityType: "Lead",
      entityId: target.leadId,
      changes: {
        via: "push_api",
        communication_id: communication.id,
        external_call_id: call.externalCallId ?? null,
        status: call.status,
        ai_score: call.aiScore ?? null,
        request_id: ctx.requestId,
      },
    });
  } catch {
    // PushApiRequestLog has the request; the activity row is a convenience.
  }

  // A connected outbound call by a known rep is a real first contact: it stops
  // the lead's speed-to-lead clock (and scores it) the same way a logged call does.
  if (call.direction === "outbound" && call.status === "completed" && agentId.known) {
    await recordFirstContact(target.leadId, agentId.id);
  }

  return {
    callId: communication.id,
    leadId: target.leadId,
    contactId: target.contactId,
    leadCreated: target.created,
    duplicate: false,
    matchedBy: target.matchedBy,
  };
}

async function resolveLead(
  call: PushCall,
  ctx: IngestContext
): Promise<{ leadId: string; contactId: string; created: boolean; matchedBy: "lead_id" | "phone" | "created" }> {
  if (call.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: call.leadId, deletedAt: null },
      select: { id: true, contactId: true },
    });
    if (!lead) throw new PushApiError("VALIDATION_ERROR", "Invalid request", { lead_id: "No lead with this id" });
    return { leadId: lead.id, contactId: lead.contactId, created: false, matchedBy: "lead_id" };
  }

  const phone = call.phone!;
  const last10 = phone.replace(/\D/g, "").slice(-10);
  const candidates = await prisma.$queryRaw<{ id: string; phone: string | null }[]>`
    SELECT "id", "phone" FROM "Contact"
    WHERE "deletedAt" IS NULL
      AND right(regexp_replace(coalesce("phone", ''), '\\D', '', 'g'), 10) = ${last10}::text`;
  const contactIds = candidates.filter((c) => samePhone(c.phone, phone)).map((c) => c.id);
  const existing = contactIds.length ? await newestLeadFor(contactIds) : null;
  if (existing) return { leadId: existing.id, contactId: existing.contactId, created: false, matchedBy: "phone" };

  // Nobody we hold a lead for: create one the way a lead push would.
  const parsed = parsePushLead({ source: CALLVIBE_PUSH_SOURCE, phone, name: call.contactName });
  if (!parsed.ok) throw new PushApiError("VALIDATION_ERROR", "Invalid request", parsed.fields);
  const ingested = await ingestPushLead(parsed.lead, ctx);
  return {
    leadId: ingested.leadId,
    contactId: ingested.contactId,
    created: ingested.created,
    matchedBy: ingested.created ? "created" : "phone",
  };
}

/** The newest open lead across these contacts, else the newest lead of any status. Never a deleted one. */
async function newestLeadFor(contactIds: string[]) {
  const leads = await prisma.lead.findMany({
    where: { contactId: { in: contactIds }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, contactId: true, status: true },
    take: 50,
  });
  return leads.find((l) => !CLOSED_STATUSES.includes(l.status)) ?? leads[0] ?? null;
}

/** The Veloria user who made the call: by email, then by exact name; else the system user. */
async function resolveAgentId(call: PushCall): Promise<{ id: string; known: boolean }> {
  if (call.agentEmail) {
    const byEmail = await prisma.user.findFirst({ where: { email: call.agentEmail, isActive: true }, select: { id: true } });
    if (byEmail) return { id: byEmail.id, known: true };
  }
  if (call.agentName) {
    const byName = await prisma.user.findMany({
      where: { name: { equals: call.agentName, mode: "insensitive" }, isActive: true },
      select: { id: true },
      take: 2,
    });
    // Two people with one name: don't credit either.
    if (byName.length === 1) return { id: byName[0]!.id, known: true };
  }
  const systemId = await getSystemUserId();
  if (!systemId) throw new Error("push call: no active admin user to record the call as");
  return { id: systemId, known: false };
}
