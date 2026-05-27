"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { revalidatePath } from "next/cache";

// ============================================================
// Generate a new API key
// ============================================================

export async function generateApiKey(name: string) {
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

    // Generate a random API key
    const rawKey = `vel_${crypto.randomBytes(32).toString("hex")}`;
    const prefix = rawKey.slice(0, 12);
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        keyHash,
        prefix,
        createdById: session.user.id,
      },
    });

    revalidatePath("/settings/integrations/lead-capture");

    // Return the raw key ONCE — it cannot be retrieved again
    return {
      success: true as const,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        prefix: apiKey.prefix,
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
      data: { isActive: false },
    });

    revalidatePath("/settings/integrations/lead-capture");
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

    revalidatePath("/settings/integrations/lead-capture");
    return { success: true as const };
  } catch (error) {
    console.error("deleteApiKey error:", error);
    return { success: false as const, error: "Failed to delete API key" };
  }
}
