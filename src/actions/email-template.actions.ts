"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  emailTemplateSchema,
  type EmailTemplateInput,
} from "@/schemas/campaign.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Email Templates
// ============================================================

export async function getEmailTemplates(params?: {
  category?: string;
  isActive?: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "email-templates:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.category) {
      where.category = params.category;
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(templates) };
  } catch (error) {
    console.error("[GET_EMAIL_TEMPLATES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch email templates" };
  }
}

// ============================================================
// Get Single Email Template
// ============================================================

export async function getEmailTemplateById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "email-templates:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return { success: false as const, error: "Email template not found" };
    }

    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[GET_EMAIL_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch email template" };
  }
}

// ============================================================
// Create Email Template
// ============================================================

export async function createEmailTemplate(data: EmailTemplateInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "email-templates:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = emailTemplateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const templateData = parsed.data;

    const template = await prisma.emailTemplate.create({
      data: {
        name: templateData.name,
        subject: templateData.subject,
        htmlContent: templateData.htmlContent,
        category: templateData.category || null,
        isActive: templateData.isActive,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "EmailTemplate",
      entityId: template.id,
    });

    revalidatePath("/settings/email-templates");
    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[CREATE_EMAIL_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to create email template" };
  }
}

// ============================================================
// Update Email Template
// ============================================================

export async function updateEmailTemplate(id: string, data: EmailTemplateInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "email-templates:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = emailTemplateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Email template not found" };
    }

    const templateData = parsed.data;

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: templateData.name,
        subject: templateData.subject,
        htmlContent: templateData.htmlContent,
        category: templateData.category || null,
        isActive: templateData.isActive,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "EmailTemplate",
      entityId: template.id,
    });

    revalidatePath("/settings/email-templates");
    return { success: true as const, data: serialize(template) };
  } catch (error) {
    console.error("[UPDATE_EMAIL_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to update email template" };
  }
}

// ============================================================
// Delete Email Template
// ============================================================

export async function deleteEmailTemplate(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "email-templates:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Email template not found" };
    }

    await prisma.emailTemplate.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "EmailTemplate",
      entityId: id,
    });

    revalidatePath("/settings/email-templates");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_EMAIL_TEMPLATE_ERROR]", error);
    return { success: false as const, error: "Failed to delete email template" };
  }
}
