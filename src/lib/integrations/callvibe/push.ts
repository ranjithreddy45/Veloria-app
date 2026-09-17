import { after } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getActiveCallVibeConfig, type ActiveCallVibeConfig } from "@/lib/integrations/callvibe/credentials";
import {
  addLeadNote,
  listAgentNames,
  toE164,
  upsertLeadByPhone,
  type CallVibeWriteError,
} from "@/lib/integrations/callvibe/write-client";
import type { CallVibeCreds } from "@/lib/integrations/callvibe";

// ============================================================
// CallVibe lead push — the job queue.
//
// Every push is a CallVibePushJob row. A contact has at most one live job
// (dedupeKey = contact id while PENDING/RETRY/RUNNING), so repeated clicks,
// bulk actions and auto-push collapse into one push. The first attempt runs
// right after the response (after()); retries run on the fast cron lane with
// exponential backoff. Pushing is keyed by the phone number, so re-running a
// job updates the same CallVibe lead instead of creating a second one.
//
// Nothing here throws into the caller: saving a contact never depends on
// CallVibe being up.
// ============================================================

export type CallVibePushTrigger = "manual" | "bulk" | "auto" | "lead_button";

const LEASE_MS = 2 * 60_000;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60_000;
const AGENT_CACHE_MS = 10 * 60_000;

const dedupeKeyFor = (contactId: string) => `contact:${contactId}`;

// ------------------------------------------------------------ enqueue

/**
 * Queue a push for each contact. Returns the job ids (existing live jobs are
 * reused and brought forward). Contacts that don't exist are skipped.
 */
export async function enqueueCallVibePush(
  contactIds: string[],
  trigger: CallVibePushTrigger,
  requestedById?: string | null
): Promise<string[]> {
  const ids = [...new Set(contactIds)];
  const existing = await prisma.contact.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
  const jobIds: string[] = [];

  for (const { id: contactId } of existing) {
    const jobId = await enqueueOne(contactId, trigger, requestedById ?? null);
    if (jobId) jobIds.push(jobId);
    await prisma.contact.update({ where: { id: contactId }, data: { callvibeLastPushStatus: "PENDING" } });
  }
  return jobIds;
}

async function enqueueOne(contactId: string, trigger: CallVibePushTrigger, requestedById: string | null): Promise<string | null> {
  const dedupeKey = dedupeKeyFor(contactId);
  // Two passes: the live job can settle between our insert and our lookup.
  for (let pass = 0; pass < 2; pass++) {
    try {
      const job = await prisma.callVibePushJob.create({
        data: { contactId, trigger, dedupeKey, requestedById },
        select: { id: true },
      });
      return job.id;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
    const live = await prisma.callVibePushJob.findUnique({ where: { dedupeKey }, select: { id: true } });
    if (!live) continue;
    // Waiting: run it now. It reads the contact when it runs, so it carries this edit.
    const waiting = await prisma.callVibePushJob.updateMany({
      where: { id: live.id, status: { in: ["PENDING", "RETRY"] } },
      data: { nextRunAt: new Date() },
    });
    if (waiting.count === 1) return live.id;
    // Running: it may already have read the contact, so push again once it settles.
    const running = await prisma.callVibePushJob.updateMany({
      where: { id: live.id, status: "RUNNING" },
      data: { rerunRequested: true },
    });
    if (running.count === 1) return live.id;
  }
  return null;
}

/** Run jobs after the response is sent (or straight away outside a request). */
export function runCallVibePushJobsSoon(jobIds: string[]): void {
  if (jobIds.length === 0) return;
  const work = async () => {
    for (const id of jobIds) {
      try {
        await runCallVibePushJob(id);
      } catch (e) {
        console.error("[CallVibePush] job crashed:", id, e instanceof Error ? e.message : "unknown");
      }
    }
  };
  try {
    after(work);
  } catch {
    void work();
  }
}

/** Queue and start pushes. Never throws. */
export async function pushContactsToCallVibe(
  contactIds: string[],
  trigger: CallVibePushTrigger,
  requestedById?: string | null
): Promise<{ queued: number; error?: string }> {
  try {
    const jobIds = await enqueueCallVibePush(contactIds, trigger, requestedById);
    runCallVibePushJobsSoon(jobIds);
    return { queued: jobIds.length };
  } catch (e) {
    console.error("[CallVibePush] enqueue failed:", e instanceof Error ? e.message : "unknown");
    return { queued: 0, error: "Could not queue the push to CallVibe" };
  }
}

/**
 * Auto-push hook for a newly created lead's contact. Does nothing unless
 * CallVibe is connected and "Push new leads automatically" is on. Never throws.
 */
export async function autoPushContactToCallVibe(contactId: string): Promise<void> {
  try {
    const config = await getActiveCallVibeConfig();
    if (!config?.pushEnabled) return;
    await pushContactsToCallVibe([contactId], "auto");
  } catch (e) {
    console.error("[CallVibePush] auto-push skipped:", e instanceof Error ? e.message : "unknown");
  }
}

// ------------------------------------------------------------ run

/** Backoff for the attempt that just failed: 30s, 1m, 2m, 4m… capped at 1h, ±20% jitter, never sooner than Retry-After. */
export function retryDelayMs(attempt: number, retryAfterMs?: number, random: () => number = Math.random): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  const jittered = Math.round(exp * (0.8 + random() * 0.4));
  return Math.max(jittered, retryAfterMs ?? 0);
}

/** Claim a due job (or one whose worker died). Returns false if someone else has it. */
async function claim(jobId: string): Promise<boolean> {
  const now = new Date();
  const res = await prisma.callVibePushJob.updateMany({
    where: {
      id: jobId,
      OR: [
        { status: { in: ["PENDING", "RETRY"] }, nextRunAt: { lte: now } },
        { status: "RUNNING", lockedUntil: { lt: now } },
      ],
    },
    data: { status: "RUNNING", lockedUntil: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
  });
  return res.count === 1;
}

export interface PushOutcome {
  ok: boolean;
  error?: CallVibeWriteError;
  warning?: string;
  leadId?: string | null;
  e164?: string;
}

/** Run one job attempt end to end. Returns the job's new status, or null if it wasn't claimable. */
export async function runCallVibePushJob(jobId: string): Promise<string | null> {
  if (!(await claim(jobId))) return null;
  const job = await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId } });

  let outcome: PushOutcome;
  const config = await getActiveCallVibeConfig();
  if (!config) {
    outcome = {
      ok: false,
      error: { kind: "not_configured", retryable: false, message: "CallVibe isn't connected. Add the account in Settings → Integrations → CallVibe." },
    };
  } else {
    try {
      outcome = await pushContact(job.contactId, config);
    } catch (e) {
      console.error("[CallVibePush] unexpected error:", jobId, e instanceof Error ? e.message : "unknown");
      outcome = { ok: false, error: { kind: "server", retryable: true, message: "Something went wrong sending this contact to CallVibe" } };
    }
  }

  const now = new Date();
  const retry = !outcome.ok && outcome.error!.retryable && job.attempts < job.maxAttempts;
  const status = outcome.ok ? "SUCCESS" : retry ? "RETRY" : "FAILED";
  const message = outcome.ok ? (outcome.warning ?? null) : outcome.error!.message;
  if (!outcome.ok) {
    console.error(`[CallVibePush] job ${jobId} attempt ${job.attempts}: ${outcome.error!.kind}${retry ? " (will retry)" : ""}`);
  }

  const settled = await prisma.callVibePushJob.update({
    where: { id: jobId },
    select: { rerunRequested: true },
    data: {
      status,
      rerunRequested: false,
      lockedUntil: null,
      lastError: message,
      lastStatus: outcome.error?.status ?? null,
      nextRunAt: retry ? new Date(now.getTime() + retryDelayMs(job.attempts, outcome.error!.retryAfterMs)) : undefined,
      completedAt: retry ? null : now,
      // Frees the contact for its next push once this one is settled.
      dedupeKey: retry ? undefined : null,
    },
  });

  // The contact shows the live state: "PENDING" while a retry is scheduled.
  await prisma.contact.updateMany({
    where: { id: job.contactId },
    data: {
      callvibeLastPushedAt: now,
      callvibeLastPushStatus: status === "RETRY" ? "PENDING" : status,
      callvibeLastPushError: message,
      ...(outcome.ok ? { callvibePushedPhone: outcome.e164 } : {}),
      ...(outcome.ok && outcome.leadId ? { callvibeLeadId: outcome.leadId } : {}),
    },
  });
  if (config) {
    await prisma.callVibeConfig.update({
      where: { id: config.id },
      data: { lastPushAt: now, lastPushStatus: status === "RETRY" ? "FAILED" : status, lastPushError: message },
    });
  }
  // An edit arrived mid-run. A retry already re-reads the contact; a settled job needs a fresh one.
  if (settled.rerunRequested && !retry) {
    const next = await enqueueOne(job.contactId, job.trigger as CallVibePushTrigger, job.requestedById);
    if (next) runCallVibePushJobsSoon([next]);
  }
  return status;
}

/** The fast-lane sweep: run every due job, oldest first, inside a time budget. */
export async function processDueCallVibePushJobs(opts: { limit?: number; budgetMs?: number } = {}) {
  const started = Date.now();
  const now = new Date();
  const due = await prisma.callVibePushJob.findMany({
    where: {
      OR: [
        { status: { in: ["PENDING", "RETRY"] }, nextRunAt: { lte: now } },
        { status: "RUNNING", lockedUntil: { lt: now } },
      ],
    },
    orderBy: { nextRunAt: "asc" },
    take: opts.limit ?? 25,
    select: { id: true },
  });
  const counts = { due: due.length, success: 0, retry: 0, failed: 0, skipped: 0 };
  for (const { id } of due) {
    if (Date.now() - started > (opts.budgetMs ?? 60_000)) break;
    const status = await runCallVibePushJob(id);
    if (status === "SUCCESS") counts.success++;
    else if (status === "RETRY") counts.retry++;
    else if (status === "FAILED") counts.failed++;
    else counts.skipped++;
  }
  return counts;
}

// ------------------------------------------------------------ the push itself

const agentCache = new Map<string, { names: string[] | null; at: number }>();

async function agentNames(creds: CallVibeCreds): Promise<string[] | null> {
  const key = `${creds.baseUrl ?? ""}|${creds.email}`;
  const hit = agentCache.get(key);
  if (hit && Date.now() - hit.at < AGENT_CACHE_MS) return hit.names;
  const r = await listAgentNames(creds);
  // An unreadable list isn't cached: CallVibe validates assigned_to itself.
  if (!r.ok) return null;
  agentCache.set(key, { names: r.data, at: Date.now() });
  return r.data;
}

/** Test hook. */
export function resetCallVibeAgentCache(): void {
  agentCache.clear();
}

/**
 * Who the CallVibe lead goes to: the CRM lead's owner if they're a CallVibe
 * agent, else the configured default. Nobody → assigned_to is left out, so an
 * assignment made inside CallVibe is kept.
 */
export async function resolveAssignee(
  creds: CallVibeCreds,
  owner: string | null,
  fallback: string | null
): Promise<{ assignedTo?: string; warning?: string; error?: CallVibeWriteError }> {
  if (!owner && !fallback) return {};
  const names = await agentNames(creds);
  if (!names) return { assignedTo: owner ?? fallback! }; // couldn't check; CallVibe will say if it's wrong
  const find = (n: string | null) => (n ? names.find((a) => a.toLowerCase() === n.trim().toLowerCase()) : undefined);

  const ownerMatch = find(owner);
  if (ownerMatch) return { assignedTo: ownerMatch };
  const fallbackMatch = find(fallback);
  if (fallback && !fallbackMatch) {
    return {
      error: {
        kind: "unknown_agent",
        retryable: false,
        message: `The default assignee "${fallback}" isn't an agent in CallVibe. Choose one of: ${names.join(", ") || "(no agents found)"}.`,
      },
    };
  }
  if (fallbackMatch) {
    return { assignedTo: fallbackMatch, warning: owner ? `${owner} isn't a CallVibe agent, so the lead went to ${fallbackMatch}.` : undefined };
  }
  return { warning: `Pushed unassigned: ${owner} isn't a CallVibe agent. Set a default assignee in the CallVibe settings.` };
}

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function pushContact(contactId: string, config: ActiveCallVibeConfig): Promise<PushOutcome> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      callvibePushedPhone: true,
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          eventType: true,
          eventDate: true,
          guestCount: true,
          followUpDate: true,
          description: true,
          assignedTo: { select: { name: true } },
        },
      },
    },
  });
  if (!contact) {
    return { ok: false, error: { kind: "not_found", retryable: false, message: "This contact no longer exists in the CRM" } };
  }
  const e164 = toE164(contact.phone);
  if (!e164) {
    return {
      ok: false,
      error: {
        kind: "invalid_phone",
        retryable: false,
        message: contact.phone
          ? `"${contact.phone}" isn't a phone number CallVibe can dial. Save it with the country code, e.g. +91 98765 43210.`
          : "This contact has no phone number, and CallVibe needs one.",
      },
    };
  }

  // The newest open enquiry is what the agent is calling about.
  const lead = contact.leads.find((l) => l.status !== "WON" && l.status !== "LOST") ?? contact.leads[0] ?? null;
  const assignee = await resolveAssignee(config.creds, lead?.assignedTo?.name?.trim() || null, config.pushDefaultAssignee);
  if (assignee.error) return { ok: false, error: assignee.error };

  const name = `${contact.firstName} ${contact.lastName}`.trim();
  const customFields: Record<string, unknown> = {
    veloria_contact_id: contact.id,
    veloria_lead_id: lead?.id ?? null,
    event_type: lead?.eventType ?? null,
    event_date: isoDate(lead?.eventDate ?? null),
    guest_count: lead?.guestCount ?? null,
  };
  if (config.pushCallingList) customFields.calling_list = config.pushCallingList;

  const res = await upsertLeadByPhone(config.creds, e164, {
    name: name || lead?.title || undefined,
    email: contact.email ?? undefined,
    assignedTo: assignee.assignedTo,
    scheduledAt: lead?.followUpDate ? lead.followUpDate.toISOString() : undefined,
    source: "Veloria CRM",
    customFields,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const warnings = assignee.warning ? [assignee.warning] : [];

  // First push of this number: give the agent the context, once.
  if (contact.callvibePushedPhone !== e164) {
    const context = [
      lead ? `Veloria enquiry: ${lead.title}` : "Contact from Veloria CRM",
      lead?.eventType ? `Event: ${lead.eventType}` : null,
      lead?.eventDate ? `Date: ${isoDate(lead.eventDate)}` : null,
      lead?.guestCount ? `Guests: ${lead.guestCount}` : null,
      lead?.description ? `Notes: ${lead.description}` : null,
    ].filter(Boolean);
    const note = await addLeadNote(config.creds, e164, context.join(" · "));
    if (!note.ok) warnings.push(`The lead was saved, but its context note wasn't: ${note.error.message}`);
  }

  // The number changed: point whoever has the old CallVibe lead at the new one. Nothing is deleted.
  if (contact.callvibePushedPhone && contact.callvibePushedPhone !== e164) {
    const note = await addLeadNote(
      config.creds,
      contact.callvibePushedPhone,
      `This contact's number changed to ${e164} in Veloria CRM. The lead continues under the new number.`
    );
    if (!note.ok && note.error.kind !== "not_found") {
      warnings.push(`Couldn't add the number-change note to ${contact.callvibePushedPhone}: ${note.error.message}`);
    }
  }

  return { ok: true, e164, leadId: res.data.leadId, warning: warnings.join(" ") || undefined };
}
