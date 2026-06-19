"use server";

// ============================================================
// Public quote drafts — INTERNAL/gated admin actions.
// ------------------------------------------------------------
// Powers the sales triage page at /settings/public-quotes. Unlike the public
// configurator actions, every export here gates at the top via auth() +
// hasPermission(). Decimals are serialized for the client.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { createSalesQuotation } from "@/actions/sales-quotation.actions";
import type { QuotationInput } from "@/lib/sales/quotation-calc";
import type { PublicQuoteStatus } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

export interface PublicQuoteDraftRow {
  id: string;
  token: string;
  status: PublicQuoteStatus;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  occasion: string | null;
  eventDate: string | null;
  timeSlot: string | null;
  guestCount: number;
  grandTotal: number;
  advanceAmount: number;
  paymentLinkUrl: string | null;
  invoiceId: string | null;
  leadId: string | null;
  salesQuotationId: string | null;
  venueName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listPublicQuoteDrafts(params?: {
  status?: PublicQuoteStatus;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<Result<{ data: PublicQuoteDraftRow[]; total: number; page: number; limit: number; totalPages: number }>> {
  const user = await requireUser();
  if (!user?.role || !hasPermission(user.role, "publicquotes:read")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (params?.status) where.status = params.status;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { occasion: { contains: search, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.publicQuoteDraft.findMany({
        where,
        include: { venue: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.publicQuoteDraft.count({ where }),
    ]);

    const data: PublicQuoteDraftRow[] = rows.map((r) => ({
      id: r.id,
      token: r.token,
      status: r.status,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      occasion: r.occasion,
      eventDate: r.eventDate ? r.eventDate.toISOString() : null,
      timeSlot: r.timeSlot,
      guestCount: r.guestCount,
      grandTotal: Number(r.grandTotal),
      advanceAmount: Number(r.advanceAmount),
      paymentLinkUrl: r.paymentLinkUrl,
      invoiceId: r.invoiceId,
      leadId: r.leadId,
      salesQuotationId: r.salesQuotationId,
      venueName: r.venue?.name ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      success: true,
      data: { data: serialize(data), total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error("[LIST_PUBLIC_QUOTE_DRAFTS_ERROR]", error);
    return { success: false, error: "Failed to load public quotes" };
  }
}

/**
 * Promote a public draft into an internal SalesQuotation via the existing
 * createSalesQuotation flow, then stamp salesQuotationId + CONVERTED on the
 * draft. Reuses the gated quotation engine — does not fork pricing.
 */
export async function promotePublicQuoteToSalesQuotation(
  token: string
): Promise<Result<{ salesQuotationId: string }>> {
  const user = await requireUser();
  if (!user?.role || !hasPermission(user.role, "publicquotes:manage")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const row = await prisma.publicQuoteDraft.findUnique({ where: { token } });
    if (!row) return { success: false, error: "Quote not found" };
    if (row.salesQuotationId) {
      return { success: true, data: { salesQuotationId: row.salesQuotationId } };
    }

    const input = row.inputsJson as unknown as QuotationInput;
    const created = await createSalesQuotation(input, {
      clientName: row.customerName || undefined,
      clientPhone: row.customerPhone || undefined,
      clientEmail: row.customerEmail || undefined,
      occasion: row.occasion || undefined,
      eventDate: row.eventDate ?? null,
      timeSlot: row.timeSlot || undefined,
      venueId: row.venueId || null,
      notes: "Promoted from a public self-serve configurator draft.",
    });
    if (!created.success) {
      return { success: false, error: created.error };
    }

    await prisma.publicQuoteDraft.update({
      where: { token },
      data: {
        salesQuotationId: created.data.id,
        status: row.status === "ABANDONED" ? "ABANDONED" : "CONVERTED",
      },
    });

    revalidatePath("/settings/public-quotes");
    revalidatePath("/quotations");
    return { success: true, data: { salesQuotationId: created.data.id } };
  } catch (error) {
    console.error("[PROMOTE_PUBLIC_QUOTE_ERROR]", error);
    return { success: false, error: "Failed to promote quote" };
  }
}
