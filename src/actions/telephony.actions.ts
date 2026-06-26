"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getTelephonyAdapter } from "@/lib/telephony";
import { telephonyConfigSchema, initiateCallSchema, type TelephonyConfigInput, type InitiateCallInput } from "@/schemas/telephony.schema";
import { revalidatePath } from "next/cache";

// ============================================================
// Get active telephony configuration
// ============================================================

export async function getTelephonyConfig() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const config = await prisma.telephonyConfig.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        provider: true,
        apiKey: true,
        apiSecret: true,
        callerId: true,
        accountSid: true,
        subdomain: true,
        webhookSecret: true,
        isActive: true,
      },
    });

    if (!config) {
      return { success: true as const, data: null };
    }

    // Mask sensitive fields — never return raw secrets to client
    const masked = {
      ...config,
      apiKey: config.apiKey ? `${config.apiKey.slice(0, 6)}${"*".repeat(20)}` : null,
      apiSecret: config.apiSecret ? `${"*".repeat(20)}` : null,
      webhookSecret: config.webhookSecret ? `${"*".repeat(20)}` : null,
      accountSid: config.accountSid ? `${config.accountSid.slice(0, 6)}${"*".repeat(10)}` : null,
    };

    return { success: true as const, data: masked };
  } catch (error) {
    console.error("getTelephonyConfig error:", error);
    return { success: false as const, error: "Failed to fetch telephony config" };
  }
}

// ============================================================
// Save telephony configuration
// ============================================================

export async function saveTelephonyConfig(input: TelephonyConfigInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = telephonyConfigSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    // Deactivate all existing configs first
    await prisma.telephonyConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    let config;
    if (data.id) {
      config = await prisma.telephonyConfig.update({
        where: { id: data.id },
        data: {
          provider: data.provider,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret || null,
          callerId: data.callerId,
          accountSid: data.accountSid || null,
          subdomain: data.subdomain || null,
          webhookSecret: data.webhookSecret || null,
          isActive: data.isActive,
        },
      });
    } else {
      config = await prisma.telephonyConfig.create({
        data: {
          provider: data.provider,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret || null,
          callerId: data.callerId,
          accountSid: data.accountSid || null,
          subdomain: data.subdomain || null,
          webhookSecret: data.webhookSecret || null,
          isActive: data.isActive,
          createdById: session.user.id,
        },
      });
    }

    revalidatePath("/settings/integrations/telephony");
    return { success: true as const, data: config };
  } catch (error) {
    console.error("saveTelephonyConfig error:", error);
    return { success: false as const, error: "Failed to save telephony config" };
  }
}

// ============================================================
// Delete telephony configuration
// ============================================================

export async function deleteTelephonyConfig(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.telephonyConfig.delete({ where: { id } });

    revalidatePath("/settings/integrations/telephony");
    return { success: true as const };
  } catch (error) {
    console.error("deleteTelephonyConfig error:", error);
    return { success: false as const, error: "Failed to delete telephony config" };
  }
}

// ============================================================
// Test telephony connection
// ============================================================

export async function testTelephonyConnection() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const config = await prisma.telephonyConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return { success: false as const, error: "No active telephony configuration found" };
    }

    // Simple validation test based on provider
    const adapter = getTelephonyAdapter(config);
    if (!adapter) {
      return { success: false as const, error: "Invalid provider configuration" };
    }

    // For now, verify the config is valid by checking required fields
    if (config.provider === "EXOTEL" && (!config.accountSid || !config.subdomain)) {
      return { success: false as const, error: "Exotel requires Account SID and Subdomain" };
    }

    return { success: true as const, data: { provider: config.provider, message: "Configuration looks valid. Make a test call to verify." } };
  } catch (error) {
    console.error("testTelephonyConnection error:", error);
    return { success: false as const, error: "Connection test failed" };
  }
}

// ============================================================
// Initiate a call via telephony provider
// ============================================================

export async function initiateCall(input: InitiateCallInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Placing a real, billable outbound call is a communications mutation —
    // gate it on the same permission as logCall (communications:create).
    if (!hasPermission(session.user.role, "communications:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = initiateCallSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const config = await prisma.telephonyConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return { success: false as const, error: "NO_CONFIG" };
    }

    // Get agent's phone number
    const agent = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true, name: true },
    });

    if (!agent?.phone) {
      return { success: false as const, error: "Your phone number is not set. Update your profile first." };
    }

    const adapter = getTelephonyAdapter(config);
    const result = await adapter.initiateCall(agent.phone, parsed.data.phoneNumber, config.callerId);

    if (!result.success) {
      return { success: false as const, error: result.message || "Failed to initiate call" };
    }

    // Create Communication + CallLog record
    const communication = await prisma.communication.create({
      data: {
        type: "CALL",
        direction: "OUTBOUND",
        content: `Outbound call initiated via ${config.provider}`,
        contactId: parsed.data.contactId,
        createdById: session.user.id,
      },
    });

    const callLog = await prisma.callLog.create({
      data: {
        disposition: "COMPLETED",
        externalCallId: result.externalCallId,
        communicationId: communication.id,
        contactId: parsed.data.contactId,
        agentId: session.user.id,
      },
    });

    return {
      success: true as const,
      data: {
        callLogId: callLog.id,
        externalCallId: result.externalCallId,
        provider: config.provider,
      },
    };
  } catch (error) {
    console.error("initiateCall error:", error);
    return { success: false as const, error: "Failed to initiate call" };
  }
}
