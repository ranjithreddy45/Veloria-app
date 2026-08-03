"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { testWhatsAppConnection } from "@/lib/integrations/whatsapp";
import { whatsappConfigSchema, type WhatsAppConfigInput } from "@/schemas/whatsapp-config.schema";
import { revalidatePath } from "next/cache";

// ============================================================
// Get active WhatsApp configuration (masked for client)
// ============================================================

export async function getWhatsAppConfig() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        provider: true,
        accessToken: true,
        phoneNumberId: true,
        businessAccountId: true,
        appSecret: true,
        apiEndpoint: true,
        verifyToken: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return { success: true as const, data: null };
    }

    // Mask sensitive fields — never return raw secrets to client
    const masked = {
      ...config,
      accessToken: config.accessToken
        ? `${config.accessToken.slice(0, 10)}${"*".repeat(30)}`
        : null,
      appSecret: config.appSecret ? `${"*".repeat(20)}` : null,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };

    return { success: true as const, data: masked };
  } catch (error) {
    console.error("getWhatsAppConfig error:", error);
    return { success: false as const, error: "Failed to fetch WhatsApp config" };
  }
}

// ============================================================
// Save WhatsApp configuration
// ============================================================

export async function saveWhatsAppConfig(input: WhatsAppConfigInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = whatsappConfigSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    // Deactivate all existing configs first
    await prisma.whatsAppConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    let config;
    if (data.id) {
      // If the token looks masked (contains ***), keep the existing value
      const existingConfig = await prisma.whatsAppConfig.findUnique({
        where: { id: data.id },
        select: { accessToken: true, appSecret: true },
      });

      const accessToken = data.accessToken.includes("***")
        ? existingConfig?.accessToken ?? data.accessToken
        : data.accessToken;

      const appSecret =
        data.appSecret && data.appSecret.includes("***")
          ? existingConfig?.appSecret ?? data.appSecret
          : data.appSecret || null;

      config = await prisma.whatsAppConfig.update({
        where: { id: data.id },
        data: {
          provider: data.provider,
          accessToken,
          phoneNumberId: data.phoneNumberId || null,
          businessAccountId: data.businessAccountId || null,
          appSecret,
          apiEndpoint: data.apiEndpoint || null,
          verifyToken: data.verifyToken,
          isActive: data.isActive,
        },
      });
    } else {
      config = await prisma.whatsAppConfig.create({
        data: {
          provider: data.provider,
          accessToken: data.accessToken,
          phoneNumberId: data.phoneNumberId || null,
          businessAccountId: data.businessAccountId || null,
          appSecret: data.appSecret || null,
          apiEndpoint: data.apiEndpoint || null,
          verifyToken: data.verifyToken,
          isActive: data.isActive,
          createdById: session.user.id,
        },
      });
    }

    revalidatePath("/settings/integrations/whatsapp");
    return { success: true as const, data: { id: config.id } };
  } catch (error) {
    console.error("saveWhatsAppConfig error:", error);
    return { success: false as const, error: "Failed to save WhatsApp config" };
  }
}

// ============================================================
// Delete WhatsApp configuration
// ============================================================

export async function deleteWhatsAppConfig(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.whatsAppConfig.delete({ where: { id } });

    revalidatePath("/settings/integrations/whatsapp");
    return { success: true as const };
  } catch (error) {
    console.error("deleteWhatsAppConfig error:", error);
    return { success: false as const, error: "Failed to delete WhatsApp config" };
  }
}

// ============================================================
// Test WhatsApp connection
// ============================================================

export async function testWhatsAppConnectionAction() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return { success: false as const, error: "No active WhatsApp configuration found" };
    }

    const result = await testWhatsAppConnection({
      provider: config.provider || "META",
      accessToken: config.accessToken,
      phoneNumberId: config.phoneNumberId ?? "",
      businessAccountId: config.businessAccountId ?? "",
      appSecret: config.appSecret,
      apiEndpoint: config.apiEndpoint,
      verifyToken: config.verifyToken,
    });

    return {
      success: result.success,
      ...(result.success
        ? { data: { message: result.message, phoneNumber: result.phoneNumber } }
        : { error: result.message }),
    };
  } catch (error) {
    console.error("testWhatsAppConnection error:", error);
    return { success: false as const, error: "Connection test failed" };
  }
}
