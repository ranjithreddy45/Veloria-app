"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  documentSchema,
  documentUpdateSchema,
  type DocumentInput,
  type DocumentUpdateInput,
} from "@/schemas/document.schema";

// ============================================================
// Get Documents (Filtered)
// ============================================================

export async function getDocuments(params?: {
  category?: string;
  bookingId?: string;
  contactId?: string;
  venueId?: string;
  search?: string;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { fileName: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: [search] } },
      ];
    }

    if (params?.category) {
      where.category = params.category;
    }

    if (params?.bookingId) {
      where.bookingId = params.bookingId;
    }

    if (params?.contactId) {
      where.contactId = params.contactId;
    }

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(documents),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_DOCUMENTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch documents" };
  }
}

// ============================================================
// Get Single Document
// ============================================================

export async function getDocument(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return { success: false as const, error: "Document not found" };
    }

    return { success: true as const, data: serialize(document) };
  } catch (error) {
    console.error("[GET_DOCUMENT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch document" };
  }
}

// ============================================================
// Upload / Create Document
// ============================================================

export async function uploadDocument(data: DocumentInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "documents:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = documentSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    const docData = parsed.data;

    const document = await prisma.document.create({
      data: {
        name: docData.name,
        fileName: docData.fileName || docData.name,
        mimeType: docData.mimeType || "application/octet-stream",
        size: docData.size ?? 0,
        category: docData.category,
        url: docData.url || null,
        isPublic: docData.isPublic,
        bookingId: docData.bookingId || null,
        contactId: docData.contactId || null,
        venueId: docData.venueId || null,
        uploadedById: session.user.id,
        tags: docData.tags ?? [],
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Document",
      entityId: document.id,
    });

    revalidatePath("/documents");
    return { success: true as const, data: serialize(document) };
  } catch (error) {
    console.error("[UPLOAD_DOCUMENT_ERROR]", error);
    return { success: false as const, error: "Failed to upload document" };
  }
}

// ============================================================
// Update Document
// ============================================================

export async function updateDocument(id: string, data: DocumentUpdateInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "documents:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = documentUpdateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    const existing = await prisma.document.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Document not found" };
    }

    const updateData = parsed.data;

    const document = await prisma.document.update({
      where: { id },
      data: {
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.category !== undefined && {
          category: updateData.category,
        }),
        ...(updateData.isPublic !== undefined && {
          isPublic: updateData.isPublic,
        }),
        ...(updateData.tags !== undefined && { tags: updateData.tags }),
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Document",
      entityId: document.id,
    });

    revalidatePath("/documents");
    return { success: true as const, data: serialize(document) };
  } catch (error) {
    console.error("[UPDATE_DOCUMENT_ERROR]", error);
    return { success: false as const, error: "Failed to update document" };
  }
}

// ============================================================
// Delete Document
// ============================================================

export async function deleteDocument(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "documents:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.document.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false as const, error: "Document not found" };
    }

    await prisma.document.delete({ where: { id } });

    logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Document",
      entityId: id,
    });

    revalidatePath("/documents");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_DOCUMENT_ERROR]", error);
    return { success: false as const, error: "Failed to delete document" };
  }
}

// ============================================================
// Get Documents by Entity (for embedded use)
// ============================================================

export async function getDocumentsByEntity(
  entityType: "booking" | "contact" | "venue",
  entityId: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    switch (entityType) {
      case "booking":
        where.bookingId = entityId;
        break;
      case "contact":
        where.contactId = entityId;
        break;
      case "venue":
        where.venueId = entityId;
        break;
      default:
        return { success: false as const, error: "Invalid entity type" };
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(documents) };
  } catch (error) {
    console.error("[GET_DOCUMENTS_BY_ENTITY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch documents" };
  }
}
