"use server";

// ============================================================
// CallVibe lead push (write side) — the actions behind the contact button,
// the contacts bulk action and the "Lead push (Write)" settings card.
// Pushes are queued as background jobs (src/lib/integrations/callvibe/push.ts);
// these actions only queue, never wait on CallVibe — except "Send test lead",
// which exists to show CallVibe's answer.
// ============================================================

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/../auth";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getActiveCallVibeConfig } from "@/lib/integrations/callvibe/credentials";
import { pushContactsToCallVibe } from "@/lib/integrations/callvibe/push";
import { addLeadNote, listAgentNames, toE164, upsertLeadByPhone } from "@/lib/integrations/callvibe/write-client";

const NOT_CONNECTED = "CallVibe isn't connected yet. Add the account in Settings → Integrations → CallVibe.";

async function requireSession(permission: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" as const, userId: null };
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, permission)) return { error: "Insufficient permissions" as const, userId: null };
  return { error: null, userId: session.user.id as string };
}

/** Why CallVibe can't take this number, or null when it can. */
function undialable(phone: string | null): string | null {
  if (!phone) return "This contact has no phone number, and CallVibe needs one.";
  if (!toE164(phone)) {
    return `"${phone}" isn't a phone number CallVibe can dial. Save it with the country code, e.g. +91 98765 43210.`;
  }
  return null;
}

// ---- pushing contacts --------------------------------------------------

/** "Push to CallVibe" on a contact. */
export async function pushContactToCallVibe(contactId: string) {
  const gate = await requireSession("contacts:update");
  if (gate.error) return { success: false as const, error: gate.error };
  if (!(await getActiveCallVibeConfig())) return { success: false as const, error: NOT_CONNECTED };

  const contact = await prisma.contact.findFirst({ where: { id: contactId, deletedAt: null }, select: { phone: true } });
  if (!contact) return { success: false as const, error: "Contact not found" };
  const phoneError = undialable(contact.phone);
  if (phoneError) return { success: false as const, error: phoneError };

  const res = await pushContactsToCallVibe([contactId], "manual", gate.userId);
  if (res.error) return { success: false as const, error: res.error };
  if (res.queued === 0) return { success: false as const, error: "Contact not found" };

  await logActivity({
    userId: gate.userId,
    action: "CALLVIBE_PUSH_QUEUED",
    entityType: "Contact",
    entityId: contactId,
    changes: { details: "Queued for CallVibe." },
  });
  revalidatePath(`/contacts/${contactId}`);
  return { success: true as const };
}

const bulkSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });

/** Bulk action on the contacts list. */
export async function bulkPushContactsToCallVibe(input: { ids: string[] }) {
  const gate = await requireSession("contacts:update");
  if (gate.error) return { success: false as const, error: gate.error };
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Select between 1 and 500 contacts" };
  if (!(await getActiveCallVibeConfig())) return { success: false as const, error: NOT_CONNECTED };

  // Contacts CallVibe can't dial are reported, not queued to fail.
  const contacts = await prisma.contact.findMany({
    where: { id: { in: parsed.data.ids }, deletedAt: null },
    select: { id: true, phone: true },
  });
  const dialable = contacts.filter((c) => !undialable(c.phone)).map((c) => c.id);
  const skipped = contacts.length - dialable.length;
  if (dialable.length === 0) {
    return { success: false as const, error: "None of the selected contacts has a phone number CallVibe can dial" };
  }

  const res = await pushContactsToCallVibe(dialable, "bulk", gate.userId);
  if (res.error) return { success: false as const, error: res.error };
  revalidatePath("/contacts");
  return { success: true as const, queued: res.queued, skipped };
}

/**
 * The lead page's "Send to CallVibe": pushes the lead's contact through the
 * same queue. Called from sendLeadToCallVibe.
 */
export async function pushLeadContactToCallVibe(leadId: string) {
  const gate = await requireSession("leads:update");
  if (gate.error) return { success: false as const, error: gate.error };
  if (!(await getActiveCallVibeConfig())) return { success: false as const, error: NOT_CONNECTED };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true, contactId: true, contact: { select: { phone: true } } },
  });
  if (!lead) return { success: false as const, error: "Lead not found" };
  const phoneError = undialable(lead.contact?.phone ?? null);
  if (phoneError) return { success: false as const, error: phoneError };

  const res = await pushContactsToCallVibe([lead.contactId], "lead_button", gate.userId);
  if (res.error || res.queued === 0) return { success: false as const, error: res.error ?? "Contact not found" };

  await logActivity({
    userId: gate.userId,
    action: "CALLVIBE_LEAD_SENT",
    entityType: "LEAD",
    entityId: lead.id,
    changes: { details: "Lead queued for CallVibe for the agent to call." },
  });
  revalidatePath(`/contacts/${lead.contactId}`);
  return { success: true as const };
}

// ---- settings card -----------------------------------------------------

export async function getCallVibePushSettings() {
  const gate = await requireSession("settings:read");
  if (gate.error) return { success: false as const, error: gate.error };

  const config = await prisma.callVibeConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      pushEnabled: true,
      pushDefaultAssignee: true,
      pushCallingList: true,
      lastPushAt: true,
      lastPushStatus: true,
      lastPushError: true,
    },
  });
  const [waiting, failed] = await Promise.all([
    prisma.callVibePushJob.count({ where: { status: { in: ["PENDING", "RETRY", "RUNNING"] } } }),
    prisma.callVibePushJob.count({
      where: { status: "FAILED", completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);
  return {
    success: true as const,
    data: config ? { connected: true as const, ...config, waiting, failedLast7Days: failed } : { connected: false as const },
  };
}

const pushSettingsSchema = z.object({
  pushEnabled: z.boolean(),
  pushDefaultAssignee: z.string().trim().max(120).nullable(),
  pushCallingList: z.string().trim().max(120).nullable(),
});

export async function saveCallVibePushSettings(input: z.input<typeof pushSettingsSchema>) {
  const gate = await requireSession("settings:update");
  if (gate.error) return { success: false as const, error: gate.error };
  const parsed = pushSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Check the lead push settings" };

  const config = await prisma.callVibeConfig.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
  if (!config) return { success: false as const, error: NOT_CONNECTED };

  await prisma.callVibeConfig.update({
    where: { id: config.id },
    data: {
      pushEnabled: parsed.data.pushEnabled,
      pushDefaultAssignee: parsed.data.pushDefaultAssignee || null,
      pushCallingList: parsed.data.pushCallingList || null,
    },
  });
  await logActivity({
    userId: gate.userId,
    action: "CALLVIBE_PUSH_SETTINGS_UPDATED",
    entityType: "CallVibeConfig",
    entityId: config.id,
    changes: { pushEnabled: parsed.data.pushEnabled },
  });
  revalidatePath("/settings/integrations/callvibe");
  return { success: true as const };
}

/** Agent names from CallVibe, to pick the default assignee from. */
export async function getCallVibeAgentNames() {
  const gate = await requireSession("settings:read");
  if (gate.error) return { success: false as const, error: gate.error };
  const config = await getActiveCallVibeConfig();
  if (!config) return { success: false as const, error: NOT_CONNECTED };
  const r = await listAgentNames(config.creds);
  if (!r.ok) return { success: false as const, error: r.error.message };
  return { success: true as const, data: r.data };
}

const testLeadSchema = z.object({
  phone: z.string().trim().min(1, "Enter a phone number"),
  name: z.string().trim().max(120).optional(),
});

/**
 * Push one lead straight to CallVibe (no queue) and report exactly what came
 * back, so the first real push isn't also the first time we see CallVibe's
 * response. Use a number you own: this creates a real lead in CallVibe.
 */
export async function sendCallVibeTestLead(input: { phone: string; name?: string }) {
  const gate = await requireSession("settings:update");
  if (gate.error) return { success: false as const, error: gate.error };
  const parsed = testLeadSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const config = await getActiveCallVibeConfig();
  if (!config) return { success: false as const, error: NOT_CONNECTED };
  const e164 = toE164(parsed.data.phone);
  if (!e164) {
    return { success: false as const, error: "Enter a full number with the country code, e.g. +91 98765 43210" };
  }

  const res = await upsertLeadByPhone(config.creds, e164, {
    name: parsed.data.name || "Veloria test lead",
    assignedTo: config.pushDefaultAssignee ?? undefined,
    source: "Veloria CRM",
    customFields: {
      veloria_test: true,
      ...(config.pushCallingList ? { calling_list: config.pushCallingList } : {}),
    },
  });

  // Shown inline only: "Last push" on the card reports the real queue.
  await logActivity({
    userId: gate.userId,
    action: "CALLVIBE_TEST_LEAD_SENT",
    entityType: "CallVibeConfig",
    entityId: config.id,
    changes: { ok: res.ok, status: res.ok ? res.status : (res.error.status ?? null) },
  });
  revalidatePath("/settings/integrations/callvibe");

  if (!res.ok) return { success: false as const, error: res.error.message, kind: res.error.kind };
  const note = await addLeadNote(config.creds, e164, "Test lead sent from Veloria CRM settings. Safe to delete.");
  return {
    success: true as const,
    data: {
      phone: e164,
      httpStatus: res.status,
      leadId: res.data.leadId,
      responseKeys: res.data.responseKeys,
      noteAdded: note.ok,
      noteError: note.ok ? null : note.error.message,
    },
  };
}
