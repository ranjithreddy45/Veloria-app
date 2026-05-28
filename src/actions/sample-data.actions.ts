"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { revalidatePath } from "next/cache";

/**
 * Load demo / sample data into the app.
 *
 * Wraps the standalone CLI seed script (`prisma/seed-sample-data.ts`) so
 * admins can trigger it from the UI for evaluation environments.
 *
 * Locked behind SUPER_ADMIN by default; refuses to run in production unless
 * `ALLOW_SAMPLE_DATA_IN_PROD=true` is set in env.
 */
export async function loadSampleData() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    // Restrict to SUPER_ADMIN — this changes data in bulk.
    if (role !== "SUPER_ADMIN" && !hasPermission(role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_SAMPLE_DATA_IN_PROD !== "true"
    ) {
      return {
        success: false as const,
        error:
          "Sample data loading is disabled in production. Set ALLOW_SAMPLE_DATA_IN_PROD=true to override.",
      };
    }

    // Dynamic import — keeps the seed script out of the main bundle.
    // Pass the shared Prisma client so we don't spin up a second pool.
    const { runSampleSeed } = await import("../../prisma/seed-sample-data");
    await runSampleSeed(prisma);

    await logActivity({
      userId: session.user.id as string,
      action: "ran_sample_seed",
      entityType: "Settings",
      entityId: "sample-data",
    });

    revalidatePath("/leads");
    revalidatePath("/contacts");
    revalidatePath("/crm/calls");
    revalidatePath("/settings");

    return {
      success: true as const,
      message: "Sample data loaded. Check /leads, /contacts, /crm/calls.",
    };
  } catch (error) {
    console.error("[LOAD_SAMPLE_DATA_ERROR]", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to load sample data",
    };
  }
}
