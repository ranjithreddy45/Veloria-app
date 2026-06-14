"use server";

// ============================================================
// BD / Acquisition CRM — admin config actions.
// Lets ADMIN/SUPER_ADMIN tune the AcqConfig floors / thresholds in-app
// (the values read by getAcqConfig() and consumed by the deal state machine,
// e.g. the LARGE_DEAL_SIGNOFF_VALUE gate in transitionAcqDeal).
// AcqConfig is keyed on `key @unique`; values are stored as strings.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";
import { getAcqConfig, type AcqConfig } from "@/lib/acq/config";
import { acqCan } from "@/lib/acq/rbac";
import { ACQ_CONFIG_DEFAULTS, type AcqConfigKey } from "@/lib/acq/constants";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const SETTINGS_PATH = "/settings/bd-config";

// Allow-list of editable keys — only the known config keys can ever be written.
const KNOWN_KEYS = Object.keys(ACQ_CONFIG_DEFAULTS) as AcqConfigKey[];
const KNOWN_KEY_SET = new Set<string>(KNOWN_KEYS);

function isAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

async function getActor(): Promise<{ id: string; name?: string | null; role?: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

// ------------------------------------------------------------
// Read — merged current values. Gated to BD managers / admins
// (mirrors how other acq reads gate via acqCan).
// ------------------------------------------------------------
export async function getAcqConfigValues(): Promise<Result<AcqConfig>> {
  const user = await getActor();
  if (!user || !(acqCan(user.role, "bdhead:approve") || isAdmin(user.role))) {
    return { success: false, error: "Unauthorized" };
  }
  const values = await getAcqConfig();
  return { success: true, data: values };
}

// ------------------------------------------------------------
// Write — upsert one or more AcqConfig rows. ADMIN / SUPER_ADMIN only.
// Validates: each key must be a known ACQ_CONFIG_DEFAULTS key, each value
// must be a finite, non-negative number. Stored as a string (value is String).
// ------------------------------------------------------------
export async function setAcqConfigValues(
  values: Record<string, number>,
): Promise<Result<AcqConfig>> {
  const user = await getActor();
  if (!user || !isAdmin(user.role)) {
    return { success: false, error: "Only an administrator can change BD CRM config." };
  }

  const entries = Object.entries(values ?? {});
  if (entries.length === 0) {
    return { success: false, error: "No values provided." };
  }

  // Validate every entry up-front; reject the whole batch on any bad input.
  for (const [key, raw] of entries) {
    if (!KNOWN_KEY_SET.has(key)) {
      return { success: false, error: `Unknown config key: ${key}` };
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return { success: false, error: `Invalid value for ${key}: must be a non-negative number.` };
    }
  }

  await prisma.$transaction(
    entries.map(([key, raw]) =>
      prisma.acqConfig.upsert({
        where: { key },
        create: { key, value: String(Number(raw)) },
        update: { value: String(Number(raw)) },
      }),
    ),
  );

  await logActivity({
    userId: user.id,
    action: "ACQ_CONFIG_UPDATED",
    entityType: "AcqConfig",
    entityId: "bd-config",
    changes: Object.fromEntries(entries.map(([k, v]) => [k, Number(v)])),
  });

  revalidatePath(SETTINGS_PATH);
  const merged = await getAcqConfig();
  return { success: true, data: merged };
}

// Convenience single-key setter (delegates to the batch validator/writer).
export async function setAcqConfigValue(
  key: string,
  value: number,
): Promise<Result<AcqConfig>> {
  return setAcqConfigValues({ [key]: value });
}
