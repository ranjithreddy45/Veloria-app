"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";
import { revalidatePath } from "next/cache";

// ============================================================
// OMS CR-005 — Vendor Notification & Work Orders (Stage 3)
// ============================================================
// Additive module. WorkOrder has no FK relations in the schema, so we resolve
// vendor / booking context with separate reads. Every status transition uses an
// atomic guarded updateMany (where status = expected) so concurrent requests
// can't double-apply a transition. Result convention mirrors beo.actions.

type Result<T> = { success: true; data: T } | { success: false; error: string };

const WO_STATUSES = ["DRAFT", "SENT", "ACKNOWLEDGED", "SIGNED", "DECLINED"] as const;
type WoStatus = (typeof WO_STATUSES)[number];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

// Either permission grants access (vendor-coordination or general ops update).
const canWrite = (r?: string) =>
  !!r && (hasPermission(r, "vendors:assign") || hasPermission(r, "operations:update"));

// ------------------------------------------------------------
// Serializer — Decimal→Number, Date→ISO at the client boundary
// ------------------------------------------------------------
type WorkOrderRow = {
  id: string;
  woNumber: string | null;
  bookingId: string;
  vendorId: string;
  serviceType: string;
  scope: string | null;
  terms: string | null;
  advanceAmount: { toString(): string } | null;
  status: string;
  sentAt: Date | null;
  acknowledgedAt: Date | null;
  signedAt: Date | null;
  signerName: string | null;
  signatureUrl: string | null;
  declinedAt: Date | null;
  declineReason: string | null;
  advanceReleasedAt: Date | null;
  advanceReleasedById: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

function serializeWorkOrder(w: WorkOrderRow, vendorName: string | null) {
  return {
    id: w.id,
    woNumber: w.woNumber,
    bookingId: w.bookingId,
    vendorId: w.vendorId,
    vendorName: vendorName ?? null,
    serviceType: w.serviceType,
    scope: w.scope,
    terms: w.terms,
    advanceAmount: w.advanceAmount != null ? Number(w.advanceAmount) : null,
    status: w.status,
    sentAt: w.sentAt?.toISOString() ?? null,
    acknowledgedAt: w.acknowledgedAt?.toISOString() ?? null,
    signedAt: w.signedAt?.toISOString() ?? null,
    signerName: w.signerName,
    signatureUrl: w.signatureUrl,
    declinedAt: w.declinedAt?.toISOString() ?? null,
    declineReason: w.declineReason,
    advanceReleasedAt: w.advanceReleasedAt?.toISOString() ?? null,
    advanceReleasedById: w.advanceReleasedById,
    createdById: w.createdById,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export type WorkOrderDTO = ReturnType<typeof serializeWorkOrder>;

async function vendorNameMap(vendorIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (vendorIds.length === 0) return map;
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  for (const v of vendors) map.set(v.id, v.name);
  return map;
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getWorkOrders(bookingId: string): Promise<Result<WorkOrderDTO[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };
  if (!bookingId) return { success: false, error: "A booking is required" };

  const rows = await prisma.workOrder.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
  });
  const names = await vendorNameMap([...new Set(rows.map((r) => r.vendorId))]);
  return {
    success: true,
    data: rows.map((r) => serializeWorkOrder(r, names.get(r.vendorId) ?? null)),
  };
}

// ------------------------------------------------------------
// Create — allocate woNumber WO-YYYY-NNN via count()+P2002 retry
// ------------------------------------------------------------
export async function createWorkOrder(
  bookingId: string,
  input: { vendorId: string; serviceType: string; scope?: string; terms?: string; advanceAmount?: number }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };
  if (!bookingId) return { success: false, error: "A booking is required" };

  const vendorId = input.vendorId?.trim();
  const serviceType = input.serviceType?.trim();
  if (!vendorId) return { success: false, error: "A vendor is required" };
  if (!serviceType) return { success: false, error: "A service type is required" };

  const [booking, vendor] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true } }),
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }),
  ]);
  if (!booking) return { success: false, error: "Booking not found" };
  if (!vendor) return { success: false, error: "Vendor not found" };

  let advanceAmount: number | null = null;
  if (input.advanceAmount != null && input.advanceAmount !== undefined) {
    const amt = Number(input.advanceAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      return { success: false, error: "Advance amount must be a non-negative number." };
    }
    advanceAmount = amt;
  }

  const year = new Date().getFullYear();
  // woNumber is @unique. Allocate sequentially via count() and retry on the
  // P2002 unique-constraint collision a concurrent create would cause.
  for (let attempt = 0; attempt < 8; attempt++) {
    const countThisYear = await prisma.workOrder.count({ where: { woNumber: { startsWith: `WO-${year}-` } } });
    const woNumber = `WO-${year}-${String(countThisYear + 1 + attempt).padStart(3, "0")}`;
    try {
      const created = await prisma.workOrder.create({
        data: {
          woNumber,
          bookingId,
          vendorId,
          serviceType,
          scope: input.scope?.trim() || null,
          terms: input.terms?.trim() || null,
          advanceAmount,
          status: "DRAFT",
          createdById: u.id,
        },
        select: { id: true },
      });
      void logActivity({ userId: u.id, action: "created", entityType: "WorkOrder", entityId: created.id, changes: { woNumber, bookingId, vendorId } });
      revalidatePath(`/bookings/${bookingId}`);
      return { success: true, data: { id: created.id } };
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") continue; // number raced — retry with next index
      throw e;
    }
  }
  return { success: false, error: "Couldn't allocate a work-order number — please retry." };
}

// ------------------------------------------------------------
// Shared: load a WO with vendor + booking context for notify/revalidate
// ------------------------------------------------------------
async function loadWoContext(id: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id } });
  if (!wo) return null;
  const [vendor, booking] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: wo.vendorId }, select: { id: true, name: true, email: true } }),
    prisma.booking.findUnique({ where: { id: wo.bookingId }, select: { id: true, eventName: true, date: true, venue: { select: { name: true } } } }),
  ]);
  return { wo, vendor, booking };
}

// Atomic guarded transition: only flips when the row is still in `from`.
async function guardedTransition(id: string, from: WoStatus, data: Record<string, unknown>): Promise<boolean> {
  const res = await prisma.workOrder.updateMany({ where: { id, status: from }, data });
  return res.count === 1;
}

// ------------------------------------------------------------
// sendWorkOrder — DRAFT → SENT
// ------------------------------------------------------------
export async function sendWorkOrder(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const ctx = await loadWoContext(id);
  if (!ctx) return { success: false, error: "Work order not found" };
  if (ctx.wo.status !== "DRAFT") {
    return { success: false, error: `Only a draft work order can be sent (currently ${ctx.wo.status}).` };
  }

  const ok = await guardedTransition(id, "DRAFT", { status: "SENT", sentAt: new Date() });
  if (!ok) return { success: false, error: "Work order is no longer a draft — please refresh." };

  await notifySent(ctx);
  void logActivity({ userId: u.id, action: "status_changed", entityType: "WorkOrder", entityId: id, changes: { status: "SENT" } });
  revalidatePath(`/bookings/${ctx.wo.bookingId}`);
  return { success: true, data: { id } };
}

// Notify the linked vendor user (matched by vendor email) + all Operations Heads.
async function notifySent(ctx: NonNullable<Awaited<ReturnType<typeof loadWoContext>>>) {
  const { wo, vendor, booking } = ctx;
  const eventLabel = booking?.eventName ?? "an event";
  const title = `Work order ${wo.woNumber ?? ""} sent`.trim();
  const message = `${wo.serviceType} work order for ${eventLabel}${vendor?.name ? ` — ${vendor.name}` : ""}.`;
  const actionUrl = `/bookings/${wo.bookingId}`;

  // Vendor user, if their email maps to an app user account.
  if (vendor?.email) {
    const vendorUser = await prisma.user.findFirst({
      where: { email: vendor.email, isActive: true },
      select: { id: true },
    });
    if (vendorUser) {
      notify({ userId: vendorUser.id, type: "VENDOR_WORK_ORDER_SENT", title, message, actionUrl });
    }
  }

  // Operations Heads always get visibility on dispatch.
  const opsHeads = await prisma.user.findMany({
    where: { role: "OPERATIONS_HEAD", isActive: true },
    select: { id: true },
  });
  for (const o of opsHeads) {
    notify({ userId: o.id, type: "VENDOR_WORK_ORDER_SENT", title, message, actionUrl });
  }
}

// ------------------------------------------------------------
// acknowledgeWorkOrder — SENT → ACKNOWLEDGED
// ------------------------------------------------------------
export async function acknowledgeWorkOrder(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const wo = await prisma.workOrder.findUnique({ where: { id }, select: { status: true, bookingId: true } });
  if (!wo) return { success: false, error: "Work order not found" };
  if (wo.status !== "SENT") {
    return { success: false, error: `Only a sent work order can be acknowledged (currently ${wo.status}).` };
  }

  const ok = await guardedTransition(id, "SENT", { status: "ACKNOWLEDGED", acknowledgedAt: new Date() });
  if (!ok) return { success: false, error: "Work order state changed — please refresh." };

  void logActivity({ userId: u.id, action: "status_changed", entityType: "WorkOrder", entityId: id, changes: { status: "ACKNOWLEDGED" } });
  revalidatePath(`/bookings/${wo.bookingId}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// signWorkOrder — ACKNOWLEDGED → SIGNED
// ------------------------------------------------------------
export async function signWorkOrder(
  id: string,
  input: { signerName: string; signatureUrl?: string }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const signerName = input.signerName?.trim();
  if (!signerName) return { success: false, error: "A signer name is required" };

  let signatureUrl: string | null = null;
  if (input.signatureUrl?.trim()) {
    const url = input.signatureUrl.trim();
    if (!isSafeReceiptUrl(url)) {
      return { success: false, error: "Signature must be an https link or an image/PDF upload." };
    }
    signatureUrl = url;
  }

  const wo = await prisma.workOrder.findUnique({ where: { id }, select: { status: true, bookingId: true } });
  if (!wo) return { success: false, error: "Work order not found" };
  if (wo.status !== "ACKNOWLEDGED") {
    return { success: false, error: `Only an acknowledged work order can be signed (currently ${wo.status}).` };
  }

  const ok = await guardedTransition(id, "ACKNOWLEDGED", {
    status: "SIGNED",
    signedAt: new Date(),
    signerName,
    signatureUrl,
  });
  if (!ok) return { success: false, error: "Work order state changed — please refresh." };

  void logActivity({ userId: u.id, action: "status_changed", entityType: "WorkOrder", entityId: id, changes: { status: "SIGNED", signerName } });
  revalidatePath(`/bookings/${wo.bookingId}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// declineWorkOrder — SENT|ACKNOWLEDGED → DECLINED
// ------------------------------------------------------------
export async function declineWorkOrder(id: string, reason: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const trimmed = reason?.trim();
  if (!trimmed) return { success: false, error: "A decline reason is required" };

  const wo = await prisma.workOrder.findUnique({ where: { id }, select: { status: true, bookingId: true } });
  if (!wo) return { success: false, error: "Work order not found" };
  if (wo.status !== "SENT" && wo.status !== "ACKNOWLEDGED") {
    return { success: false, error: `Only a sent or acknowledged work order can be declined (currently ${wo.status}).` };
  }

  // Guarded on the current status so a concurrent transition can't be clobbered.
  const res = await prisma.workOrder.updateMany({
    where: { id, status: wo.status },
    data: { status: "DECLINED", declinedAt: new Date(), declineReason: trimmed },
  });
  if (res.count !== 1) return { success: false, error: "Work order state changed — please refresh." };

  void logActivity({ userId: u.id, action: "status_changed", entityType: "WorkOrder", entityId: id, changes: { status: "DECLINED", reason: trimmed } });
  revalidatePath(`/bookings/${wo.bookingId}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// releaseAdvance — only when SIGNED; stamp + notify FINANCE (no GL/payout)
// ------------------------------------------------------------
export async function releaseAdvance(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const ctx = await loadWoContext(id);
  if (!ctx) return { success: false, error: "Work order not found" };
  if (ctx.wo.status !== "SIGNED") {
    return { success: false, error: "Advance can only be released on a signed work order." };
  }
  if (ctx.wo.advanceReleasedAt) {
    return { success: false, error: "Advance has already been released." };
  }

  // Guard on both SIGNED status and not-yet-released so a double-tap can't
  // double-release (notify FINANCE only once).
  const res = await prisma.workOrder.updateMany({
    where: { id, status: "SIGNED", advanceReleasedAt: null },
    data: { advanceReleasedAt: new Date(), advanceReleasedById: u.id },
  });
  if (res.count !== 1) return { success: false, error: "Advance already released or state changed — please refresh." };

  const { wo, vendor, booking } = ctx;
  const amountStr = wo.advanceAmount != null ? `₹${Number(wo.advanceAmount).toLocaleString("en-IN")}` : "advance";
  const title = `Advance release requested — ${vendor?.name ?? "vendor"}`;
  const message = `${amountStr} on work order ${wo.woNumber ?? ""} for ${booking?.eventName ?? "an event"}. Finance to action the payout.`.trim();
  const actionUrl = `/bookings/${wo.bookingId}`;
  const financeUsers = await prisma.user.findMany({
    where: { role: "FINANCE", isActive: true },
    select: { id: true },
  });
  for (const f of financeUsers) {
    notify({
      userId: f.id,
      type: "ADVANCE_PAYMENT_RELEASED",
      title,
      message,
      actionUrl,
      metadata: { workOrderId: wo.id, vendorId: wo.vendorId, vendorName: vendor?.name ?? null, amount: wo.advanceAmount != null ? Number(wo.advanceAmount) : null },
    });
  }

  void logActivity({ userId: u.id, action: "updated", entityType: "WorkOrder", entityId: id, changes: { advanceReleased: true } });
  revalidatePath(`/bookings/${wo.bookingId}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// bulkSendWorkOrders — send every DRAFT WO for a booking
// ------------------------------------------------------------
export async function bulkSendWorkOrders(bookingId: string): Promise<Result<{ sent: number; failed: number }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };
  if (!bookingId) return { success: false, error: "A booking is required" };

  const drafts = await prisma.workOrder.findMany({
    where: { bookingId, status: "DRAFT" },
    select: { id: true },
  });
  if (drafts.length === 0) return { success: false, error: "No draft work orders to send." };

  const results = await Promise.allSettled(drafts.map((d) => sendWorkOrder(d.id)));
  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.success) sent++;
    else failed++;
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { success: true, data: { sent, failed } };
}
