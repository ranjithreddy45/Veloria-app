// ============================================================
// CallVibe call sync — pulls call records into Communication + CallLog.
// ------------------------------------------------------------
// CallVibe has no outbound webhook to a customer endpoint, so this is the
// import path: sign in, read GET /calls for the window since the last cursor,
// and write one Communication (+ nested CallLog) per call.
//
// TWO THINGS THIS DOES THAT THE RUNO IMPORT DID NOT:
//
//  1. An inbound call from a number nobody knows goes through
//     handleMissedCallRescue(), which is the app's existing choke point for
//     turning a ring into a lead — contact, lead, assignment, first-response
//     SLA clock and the instant WhatsApp reply. The Runo webhook wrote an
//     orphan "Unknown Caller" contact with no lead and no SLA, which is the
//     exact outcome missed-call-rescue was built to prevent.
//
//  2. Every write is keyed on CallLog.externalCallId = "callvibe:<call id>",
//     so re-running the sync over an overlapping window imports nothing twice.
//     (externalCallId has no unique index, matching the rest of this codebase,
//     so the guard is a findFirst — a duplicate needs two syncs racing on the
//     same call, and the lane runs one at a time.)
//
// The AI fields are stored under the same metadata keys the call-insights
// dialog already reads (isAiTranscription, transcription, chapters,
// keyQuestions, issuesDiscussed, actionItems), so transcripts and summaries
// render in the CRM without touching that component.
// ============================================================

import { CallDisposition, CommunicationDirection, CommunicationType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { handleMissedCallRescue } from "@/lib/telephony/missed-call-rescue";
import { listCalls, type CallVibeCall, type CallVibeCreds } from "@/lib/integrations/callvibe";

export interface CallVibeSyncSummary {
  ok: boolean;
  /** Records read from CallVibe. */
  fetched: number;
  /** New Communication + CallLog rows written. */
  imported: number;
  /** Already present from an earlier run. */
  deduped: number;
  /** Unusable records (no phone, no id). */
  skipped: number;
  /** Inbound calls from unknown numbers routed into the lead pipeline. */
  rescued: number;
  errors: number;
  latestCallAt: string | null;
  note: string;
}

const PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;
/** Re-read a little before the cursor: a call is written to CallVibe after it
 *  ends, so a call still in progress at the last run appears just behind it. */
const OVERLAP_MINUTES = 15;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dispositionFor(call: CallVibeCall): CallDisposition {
  const raw = `${call.raw.status ?? ""} ${call.raw.disposition ?? ""} ${call.raw.outcome ?? ""}`.toLowerCase();
  if (/voice.?mail|answering.?machine/.test(raw)) return CallDisposition.VOICEMAIL;
  if (/busy/.test(raw)) return CallDisposition.BUSY;
  if (/wrong.?number/.test(raw)) return CallDisposition.WRONG_NUMBER;
  if (/call.?back/.test(raw)) return CallDisposition.CALLBACK_REQUESTED;
  return call.answered ? CallDisposition.COMPLETED : CallDisposition.NO_ANSWER;
}

/** Resolve the Veloria user who made or took the call. */
async function resolveAgentId(call: CallVibeCall, fallbackUserId: string): Promise<string> {
  if (call.agentEmail) {
    const byEmail = await prisma.user.findFirst({
      where: { email: call.agentEmail.toLowerCase().trim(), isActive: true },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }
  if (call.agentName) {
    const byName = await prisma.user.findFirst({
      where: { name: { equals: call.agentName.trim(), mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    if (byName) return byName.id;
  }
  return fallbackUserId;
}

function summaryContent(call: CallVibeCall): string {
  if (call.summary) return call.summary;
  const direction = call.inbound ? "Inbound" : "Outbound";
  const state = call.answered ? "answered" : "not answered";
  return `${direction} call via CallVibe — ${state}, ${call.durationSeconds}s.`;
}

/**
 * Import CallVibe calls. Never throws: it is run by a cron lane, where a thrown
 * error costs the whole lane.
 */
export async function syncCallVibeCalls(opts?: {
  /** Override the window start. Defaults to the cursor, else syncWindowHours. */
  sinceHours?: number;
  startDate?: string;
  endDate?: string;
  maxPages?: number;
  dryRun?: boolean;
  /** Run even when syncEnabled is off (the manual "Sync now" button). */
  force?: boolean;
}): Promise<CallVibeSyncSummary> {
  const empty: CallVibeSyncSummary = {
    ok: true,
    fetched: 0,
    imported: 0,
    deduped: 0,
    skipped: 0,
    rescued: 0,
    errors: 0,
    latestCallAt: null,
    note: "",
  };

  const config = await prisma.callVibeConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!config) return { ...empty, note: "CallVibe is not configured" };
  if (!config.syncEnabled && !opts?.force) {
    return { ...empty, note: "CallVibe sync is switched off" };
  }

  const creds: CallVibeCreds = {
    baseUrl: config.baseUrl,
    email: config.email,
    password: config.password,
  };

  const now = new Date();
  const windowStart = opts?.startDate
    ? new Date(`${opts.startDate}T00:00:00.000Z`)
    : new Date(
        (config.lastCallAt
          ? config.lastCallAt.getTime() - OVERLAP_MINUTES * 60_000
          : now.getTime() - (opts?.sinceHours ?? config.syncWindowHours) * 3_600_000)
      );
  const windowEnd = opts?.endDate ? new Date(`${opts.endDate}T23:59:59.999Z`) : now;

  const summary: CallVibeSyncSummary = { ...empty };
  let latestCallAt: Date | null = config.lastCallAt;
  const maxPages = opts?.maxPages ?? DEFAULT_MAX_PAGES;

  for (let page = 0; page < maxPages; page++) {
    const res = await listCalls(creds, {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      startDate: ymd(windowStart),
      endDate: ymd(windowEnd),
    });

    if (!res.success) {
      summary.ok = false;
      summary.errors++;
      summary.note = res.error ?? "CallVibe read failed";
      break;
    }

    const calls = res.data?.calls ?? [];
    summary.fetched += res.data?.rawCount ?? calls.length;
    if (calls.length === 0) break;

    for (const call of calls) {
      try {
        // The date filters are day-granular, so drop anything outside the real
        // window rather than re-importing a whole day every run.
        if (call.startedAt < windowStart || call.startedAt > windowEnd) {
          summary.skipped++;
          continue;
        }
        if (!call.phone) {
          summary.skipped++;
          continue;
        }

        const externalCallId = `callvibe:${call.id}`;
        const existing = await prisma.callLog.findFirst({
          where: { externalCallId },
          select: { id: true },
        });
        if (existing) {
          summary.deduped++;
          if (!latestCallAt || call.startedAt > latestCallAt) latestCallAt = call.startedAt;
          continue;
        }

        if (opts?.dryRun) {
          summary.imported++;
          if (!latestCallAt || call.startedAt > latestCallAt) latestCallAt = call.startedAt;
          continue;
        }

        const digits = call.phone.replace(/\D/g, "").slice(-10);
        let contact = digits
          ? await prisma.contact.findFirst({
              where: { phone: { contains: digits } },
              select: { id: true },
            })
          : null;

        // An inbound ring from a number nobody knows is a lead, not a stray
        // contact row. This is the same choke point the IVR path uses.
        if (!contact && call.inbound) {
          const rescue = await handleMissedCallRescue({
            provider: "CALLVIBE",
            externalCallId,
            callerPhone: call.phone,
            receivedAt: call.startedAt,
            rawStatus: call.answered ? "ANSWERED" : "MISSED",
          });
          if (rescue.contactId) {
            contact = { id: rescue.contactId };
            summary.rescued++;
          } else if (digits) {
            contact = await prisma.contact.findFirst({
              where: { phone: { contains: digits } },
              select: { id: true },
            });
            if (contact) summary.rescued++;
          }
        }

        // Outbound to an unknown number: somebody dialled it, so keep the call
        // record. A bare contact, no lead — inventing a lead for a number the
        // team called would corrupt the funnel.
        if (!contact) {
          contact = await prisma.contact.create({
            data: { firstName: "Unknown", lastName: "Caller", phone: call.phone },
            select: { id: true },
          });
        }

        const agentId = await resolveAgentId(call, config.createdById);

        const metadata: Prisma.InputJsonValue = {
          provider: "CALLVIBE",
          callId: call.id,
          isAiTranscription: Boolean(call.transcript || call.summary),
          summary: call.summary,
          transcription: call.transcript,
          actionItems: call.actionItems ?? null,
          chapters: call.chapters ?? null,
          keyQuestions: call.keyQuestions ?? null,
          issuesDiscussed: call.issuesDiscussed ?? null,
          qualityScore: call.qualityScore,
          category: call.category,
          source: call.source,
          vendor: call.vendor,
          recordingAvailable: call.recordingAvailable,
          callvibePayload: call.raw as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue;

        await prisma.communication.create({
          data: {
            type: CommunicationType.CALL,
            subject: call.summary ? call.summary.slice(0, 180) : null,
            content: summaryContent(call),
            direction: call.inbound
              ? CommunicationDirection.INBOUND
              : CommunicationDirection.OUTBOUND,
            contactId: contact.id,
            createdById: agentId,
            createdAt: call.startedAt,
            metadata,
            sentiment: call.sentiment,
            sentimentScore: call.sentimentScore,
            sentimentAt: call.sentiment ? call.startedAt : null,
            callLog: {
              create: {
                disposition: dispositionFor(call),
                durationSeconds: call.durationSeconds,
                recordingUrl: call.recordingUrl,
                externalCallId,
                notes: call.summary,
                tags: [
                  "callvibe",
                  ...(call.category ? [call.category] : []),
                  ...(call.sentiment ? [call.sentiment.toLowerCase()] : []),
                ],
                contactId: contact.id,
                agentId,
                createdAt: call.startedAt,
              },
            },
          },
        });

        summary.imported++;
        if (!latestCallAt || call.startedAt > latestCallAt) latestCallAt = call.startedAt;
      } catch (e) {
        summary.errors++;
        console.error("[CallVibe] failed to import call", call.id, e);
      }
    }

    if (calls.length < PAGE_SIZE) break;
  }

  if (summary.errors > 0) summary.ok = false;
  summary.latestCallAt = latestCallAt ? latestCallAt.toISOString() : null;
  if (!summary.note) {
    summary.note = `${summary.imported} imported, ${summary.deduped} already had, ${summary.rescued} turned into leads`;
  }

  if (!opts?.dryRun) {
    await prisma.callVibeConfig
      .update({
        where: { id: config.id },
        data: {
          lastSyncAt: new Date(),
          lastCallAt: latestCallAt ?? config.lastCallAt,
          lastSyncNote: summary.note.slice(0, 500),
        },
      })
      .catch((e) => console.error("[CallVibe] could not update the sync cursor", e));
  }

  return summary;
}
