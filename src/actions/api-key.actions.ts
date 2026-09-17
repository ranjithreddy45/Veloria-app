"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { generatePushKey, PUSH_SCOPES } from "@/lib/push-api/keys";

const SETTINGS_PATH = "/settings/integrations/lead-capture";

/** Hours an old key keeps working after it is rotated, so the integration can switch over without downtime. */
const ROTATION_GRACE_HOURS = 24;

// ============================================================
// Generate a new API key
// ============================================================

export interface GenerateApiKeyOptions {
  /** Issue a Push API key (vg_live_…, scope leads:create). Omitted = the legacy x-api-key capture key, exactly as before. */
  pushApi?: boolean;
  /** The system that will hold the key, e.g. "meta_ads" or "website". */
  source?: string;
  /** Days until the key stops working. Omitted or null = never expires. */
  expiresInDays?: number | null;
}

export async function generateApiKey(name: string, options: GenerateApiKeyOptions = {}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!name || name.trim().length === 0) {
      return { success: false as const, error: "Name is required" };
    }

    const expiresInDays = options.expiresInDays ?? null;
    if (expiresInDays != null && (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 3650)) {
      return { success: false as const, error: "Expiry must be between 1 and 3650 days" };
    }
    const source = options.source?.trim().toLowerCase() || null;
    if (source && !/^[a-z0-9][a-z0-9_:.-]{0,49}$/.test(source)) {
      return { success: false as const, error: "Source must be a slug such as meta_ads or website" };
    }

    let rawKey: string;
    let prefix: string;
    let keyHash: string;
    if (options.pushApi) {
      ({ raw: rawKey, prefix, hash: keyHash } = generatePushKey());
    } else {
      // Legacy capture key — unchanged format.
      rawKey = `vel_${crypto.randomBytes(32).toString("hex")}`;
      prefix = rawKey.slice(0, 12);
      keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        keyHash,
        prefix,
        createdById: session.user.id,
        scopes: options.pushApi ? [...PUSH_SCOPES] : [],
        source,
        expiresAt: expiresInDays != null ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
      },
    });

    revalidatePath(SETTINGS_PATH);

    // Return the raw key ONCE — it cannot be retrieved again
    return {
      success: true as const,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        prefix: apiKey.prefix,
        scopes: apiKey.scopes,
        source: apiKey.source,
        expiresAt: apiKey.expiresAt,
      },
    };
  } catch (error) {
    console.error("generateApiKey error:", error);
    return { success: false as const, error: "Failed to generate API key" };
  }
}

// ============================================================
// List all API keys (never returns the hash)
// ============================================================

export async function listApiKeys() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const keys = await prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        scopes: true,
        source: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: keys };
  } catch (error) {
    console.error("listApiKeys error:", error);
    return { success: false as const, error: "Failed to list API keys" };
  }
}

// ============================================================
// Revoke an API key (soft delete)
// ============================================================

export async function revokeApiKey(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true as const };
  } catch (error) {
    console.error("revokeApiKey error:", error);
    return { success: false as const, error: "Failed to revoke API key" };
  }
}

// ============================================================
// Delete an API key (hard delete)
// ============================================================

export async function deleteApiKey(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.apiKey.delete({ where: { id } });

    revalidatePath(SETTINGS_PATH);
    return { success: true as const };
  } catch (error) {
    console.error("deleteApiKey error:", error);
    return { success: false as const, error: "Failed to delete API key" };
  }
}

// ============================================================
// Rotate a Push API key: issue a replacement with the same name, scopes, source
// and expiry, and let the old key keep working for ROTATION_GRACE_HOURS so the
// integration can be switched over without dropping a single lead.
// ============================================================

export async function rotateApiKey(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const old = await prisma.apiKey.findUnique({ where: { id } });
    if (!old || !old.isActive || old.revokedAt) {
      return { success: false as const, error: "Only an active key can be rotated" };
    }
    if (old.expiresAt && old.expiresAt.getTime() <= Date.now()) {
      return { success: false as const, error: "This key has already expired — generate a new one instead" };
    }
    if (old.scopes.length === 0) {
      return { success: false as const, error: "Only Push API keys can be rotated" };
    }

    const { raw, prefix, hash } = generatePushKey();
    const graceEnd = new Date(Date.now() + ROTATION_GRACE_HOURS * 3_600_000);

    const replacement = await prisma.$transaction(async (tx) => {
      const created = await tx.apiKey.create({
        data: {
          name: old.name,
          keyHash: hash,
          prefix,
          createdById: session.user!.id!,
          scopes: old.scopes,
          source: old.source,
          expiresAt: old.expiresAt,
          rotatedFromId: old.id,
        },
      });
      await tx.apiKey.update({
        where: { id: old.id },
        // Never extend an old key's life: keep the earlier of its own expiry and the grace period.
        data: { expiresAt: old.expiresAt && old.expiresAt < graceEnd ? old.expiresAt : graceEnd },
      });
      return created;
    });

    revalidatePath(SETTINGS_PATH);
    return {
      success: true as const,
      data: {
        id: replacement.id,
        name: replacement.name,
        key: raw,
        prefix: replacement.prefix,
        scopes: replacement.scopes,
        source: replacement.source,
        expiresAt: replacement.expiresAt,
        oldKeyExpiresAt: graceEnd,
      },
    };
  } catch (error) {
    console.error("rotateApiKey error:", error);
    return { success: false as const, error: "Failed to rotate API key" };
  }
}
