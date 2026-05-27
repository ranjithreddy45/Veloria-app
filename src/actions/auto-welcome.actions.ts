"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { z } from "zod";

// ============================================================
// Schemas
// ============================================================

const upsertAutoWelcomeSchema = z.object({
  id: z.string().optional(),
  leadSource: z.string().min(1),
  isEnabled: z.boolean().default(true),
  templateName: z.string().min(1, "Template name is required"),
  delayMinutes: z.coerce.number().int().min(0).default(0),
});

type UpsertAutoWelcomeInput = z.infer<typeof upsertAutoWelcomeSchema>;

// ============================================================
// Get All Auto Welcome Configs
// ============================================================

export async function getAutoWelcomeConfigs() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const configs = await prisma.autoWelcomeConfig.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(configs) };
  } catch (error) {
    console.error("getAutoWelcomeConfigs error:", error);
    return { success: false as const, error: "Failed to fetch configs" };
  }
}

// ============================================================
// Upsert Auto Welcome Config
// ============================================================

export async function upsertAutoWelcomeConfig(input: UpsertAutoWelcomeInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = upsertAutoWelcomeSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const { id, leadSource, isEnabled, templateName, delayMinutes } = parsed.data;

    const config = await prisma.autoWelcomeConfig.upsert({
      where: { leadSource: leadSource as any },
      update: { isEnabled, templateName, delayMinutes },
      create: { leadSource: leadSource as any, isEnabled, templateName, delayMinutes },
    });

    revalidatePath("/settings/integrations/lead-capture");
    return { success: true as const, data: serialize(config) };
  } catch (error) {
    console.error("upsertAutoWelcomeConfig error:", error);
    return { success: false as const, error: "Failed to save config" };
  }
}

// ============================================================
// Delete Auto Welcome Config
// ============================================================

export async function deleteAutoWelcomeConfig(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.autoWelcomeConfig.delete({ where: { id } });

    revalidatePath("/settings/integrations/lead-capture");
    return { success: true as const };
  } catch (error) {
    console.error("deleteAutoWelcomeConfig error:", error);
    return { success: false as const, error: "Failed to delete config" };
  }
}
