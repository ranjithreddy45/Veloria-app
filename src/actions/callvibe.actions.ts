"use server";

// ============================================================
// CallVibe server actions — settings, connection test, manual sync, and the
// lead push that replaces Runo's "allocation" call.
// ============================================================

import { revalidatePath } from "next/cache";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getRecordingUrl,
  testConnection,
  type CallVibeCreds,
} from "@/lib/integrations/callvibe";
import { syncCallVibeCalls } from "@/lib/telephony/callvibe-sync";
import { pushLeadContactToCallVibe } from "@/actions/callvibe-push.actions";
import { callVibeConfigSchema, type CallVibeConfigInput } from "@/schemas/callvibe.schema";

const MASK = "********";

async function requireSession(permission: "settings:read" | "settings:update") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" as const, session: null };
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, permission)) {
    return { error: "Insufficient permissions" as const, session: null };
  }
  return { error: null, session };
}

async function activeCreds(): Promise<
  { creds: CallVibeCreds; configId: string; tenantId: string | null } | null
> {
  const config = await prisma.callVibeConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!config) return null;
  return {
    creds: { baseUrl: config.baseUrl, email: config.email, password: config.password },
    configId: config.id,
    tenantId: config.tenantId,
  };
}

// ---- settings ----------------------------------------------------------

/** The stored config, with the password masked — never send it to a client. */
export async function getCallVibeConfig() {
  const gate = await requireSession("settings:read");
  if (gate.error) return { success: false as const, error: gate.error };

  try {
    const config = await prisma.callVibeConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        baseUrl: true,
        email: true,
        password: true,
        tenantId: true,
        pushToken: true,
        syncEnabled: true,
        syncWindowHours: true,
        isActive: true,
        lastSyncAt: true,
        lastCallAt: true,
        lastSyncNote: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!config) return { success: true as const, data: null };

    return {
      success: true as const,
      data: {
        ...config,
        password: config.password ? MASK : "",
        pushToken: config.pushToken ? MASK : "",
      },
    };
  } catch (error) {
    console.error("getCallVibeConfig error:", error);
    return { success: false as const, error: "Failed to load the CallVibe settings" };
  }
}

export async function saveCallVibeConfig(input: CallVibeConfigInput) {
  const gate = await requireSession("settings:update");
  if (gate.error || !gate.session?.user?.id) {
    return { success: false as const, error: gate.error ?? "Unauthorized" };
  }

  const parsed = callVibeConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const data = parsed.data;

  try {
    // A masked value means "unchanged" — re-saving the form must not wipe the
    // stored secret (same rule as the WhatsApp settings).
    const existing = data.id
      ? await prisma.callVibeConfig.findUnique({
          where: { id: data.id },
          select: { password: true, pushToken: true },
        })
      : null;
    const keep = (incoming: string | undefined, stored: string | null | undefined) =>
      incoming && incoming.includes("*") ? stored ?? null : incoming || null;

    const password =
      data.password.includes("*") && existing?.password ? existing.password : data.password;
    const pushToken = keep(data.pushToken, existing?.pushToken);

    await prisma.callVibeConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const saved = data.id
      ? await prisma.callVibeConfig.update({
          where: { id: data.id },
          data: {
            baseUrl: data.baseUrl || "https://api.callvibe.ai",
            email: data.email,
            password,
            tenantId: data.tenantId || null,
            pushToken,
            syncEnabled: data.syncEnabled,
            syncWindowHours: data.syncWindowHours,
            isActive: data.isActive,
          },
        })
      : await prisma.callVibeConfig.create({
          data: {
            baseUrl: data.baseUrl || "https://api.callvibe.ai",
            email: data.email,
            password,
            tenantId: data.tenantId || null,
            pushToken,
            syncEnabled: data.syncEnabled,
            syncWindowHours: data.syncWindowHours,
            isActive: data.isActive,
            createdById: gate.session.user.id,
          },
        });

    revalidatePath("/settings/integrations/callvibe");
    return { success: true as const, data: { id: saved.id } };
  } catch (error) {
    console.error("saveCallVibeConfig error:", error);
    return { success: false as const, error: "Failed to save the CallVibe settings" };
  }
}

export async function deleteCallVibeConfig(id: string) {
  const gate = await requireSession("settings:update");
  if (gate.error) return { success: false as const, error: gate.error };
  try {
    await prisma.callVibeConfig.delete({ where: { id } });
    revalidatePath("/settings/integrations/callvibe");
    return { success: true as const };
  } catch (error) {
    console.error("deleteCallVibeConfig error:", error);
    return { success: false as const, error: "Failed to remove the CallVibe settings" };
  }
}

/**
 * Sign in, read the tenant, pull one call — and report the field names that
 * came back. CallVibe publishes no response schema, so this is how the mapping
 * is confirmed against a real account instead of assumed.
 */
export async function testCallVibeConnection() {
  const gate = await requireSession("settings:read");
  if (gate.error) return { success: false as const, error: gate.error };

  const active = await activeCreds();
  if (!active) return { success: false as const, error: "Save the CallVibe settings first" };

  const res = await testConnection(active.creds);
  if (!res.success || !res.data) {
    return { success: false as const, error: res.error ?? "CallVibe did not accept the credentials" };
  }

  // Learning the tenant id here saves the operator hunting for it.
  if (res.data.tenantId && !active.tenantId) {
    await prisma.callVibeConfig
      .update({ where: { id: active.configId }, data: { tenantId: res.data.tenantId } })
      .catch(() => undefined);
  }

  return {
    success: true as const,
    data: {
      tenantId: res.data.tenantId,
      callsSeen: res.data.callsSeen,
      sampleKeys: res.data.sampleKeys,
      sample: res.data.sample,
    },
  };
}

/** Run the import now instead of waiting for the hourly lane. */
export async function syncCallVibeNow(hours?: number) {
  const gate = await requireSession("settings:update");
  if (gate.error) return { success: false as const, error: gate.error };

  try {
    const summary = await syncCallVibeCalls({ sinceHours: hours, force: true });
    revalidatePath("/settings/integrations/callvibe");
    revalidatePath("/crm/calls");
    return { success: summary.ok, data: summary } as const;
  } catch (error) {
    console.error("syncCallVibeNow error:", error);
    return { success: false as const, error: "The CallVibe sync failed" };
  }
}

// ---- lead push (replaces Runo's allocation) ----------------------------

/**
 * Put a Veloria lead in front of the agent inside CallVibe. CallVibe has no
 * dial API — its agents call from their own handsets — so this queues the
 * lead's contact on the write side (upsert by phone, retried in the
 * background) instead of pushing inline.
 */
export async function sendLeadToCallVibe(leadId: string) {
  return pushLeadContactToCallVibe(leadId);
}

/** A time-limited recording URL for a call this app imported from CallVibe. */
export async function getCallVibeRecordingUrl(callLogId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };

  const active = await activeCreds();
  if (!active) return { success: false as const, error: "CallVibe isn't connected" };

  try {
    const log = await prisma.callLog.findUnique({
      where: { id: callLogId },
      select: { externalCallId: true },
    });
    const externalId = log?.externalCallId ?? "";
    if (!externalId.startsWith("callvibe:")) {
      return { success: false as const, error: "This call did not come from CallVibe" };
    }
    const res = await getRecordingUrl(active.creds, externalId.slice("callvibe:".length));
    return res.success && res.data
      ? { success: true as const, data: res.data }
      : { success: false as const, error: res.error ?? "No recording available" };
  } catch (error) {
    console.error("getCallVibeRecordingUrl error:", error);
    return { success: false as const, error: "Could not fetch the recording" };
  }
}
