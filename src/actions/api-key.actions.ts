"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { generatePushKey } from "@/lib/push-api/keys";

const SETTINGS_PATH = "/settings/integrations/lead-capture";

/** Hours an old key keeps working after it is rotated, so the integration can switch over without downtime. */
const ROTATION_GRACE_HOURS = 24;

/** Scopes an admin may grant a Push API key from Settings. leads:create is mandatory. */
const GRANTABLE_PUSH_SCOPES = ["leads:create", "leads:update"];
const DEFAULT_PUSH_SCOPES = ["leads:create", "leads:update"];

/** Thrown inside a transaction to roll it back with a message for the user. */
class RotationRefused extends Error {}

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
  /** Push keys only: "leads:create" (required) and optionally "leads:update". Omitted = both. */
  scopes?: string[];
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

    let scopes: string[] = [];
    if (options.pushApi) {
      const requested = options.scopes ?? DEFAULT_PUSH_SCOPES;
      if (!Array.isArray(requested) || requested.some((sc) => typeof sc !== "string" || !GRANTABLE_PUSH_SCOPES.includes(sc))) {
        return { success: false as const, error: "Scopes may only be leads:create and leads:update" };
      }
      if (!requested.includes("leads:create")) {
        return { success: false as const, error: "A Push API key must be granted leads:create" };
      }
      // Stable order, no duplicates.
      scopes = GRANTABLE_PUSH_SCOPES.filter((sc) => requested.includes(sc));
    } else if (options.scopes && options.scopes.length > 0) {
      return { success: false as const, error: "Scopes can only be granted to Push API keys" };
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

    const data = {
      name: name.trim(),
      keyHash,
      prefix,
      createdById: session.user.id,
      scopes,
      source,
      expiresAt: expiresInDays != null ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
    };
    const apiKey = options.pushApi
      ? // A push key starts its own integration lineage: lineageId = its own id.
        await prisma.$transaction(async (tx) => {
          const created = await tx.apiKey.create({ data });
          return tx.apiKey.update({ where: { id: created.id }, data: { lineageId: created.id } });
        })
      : await prisma.apiKey.create({ data });

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
        rotatedFromId: true,
        lineageId: true,
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

    if (await prisma.apiKey.findFirst({ where: { rotatedFromId: old.id }, select: { id: true } })) {
      return { success: false as const, error: "This key has already been rotated — use its replacement" };
    }

    const { raw, prefix, hash } = generatePushKey();
    const now = new Date();
    const graceEnd = new Date(now.getTime() + ROTATION_GRACE_HOURS * 3_600_000);
    // Never extend an old key's life: keep the earlier of its own expiry and the grace period.
    const oldKeyExpiresAt = old.expiresAt && old.expiresAt < graceEnd ? old.expiresAt : graceEnd;

    const replacement = await prisma.$transaction(async (tx) => {
      // Claim the old key with a conditional write. The updatedAt guard is an
      // optimistic lock: a concurrent rotation (or revoke) changes updatedAt, and
      // Postgres re-evaluates this WHERE against the committed row after waiting
      // on its lock, so only one rotation can get count === 1.
      const claimed = await tx.apiKey.updateMany({
        where: {
          id: old.id,
          isActive: true,
          revokedAt: null,
          updatedAt: old.updatedAt,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { expiresAt: oldKeyExpiresAt, updatedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new RotationRefused("This key changed while it was being rotated — reload and try again");
      }
      // Re-check for a successor while holding the old key's row lock.
      const successor = await tx.apiKey.findFirst({ where: { rotatedFromId: old.id }, select: { id: true } });
      if (successor) {
        throw new RotationRefused("This key has already been rotated — use its replacement");
      }
      return tx.apiKey.create({
        data: {
          name: old.name,
          keyHash: hash,
          prefix,
          createdById: session.user!.id!,
          scopes: old.scopes,
          source: old.source,
          expiresAt: old.expiresAt,
          rotatedFromId: old.id,
          lineageId: old.lineageId ?? old.id,
        },
      });
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
        oldKeyExpiresAt,
      },
    };
  } catch (error) {
    if (error instanceof RotationRefused) {
      return { success: false as const, error: error.message };
    }
    console.error("rotateApiKey error:", error);
    return { success: false as const, error: "Failed to rotate API key" };
  }
}
