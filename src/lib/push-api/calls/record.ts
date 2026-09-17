import { CallDisposition, CommunicationDirection, CommunicationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/lead-capture";
import { logActivity } from "@/lib/activity-logger";
import { recordFirstContact } from "@/lib/crm/first-contact";
import { insertCallOnce } from "@/lib/telephony/call-dedupe";
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
//   1. lead_id, when sent. If it no longer exists (merged/deleted) the phone is
//      used instead; with no phone that's an error. A lead_id whose contact has
//      a different phone than the one sent is refused.
//   2. otherwise the phone INCLUDING country code: the contact's newest open
//      lead, else its newest lead of any status
//   3. otherwise a new lead, through the lead push's own ingest (its locks,
//      daily cap, assignment rules and SLA clock), with source "callvibe"
// ============================================================

export const CALLVIBE_PUSH_SOURCE = "callvibe";
const CLOSED_STATUSES = ["WON", "LOST"];

export interface RecordCallResult {
  callId: string;
  /** Null only for a call already recorded by the import on a contact with no lead. */
  leadId: string | null;
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
  const externalCallId = `callvibe:${call.externalCallId}`;
  // Two pushes of one call don't both resolve (and maybe create) its lead. The
  // write itself is made atomic by insertCallOnce, which also covers the import.
  return withIngestLocks([`call:${externalCallId}`], () => recordLocked(call, externalCallId, ctx));
}

async function duplicateOf(existing: { communicationId: string; contactId: string }): Promise<RecordCallResult> {
  const comm = await prisma.communication.findUnique({ where: { id: existing.communicationId }, select: { metadata: true } });
  const meta = (comm?.metadata ?? {}) as { leadId?: string };
  const leadId = meta.leadId ?? (await newestLeadFor([existing.contactId]))?.id ?? null;
  return {
    callId: existing.communicationId,
    leadId,
    contactId: existing.contactId,
    leadCreated: false,
    duplicate: true,
    matchedBy: "external_call_id",
  };
}

async function recordLocked(call: PushCall, externalCallId: string, ctx: IngestContext): Promise<RecordCallResult> {
  const already = await prisma.callLog.findFirst({ where: { externalCallId }, select: { communicationId: true, contactId: true } });
  if (already) return duplicateOf(already);

  const target = await resolveLead(call, ctx);
  const agent = await resolveAgent(call);
  const at = new Date(call.callDate);

  const metadata = {
    provider: "CALLVIBE",
    via: "push_api",
    callId: call.externalCallId,
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

  const written = await insertCallOnce(externalCallId, (tx) =>
    tx.communication.create({
      data: {
        type: CommunicationType.CALL,
        subject: call.summary.slice(0, 180),
        content: call.summary,
        direction: call.direction === "inbound" ? CommunicationDirection.INBOUND : CommunicationDirection.OUTBOUND,
        contactId: target.contactId,
        createdById: agent.id,
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
            agentId: agent.id,
            createdAt: at,
          },
        },
      },
      select: { id: true },
    })
  );
  // The import (or a push whose lease had lapsed) wrote it first.
  if (!written.inserted) return duplicateOf(written.existing);
  const communication = written.value;

  try {
    await logActivity({
      userId: agent.id,
      action: "CALLVIBE_CALL_RECORDED",
      entityType: "Lead",
      entityId: target.leadId,
      changes: {
        via: "push_api",
        communication_id: communication.id,
        external_call_id: call.externalCallId,
        status: call.status,
        ai_score: call.aiScore ?? null,
        request_id: ctx.requestId,
      },
    });
  } catch {
    // PushApiRequestLog has the request; the activity row is a convenience.
  }

  // A connected outbound call by a known rep is a real first contact: it stops
  // the lead's speed-to-lead clock at the time of the call. Never for a lead
  // this very call created — that would score every cold call as an instant response.
  if (call.direction === "outbound" && call.status === "completed" && agent.known && !target.created) {
    await recordFirstContact(target.leadId, agent.id, at);
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
      select: { id: true, contactId: true, contact: { select: { phone: true } } },
    });
    if (lead) {
      // Both sent and they disagree: filing the call under either could be the wrong customer.
      if (call.phone && lead.contact.phone && !samePhone(lead.contact.phone, call.phone)) {
        throw new PushApiError("VALIDATION_ERROR", "Invalid request", { phone: "Doesn't match the phone of the lead given in lead_id" });
      }
      return { leadId: lead.id, contactId: lead.contactId, created: false, matchedBy: "lead_id" };
    }
    // A merged or deleted lead: fall back to the phone when there is one.
    if (!call.phone) throw new PushApiError("VALIDATION_ERROR", "Invalid request", { lead_id: "No lead with this id" });
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

/** Roles a call can be credited to. Admins are excluded so a key can't file calls (or earn points) as them. */
const AGENT_ROLES = [
  "SALES_EXEC",
  "SALES_HEAD",
  "EVENT_COORDINATOR",
  "STAFF",
  "BD_EXECUTIVE",
  "BD_HEAD",
  "OPERATIONS",
  "OPERATIONS_HEAD",
  "PROPERTY_MANAGER",
  "MARKETING",
] as const;

/** The Veloria user who made the call: by email, then by exact name; else the system user. */
async function resolveAgent(call: PushCall): Promise<{ id: string; known: boolean }> {
  const roleFilter = { isActive: true, role: { in: [...AGENT_ROLES] } };
  if (call.agentEmail) {
    const byEmail = await prisma.user.findFirst({ where: { email: call.agentEmail, ...roleFilter }, select: { id: true } });
    if (byEmail) return { id: byEmail.id, known: true };
  }
  if (call.agentName) {
    const byName = await prisma.user.findMany({
      where: { name: { equals: call.agentName, mode: "insensitive" }, ...roleFilter },
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
