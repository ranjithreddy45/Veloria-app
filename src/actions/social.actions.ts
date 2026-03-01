"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  socialPostSchema,
  updateSocialPostSchema,
  scheduleSocialPostSchema,
  type SocialPostInput,
  type UpdateSocialPostInput,
} from "@/schemas/social.schema";
import type { SocialPlatform, SocialPostStatus } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import {
  postToSocial,
  getSocialAnalytics as fetchPlatformAnalytics,
} from "@/lib/integrations/social";

// ============================================================
// Get Social Posts (Filtered)
// ============================================================

export async function getSocialPosts(params?: {
  platform?: SocialPlatform;
  status?: SocialPostStatus;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "social:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.platform) {
      where.platform = params.platform;
    }

    if (params?.status) {
      where.status = params.status;
    }

    const posts = await prisma.socialPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(posts) };
  } catch (error) {
    console.error("[GET_SOCIAL_POSTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch social posts" };
  }
}

// ============================================================
// Get Single Social Post
// ============================================================

export async function getSocialPostById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "social:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const post = await prisma.socialPost.findUnique({
      where: { id },
    });

    if (!post) {
      return { success: false as const, error: "Social post not found" };
    }

    return { success: true as const, data: serialize(post) };
  } catch (error) {
    console.error("[GET_SOCIAL_POST_ERROR]", error);
    return { success: false as const, error: "Failed to fetch social post" };
  }
}

// ============================================================
// Create Social Post (DRAFT status)
// ============================================================

export async function createSocialPost(data: SocialPostInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "social:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = socialPostSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    const post = await prisma.socialPost.create({
      data: {
        platform: parsed.data.platform,
        content: parsed.data.content,
        imageUrl: parsed.data.imageUrl || null,
        status: "DRAFT",
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "SocialPost",
      entityId: post.id,
      changes: { platform: post.platform, content: post.content.slice(0, 100) },
    });

    revalidatePath("/settings/integrations/social");

    return { success: true as const, data: serialize(post) };
  } catch (error) {
    console.error("[CREATE_SOCIAL_POST_ERROR]", error);
    return { success: false as const, error: "Failed to create social post" };
  }
}

// ============================================================
// Update Social Post (only DRAFT)
// ============================================================

export async function updateSocialPost(id: string, data: UpdateSocialPostInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "social:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateSocialPostSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    const existing = await prisma.socialPost.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Social post not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft posts can be updated",
      };
    }

    const post = await prisma.socialPost.update({
      where: { id },
      data: {
        ...(parsed.data.platform && { platform: parsed.data.platform }),
        ...(parsed.data.content && { content: parsed.data.content }),
        ...(parsed.data.imageUrl !== undefined && {
          imageUrl: parsed.data.imageUrl || null,
        }),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "SocialPost",
      entityId: post.id,
    });

    revalidatePath("/settings/integrations/social");

    return { success: true as const, data: serialize(post) };
  } catch (error) {
    console.error("[UPDATE_SOCIAL_POST_ERROR]", error);
    return { success: false as const, error: "Failed to update social post" };
  }
}

// ============================================================
// Delete Social Post (only DRAFT)
// ============================================================

export async function deleteSocialPost(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "social:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.socialPost.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Social post not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft posts can be deleted",
      };
    }

    await prisma.socialPost.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "SocialPost",
      entityId: id,
    });

    revalidatePath("/settings/integrations/social");

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_SOCIAL_POST_ERROR]", error);
    return { success: false as const, error: "Failed to delete social post" };
  }
}

// ============================================================
// Schedule Social Post
// ============================================================

export async function scheduleSocialPost(id: string, scheduledAt: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "social:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = scheduleSocialPostSchema.safeParse({ scheduledAt });
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    const existing = await prisma.socialPost.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Social post not found" };
    }

    if (existing.status === "POSTED") {
      return {
        success: false as const,
        error: "Already posted — cannot reschedule",
      };
    }

    const post = await prisma.socialPost.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        scheduledAt: new Date(parsed.data.scheduledAt),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "SocialPost",
      entityId: post.id,
      changes: { from: existing.status, to: "SCHEDULED", scheduledAt: parsed.data.scheduledAt },
    });

    revalidatePath("/settings/integrations/social");

    return { success: true as const, data: serialize(post) };
  } catch (error) {
    console.error("[SCHEDULE_SOCIAL_POST_ERROR]", error);
    return { success: false as const, error: "Failed to schedule social post" };
  }
}

// ============================================================
// Publish Social Post (calls placeholder API)
// ============================================================

export async function publishSocialPost(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "social:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.socialPost.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Social post not found" };
    }

    if (existing.status === "POSTED") {
      return { success: false as const, error: "Post has already been published" };
    }

    // Call the placeholder social media API
    const result = await postToSocial({
      platform: existing.platform,
      content: existing.content,
      imageUrl: existing.imageUrl ?? undefined,
    });

    if (!result.success) {
      return { success: false as const, error: "Failed to publish to social platform" };
    }

    // Mock engagement data
    const engagement = {
      likes: Math.floor(Math.random() * 500) + 10,
      comments: Math.floor(Math.random() * 50) + 1,
      shares: Math.floor(Math.random() * 100) + 1,
      impressions: Math.floor(Math.random() * 5000) + 500,
      externalPostId: result.postId,
    };

    const post = await prisma.socialPost.update({
      where: { id },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        engagement,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "SocialPost",
      entityId: post.id,
      changes: { from: existing.status, to: "POSTED", postId: result.postId },
    });

    revalidatePath("/settings/integrations/social");

    return { success: true as const, data: serialize(post) };
  } catch (error) {
    console.error("[PUBLISH_SOCIAL_POST_ERROR]", error);
    return { success: false as const, error: "Failed to publish social post" };
  }
}

// ============================================================
// Get Social Analytics (mock data per platform)
// ============================================================

export async function getSocialAnalytics() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "social:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const platforms = ["INSTAGRAM", "FACEBOOK", "TWITTER", "LINKEDIN"] as const;

    const analytics = await Promise.all(
      platforms.map(async (platform) => {
        const data = await fetchPlatformAnalytics(platform);
        return { platform, ...data };
      })
    );

    return { success: true as const, data: analytics };
  } catch (error) {
    console.error("[GET_SOCIAL_ANALYTICS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch social analytics" };
  }
}
