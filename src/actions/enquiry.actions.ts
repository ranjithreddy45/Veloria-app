"use server";

// ============================================================
// Sale-enquiry (WidgetInquiry) status — Interested / Dropped / No response.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
// NOTE: a "use server" file may ONLY export async functions. The status
// constants + type therefore live in a plain module and are imported here.
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/lib/enquiry-status";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export async function setEnquiryStatus(inquiryId: string, status: EnquiryStatus | null): Promise<Result<{ id: string }>> {
  const s = await auth();
  const user = s?.user as { id: string; role?: string } | undefined;
  if (!user?.id) return { success: false, error: "Unauthorized" };
  if (!hasPermission(user.role ?? "", "leads:update")) return { success: false, error: "You don't have permission to update enquiries." };
  if (status !== null && !ENQUIRY_STATUSES.includes(status)) return { success: false, error: "Invalid status." };

  const exists = await prisma.widgetInquiry.findUnique({ where: { id: inquiryId }, select: { id: true } });
  if (!exists) return { success: false, error: "Enquiry not found." };

  await prisma.widgetInquiry.update({ where: { id: inquiryId }, data: { enquiryStatus: status } });
  revalidatePath("/inquiries");
  return { success: true, data: { id: inquiryId } };
}
