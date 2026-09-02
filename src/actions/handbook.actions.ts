"use server";

// ============================================================
// Employee Handbook — HR-managed document (add / replace / remove).
// ------------------------------------------------------------
// The handbook lives as a Document row (category "HANDBOOK", url = base64
// data-URL). The newest row is the current edition. Reading is open to every
// signed-in staff member; changing it requires hr:write. The PDF is served by
// /api/hr/handbook, which streams the stored bytes.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";

const CATEGORY = "HANDBOOK";
// The platform's server-action body cap is ~4.5MB; base64 inflates by ~33%,
// so a 3MB PDF (~4MB encoded) is the safe ceiling. Clear error, never silent.
const MAX_PDF_BYTES = 3 * 1024 * 1024;

export async function getHandbookMeta(): Promise<
  | { success: true; data: { id: string; name: string; fileName: string; size: number; updatedAt: string } | null }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  const doc = await prisma.document.findFirst({
    where: { category: CATEGORY },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, fileName: true, size: true, updatedAt: true },
  });
  return {
    success: true,
    data: doc ? { ...doc, updatedAt: doc.updatedAt.toISOString() } : null,
  };
}

export async function uploadHandbook(input: {
  fileName: string;
  /** A data URL: data:application/pdf;base64,... */
  dataUrl: string;
  /** Display name, e.g. "Employee Handbook v1.2". */
  name?: string;
}): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "hr:write")) {
    return { success: false, error: "Only HR can update the handbook." };
  }

  const dataUrl = input.dataUrl?.trim() ?? "";
  if (!/^data:application\/pdf;base64,/i.test(dataUrl)) {
    return { success: false, error: "Only PDF files are accepted." };
  }
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const size = Math.floor((b64.length * 3) / 4);
  if (size <= 0) return { success: false, error: "The file appears to be empty." };
  if (size > MAX_PDF_BYTES) {
    return {
      success: false,
      error: `The PDF is ${(size / (1024 * 1024)).toFixed(1)}MB — the ceiling is ${MAX_PDF_BYTES / (1024 * 1024)}MB. Compress it (e.g. export at a lower quality) and try again.`,
    };
  }

  const fileName = (input.fileName?.trim() || "employee-handbook.pdf").replace(/[^\w.\- ]/g, "");
  const name = input.name?.trim() || "Employee Handbook";

  const created = await prisma.document.create({
    data: {
      name,
      fileName,
      mimeType: "application/pdf",
      size,
      category: CATEGORY,
      url: dataUrl,
      isPublic: false,
      uploadedById: session.user.id as string,
      tags: ["hr", "handbook"],
    },
    select: { id: true },
  });
  // One current edition: keep only the newest row so old versions can't be
  // served by mistake (Replace = upload new + prune old).
  await prisma.document.deleteMany({ where: { category: CATEGORY, id: { not: created.id } } });

  await logActivity({
    userId: session.user.id as string,
    action: "handbook_uploaded",
    entityType: "Document",
    entityId: created.id,
    changes: { fileName, size },
  });
  revalidatePath("/people/handbook");
  return { success: true, data: { id: created.id } };
}

export async function removeHandbook(): Promise<
  { success: true; data: { removed: number } } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "hr:write")) {
    return { success: false, error: "Only HR can remove the handbook." };
  }
  const res = await prisma.document.deleteMany({ where: { category: CATEGORY } });
  await logActivity({
    userId: session.user.id as string,
    action: "handbook_removed",
    entityType: "Document",
    entityId: "bulk",
  });
  revalidatePath("/people/handbook");
  return { success: true, data: { removed: res.count } };
}
