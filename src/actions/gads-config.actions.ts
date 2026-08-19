"use server";

import { randomBytes } from "crypto";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  effectiveValueMap,
  EVENT_BUCKET_LABEL,
  type EventBucket,
} from "@/lib/marketing/gads-value";

// ============================================================
// Google Ads offline-conversion config — value map + service API key.
// All in Settings so it's tunable without a deploy (marketing spec Change 3).
// ============================================================

export async function getGadsSettings() {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    const config = await prisma.gadsConfig.findUnique({ where: { id: "singleton" } });
    const valueMap = effectiveValueMap(config?.valueMap);
    const buckets = (Object.keys(valueMap) as EventBucket[]).map((k) => ({
      key: k,
      label: EVENT_BUCKET_LABEL[k],
      value: valueMap[k],
    }));
    const key = config?.offlineApiKey || "";
    return {
      success: true as const,
      data: {
        buckets,
        hasApiKey: !!key,
        // Masked — never return the raw key to the client.
        apiKeyMasked: key ? `${key.slice(0, 8)}${"•".repeat(24)}` : null,
      },
    };
  } catch (error) {
    console.error("[GET_GADS_SETTINGS_ERROR]", error);
    return { success: false as const, error: "Failed to load settings" };
  }
}

export async function saveGadsValueMap(valueMap: Record<string, number>) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    // Keep only the known buckets, coerce to positive numbers.
    const clean: Record<string, number> = {};
    (Object.keys(EVENT_BUCKET_LABEL) as EventBucket[]).forEach((k) => {
      const v = Number(valueMap[k]);
      if (Number.isFinite(v) && v >= 0) clean[k] = Math.round(v);
    });
    await prisma.gadsConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", valueMap: clean },
      update: { valueMap: clean },
    });
    revalidatePath("/settings/google-ads");
    return { success: true as const };
  } catch (error) {
    console.error("[SAVE_GADS_VALUE_MAP_ERROR]", error);
    return { success: false as const, error: "Failed to save value map" };
  }
}

/** Generate (or rotate) the offline-conversion API key. Returned ONCE. */
export async function regenerateGadsApiKey() {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    const key = `vg_ocm_${randomBytes(24).toString("hex")}`;
    await prisma.gadsConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", offlineApiKey: key },
      update: { offlineApiKey: key },
    });
    revalidatePath("/settings/google-ads");
    // Returned in full ONCE — the settings page only ever shows it masked after.
    return { success: true as const, apiKey: key };
  } catch (error) {
    console.error("[REGEN_GADS_API_KEY_ERROR]", error);
    return { success: false as const, error: "Failed to generate key" };
  }
}
