"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { savedViewSchema, type SavedViewInput } from "@/schemas/saved-view.schema";

// ============================================================
// Types
// ============================================================

export interface SavedViewData {
  id: string;
  name: string;
  entityType: string;
  filters: unknown;
  sortBy: string | null;
  sortOrder: string | null;
  columns: string[];
  isDefault: boolean;
  isShared: boolean;
  isSystem: boolean;
  createdById: string;
  createdAt: string;
}

// ============================================================
// Get Saved Views
// ============================================================

export async function getSavedViews(
  entityType: string
): Promise<
  | { success: true; data: SavedViewData[] }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const views = await prisma.savedView.findMany({
      where: {
        entityType,
        OR: [
          { isSystem: true },
          { isShared: true },
          { createdById: session.user.id },
        ],
      },
      orderBy: [
        { isSystem: "desc" },
        { isDefault: "desc" },
        { name: "asc" },
      ],
    });

    return { success: true as const, data: serialize(views) };
  } catch (error) {
    console.error("getSavedViews error:", error);
    return { success: false as const, error: "Failed to load views" };
  }
}

// ============================================================
// Create Saved View
// ============================================================

export async function createSavedView(
  input: SavedViewInput
): Promise<
  | { success: true; data: SavedViewData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = savedViewSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? "Validation failed" };
    }

    const data = parsed.data;

    // If setting as default, unset previous default for this entity
    if (data.isDefault) {
      await prisma.savedView.updateMany({
        where: {
          entityType: data.entityType,
          createdById: session.user.id,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const view = await prisma.savedView.create({
      data: {
        name: data.name,
        entityType: data.entityType,
        filters: data.filters as unknown as object,
        sortBy: data.sortBy,
        sortOrder: data.sortOrder,
        columns: data.columns,
        isDefault: data.isDefault || false,
        isShared: data.isShared || false,
        isSystem: false,
        createdById: session.user.id,
      },
    });

    return { success: true as const, data: serialize(view) };
  } catch (error) {
    console.error("createSavedView error:", error);
    return { success: false as const, error: "Failed to create view" };
  }
}

// ============================================================
// Update Saved View
// ============================================================

export async function updateSavedView(
  id: string,
  input: Partial<SavedViewInput>
): Promise<
  | { success: true; data: SavedViewData }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.savedView.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "View not found" };
    }
    if (existing.isSystem) {
      return { success: false as const, error: "Cannot edit system views" };
    }
    if (existing.createdById !== session.user.id) {
      return { success: false as const, error: "Not authorized" };
    }

    const view = await prisma.savedView.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.filters !== undefined && { filters: input.filters as unknown as object }),
        ...(input.sortBy !== undefined && { sortBy: input.sortBy }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.columns !== undefined && { columns: input.columns }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        ...(input.isShared !== undefined && { isShared: input.isShared }),
      },
    });

    return { success: true as const, data: serialize(view) };
  } catch (error) {
    console.error("updateSavedView error:", error);
    return { success: false as const, error: "Failed to update view" };
  }
}

// ============================================================
// Delete Saved View
// ============================================================

export async function deleteSavedView(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.savedView.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "View not found" };
    }
    if (existing.isSystem) {
      return { success: false as const, error: "Cannot delete system views" };
    }
    if (existing.createdById !== session.user.id) {
      return { success: false as const, error: "Not authorized" };
    }

    await prisma.savedView.delete({ where: { id } });
    return { success: true as const };
  } catch (error) {
    console.error("deleteSavedView error:", error);
    return { success: false as const, error: "Failed to delete view" };
  }
}

// ============================================================
// Set Default View
// ============================================================

export async function setDefaultView(
  id: string,
  entityType: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Verify the user owns this view before setting it as default
    const view = await prisma.savedView.findUnique({ where: { id } });
    if (!view) {
      return { success: false as const, error: "View not found" };
    }
    if (view.createdById !== session.user.id) {
      return { success: false as const, error: "Not authorized to modify this view" };
    }

    // Unset previous defaults
    await prisma.savedView.updateMany({
      where: {
        entityType,
        createdById: session.user.id,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Set new default
    await prisma.savedView.update({
      where: { id },
      data: { isDefault: true },
    });

    return { success: true as const };
  } catch (error) {
    console.error("setDefaultView error:", error);
    return { success: false as const, error: "Failed to set default" };
  }
}
