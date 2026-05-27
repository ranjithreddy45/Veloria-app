"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { leadCaptureConfigSchema, type LeadCaptureConfigInput } from "@/schemas/lead-capture-config.schema";
import { revalidatePath } from "next/cache";

// ============================================================
// Get all lead capture configurations
// ============================================================

export async function getLeadCaptureConfigs() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const configs = await prisma.leadCaptureConfig.findMany({
      orderBy: { createdAt: "asc" },
    });

    return { success: true as const, data: configs };
  } catch (error) {
    console.error("getLeadCaptureConfigs error:", error);
    return { success: false as const, error: "Failed to fetch configs" };
  }
}

// ============================================================
// Upsert a lead capture configuration by platform
// ============================================================

export async function upsertLeadCaptureConfig(input: LeadCaptureConfigInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = leadCaptureConfigSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const config = await prisma.leadCaptureConfig.upsert({
      where: { platform: parsed.data.platform },
      update: {
        credentials: parsed.data.credentials as any,
        isActive: parsed.data.isActive,
      },
      create: {
        platform: parsed.data.platform,
        credentials: parsed.data.credentials as any,
        isActive: parsed.data.isActive,
      },
    });

    revalidatePath("/settings/integrations/lead-capture");
    return { success: true as const, data: config };
  } catch (error) {
    console.error("upsertLeadCaptureConfig error:", error);
    return { success: false as const, error: "Failed to save configuration" };
  }
}

// ============================================================
// Delete a lead capture configuration
// ============================================================

export async function deleteLeadCaptureConfig(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.leadCaptureConfig.delete({ where: { id } });

    revalidatePath("/settings/integrations/lead-capture");
    return { success: true as const };
  } catch (error) {
    console.error("deleteLeadCaptureConfig error:", error);
    return { success: false as const, error: "Failed to delete configuration" };
  }
}

// ============================================================
// Test a lead capture configuration
// ============================================================

export async function testLeadCaptureConfig(platform: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const config = await prisma.leadCaptureConfig.findFirst({
      where: { platform: platform as any, isActive: true },
    });

    if (!config) {
      return { success: false as const, error: "No configuration found for this platform" };
    }

    const creds = config.credentials as Record<string, string>;

    if (platform === "FACEBOOK") {
      if (!creds.accessToken) {
        return { success: false as const, error: "Facebook Page Access Token is missing" };
      }

      // Test by calling the Graph API /me endpoint
      const response = await fetch(
        `https://graph.facebook.com/v19.0/me?access_token=${creds.accessToken}`
      );
      const data = await response.json();

      if (data.error) {
        return { success: false as const, error: `Facebook API error: ${data.error.message}` };
      }

      return { success: true as const, data: { message: `Connected to Facebook Page: ${data.name || data.id}` } };
    }

    if (platform === "GOOGLE") {
      if (!creds.webhookToken) {
        return { success: false as const, error: "Google Ads webhook token is missing" };
      }
      return { success: true as const, data: { message: "Google Ads webhook token is configured" } };
    }

    return { success: true as const, data: { message: "Configuration saved" } };
  } catch (error) {
    console.error("testLeadCaptureConfig error:", error);
    return { success: false as const, error: "Configuration test failed" };
  }
}
