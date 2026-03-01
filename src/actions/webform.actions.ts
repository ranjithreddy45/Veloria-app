"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { webformSchema, type WebformInput } from "@/schemas/webform.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import type { Prisma } from "@prisma/client";

// ============================================================
// Helper: Generate slug from name
// ============================================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ============================================================
// Get Webforms (Paginated + Filters)
// ============================================================

export async function getWebforms(params?: {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [webforms, total] = await Promise.all([
      prisma.webform.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: { submissions: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.webform.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(webforms),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_WEBFORMS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch webforms" };
  }
}

// ============================================================
// Get Single Webform
// ============================================================

export async function getWebform(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const webform = await prisma.webform.findUnique({
      where: { id },
      include: {
        _count: {
          select: { submissions: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!webform) {
      return { success: false as const, error: "Webform not found" };
    }

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[GET_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to fetch webform" };
  }
}

// ============================================================
// Get Webform by Slug (Public — No Auth Required)
// ============================================================

export async function getWebformBySlug(slug: string) {
  try {
    const webform = await prisma.webform.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        fields: true,
        styling: true,
        thankYouUrl: true,
        thankYouMessage: true,
        honeypotField: true,
        isActive: true,
      },
    });

    if (!webform) {
      return { success: false as const, error: "Webform not found" };
    }

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[GET_WEBFORM_BY_SLUG_ERROR]", error);
    return { success: false as const, error: "Failed to fetch webform" };
  }
}

// ============================================================
// Create Webform
// ============================================================

export async function createWebform(input: WebformInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = webformSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Validation failed";
      return { success: false as const, error: firstError };
    }

    const data = parsed.data;

    // Generate slug if not provided
    let slug = data.slug?.trim() || generateSlug(data.name);

    // Ensure slug uniqueness
    const existing = await prisma.webform.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const webform = await prisma.webform.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        fields: data.fields as unknown as Prisma.InputJsonValue,
        styling: (data.styling as Prisma.InputJsonValue) ?? undefined,
        thankYouUrl: data.thankYouUrl || null,
        thankYouMessage: data.thankYouMessage || null,
        notifyUserIds: data.notifyUserIds ?? [],
        autoAssignTo: data.autoAssignTo || null,
        defaultSource: data.defaultSource,
        honeypotField: data.honeypotField || null,
        isActive: data.isActive,
        createdById: session.user.id,
      },
    });

    // Log activity
    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Webform",
      entityId: webform.id,
      changes: { name: webform.name, slug: webform.slug },
    });

    revalidatePath("/settings/webforms");

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[CREATE_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to create webform" };
  }
}

// ============================================================
// Update Webform
// ============================================================

export async function updateWebform(id: string, input: WebformInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = webformSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Validation failed";
      return { success: false as const, error: firstError };
    }

    const data = parsed.data;

    // Check existence
    const existing = await prisma.webform.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Webform not found" };
    }

    // Handle slug if changed
    let slug = data.slug?.trim() || existing.slug;
    if (slug !== existing.slug) {
      const slugExists = await prisma.webform.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugExists) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
    }

    const webform = await prisma.webform.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        fields: data.fields as unknown as Prisma.InputJsonValue,
        styling: (data.styling as Prisma.InputJsonValue) ?? undefined,
        thankYouUrl: data.thankYouUrl || null,
        thankYouMessage: data.thankYouMessage || null,
        notifyUserIds: data.notifyUserIds ?? [],
        autoAssignTo: data.autoAssignTo || null,
        defaultSource: data.defaultSource,
        honeypotField: data.honeypotField || null,
        isActive: data.isActive,
      },
    });

    // Log activity
    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Webform",
      entityId: webform.id,
      changes: { name: webform.name, slug: webform.slug },
    });

    revalidatePath("/settings/webforms");
    revalidatePath(`/settings/webforms/${id}`);

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[UPDATE_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to update webform" };
  }
}

// ============================================================
// Delete Webform
// ============================================================

export async function deleteWebform(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.webform.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Webform not found" };
    }

    await prisma.webform.delete({ where: { id } });

    // Log activity
    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "Webform",
      entityId: id,
      changes: { name: existing.name },
    });

    revalidatePath("/settings/webforms");

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to delete webform" };
  }
}

// ============================================================
// Toggle Webform Active Status
// ============================================================

export async function toggleWebform(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.webform.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Webform not found" };
    }

    const webform = await prisma.webform.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Webform",
      entityId: id,
      changes: { isActive: webform.isActive },
    });

    revalidatePath("/settings/webforms");
    revalidatePath(`/settings/webforms/${id}`);

    return { success: true as const, data: serialize(webform) };
  } catch (error) {
    console.error("[TOGGLE_WEBFORM_ERROR]", error);
    return { success: false as const, error: "Failed to toggle webform" };
  }
}

// ============================================================
// Get Submissions (Paginated)
// ============================================================

export async function getSubmissions(
  webformId: string,
  params?: {
    page?: number;
    limit?: number;
    isSpam?: boolean;
  }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { webformId };

    if (params?.isSpam !== undefined) {
      where.isSpam = params.isSpam;
    }

    const [submissions, total] = await Promise.all([
      prisma.webformSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.webformSubmission.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(submissions),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_SUBMISSIONS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch submissions" };
  }
}

// ============================================================
// Get Submission Stats
// ============================================================

export async function getSubmissionStats(webformId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [total, today, thisWeek, spam] = await Promise.all([
      prisma.webformSubmission.count({ where: { webformId } }),
      prisma.webformSubmission.count({
        where: { webformId, createdAt: { gte: todayStart } },
      }),
      prisma.webformSubmission.count({
        where: { webformId, createdAt: { gte: weekStart } },
      }),
      prisma.webformSubmission.count({
        where: { webformId, isSpam: true },
      }),
    ]);

    return {
      success: true as const,
      data: { total, today, thisWeek, spam },
    };
  } catch (error) {
    console.error("[GET_SUBMISSION_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch stats" };
  }
}

// ============================================================
// Generate Embed Code
// ============================================================

export async function generateEmbedCode(webformId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const webform = await prisma.webform.findUnique({
      where: { id: webformId },
      select: { slug: true, name: true },
    });

    if (!webform) {
      return { success: false as const, error: "Webform not found" };
    }

    // Build base URL from environment or fallback
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const formUrl = `${baseUrl}/form/${webform.slug}`;
    const apiUrl = `${baseUrl}/api/webforms/${webform.slug}`;

    const iframe = `<!-- ${webform.name} - Embedded Form -->
<iframe
  src="${formUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; max-width: 600px;"
  title="${webform.name}"
></iframe>`;

    const jsEmbed = `<!-- ${webform.name} - JavaScript Embed -->
<div id="veloria-form-${webform.slug}"></div>
<script>
(function() {
  var container = document.getElementById('veloria-form-${webform.slug}');
  var iframe = document.createElement('iframe');
  iframe.src = '${formUrl}';
  iframe.width = '100%';
  iframe.height = '600';
  iframe.frameBorder = '0';
  iframe.style.border = 'none';
  iframe.style.maxWidth = '600px';
  iframe.title = '${webform.name}';
  container.appendChild(iframe);
})();
</script>`;

    return {
      success: true as const,
      data: {
        formUrl,
        apiUrl,
        iframe,
        jsEmbed,
      },
    };
  } catch (error) {
    console.error("[GENERATE_EMBED_CODE_ERROR]", error);
    return { success: false as const, error: "Failed to generate embed code" };
  }
}
