"use server";

// ============================================================
// Vendor Assignment Lifecycle — INTERNAL (RBAC-gated) actions.
// ------------------------------------------------------------
// The provisioning engine (src/lib/ops/provision.ts) creates one
// OperationVendorAssignment per booking-vendor (status NOTIFIED + an unguessable
// respondToken) when a booking is confirmed. These actions let ops staff TRACK
// and DRIVE the confirm/decline/remind lifecycle from the operation detail page,
// alongside the vendor's own self-service flow on /vendor-confirm/<token>.
//
// Every status write is routed through assertTransition("vendorAssignment", …)
// so the lifecycle (NOTIFIED→CONFIRMED/DECLINED, plus the few intentional
// reversals) stays uniform with the rest of the event-ops state machine.
//
// Gated on "operations:update" (the existing ops-mutation permission used by
// operations.actions.ts) — read on "operations:read".
// ============================================================

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { assertTransition } from "@/lib/ops/state-machine";
import { sendVendorAssignmentNotification } from "@/lib/ops/vendor-reminders";

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ------------------------------------------------------------
// List the assignments for one operation (with vendor + booking context).
// ------------------------------------------------------------
export async function getVendorAssignmentsForOperation(operationId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "operations:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const rows = await prisma.operationVendorAssignment.findMany({
      where: { operationId },
      orderBy: { createdAt: "asc" },
      include: {
        bookingVendor: {
          include: {
            vendor: {
              select: { id: true, name: true, category: true, phone: true, email: true },
            },
            booking: {
              select: { id: true, eventName: true, date: true, timeSlot: true },
            },
          },
        },
      },
    });

    return { success: true as const, data: serialize(rows) };
  } catch (error) {
    console.error("[GET_VENDOR_ASSIGNMENTS_ERROR]", error);
    return { success: false as const, error: "Failed to load vendor assignments" };
  }
}

// ------------------------------------------------------------
// Shared loader + RBAC + transition guard for the mutating actions.
// ------------------------------------------------------------
async function loadForTransition(
  id: string,
  to: "CONFIRMED" | "DECLINED"
): Promise<
  | { ok: true; row: { id: string; status: string; operationId: string } }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "operations:update")) {
    return { ok: false, error: "Insufficient permissions" };
  }

  const row = await prisma.operationVendorAssignment.findUnique({
    where: { id },
    select: { id: true, status: true, operationId: true },
  });
  if (!row) return { ok: false, error: "Vendor assignment not found" };

  const check = assertTransition("vendorAssignment", row.status, to);
  if (!check.ok) return { ok: false, error: check.error ?? "Invalid status change" };

  return { ok: true, row };
}

async function revalidateOperationByBooking(operationId: string) {
  const op = await prisma.eventOperation
    .findUnique({ where: { id: operationId }, select: { bookingId: true } })
    .catch(() => null);
  if (op?.bookingId) {
    revalidatePath(`/bookings/${op.bookingId}`);
    revalidatePath(`/operations/${op.bookingId}`);
  }
}

// ------------------------------------------------------------
// Confirm — NOTIFIED→CONFIRMED (or DECLINED→CONFIRMED reversal). Stamps confirmedAt.
// ------------------------------------------------------------
export async function confirmVendorAssignment(id: string): Promise<Result<unknown>> {
  try {
    const loaded = await loadForTransition(id, "CONFIRMED");
    if (!loaded.ok) return { success: false, error: loaded.error };

    const updated = await prisma.operationVendorAssignment.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date(), declinedAt: null },
    });

    await revalidateOperationByBooking(loaded.row.operationId);
    return { success: true, data: serialize(updated) };
  } catch (error) {
    console.error("[CONFIRM_VENDOR_ASSIGNMENT_ERROR]", error);
    return { success: false, error: "Failed to confirm vendor assignment" };
  }
}

// ------------------------------------------------------------
// Decline — NOTIFIED→DECLINED (or CONFIRMED→DECLINED reversal). Stamps declinedAt
// and records the reason in notes (best-effort, appended).
// ------------------------------------------------------------
export async function declineVendorAssignment(
  id: string,
  reason?: string
): Promise<Result<unknown>> {
  try {
    const loaded = await loadForTransition(id, "DECLINED");
    if (!loaded.ok) return { success: false, error: loaded.error };

    const trimmed = (reason ?? "").trim().slice(0, 500);

    const updated = await prisma.operationVendorAssignment.update({
      where: { id },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
        confirmedAt: null,
        ...(trimmed ? { notes: `Declined: ${trimmed}` } : {}),
      },
    });

    await revalidateOperationByBooking(loaded.row.operationId);
    return { success: true, data: serialize(updated) };
  } catch (error) {
    console.error("[DECLINE_VENDOR_ASSIGNMENT_ERROR]", error);
    return { success: false, error: "Failed to decline vendor assignment" };
  }
}

// ------------------------------------------------------------
// Remind — re-send the vendor their /vendor-confirm/<token> link, stamp
// remindedAt. Only meaningful while still NOTIFIED. Best-effort send.
// ------------------------------------------------------------
export async function remindVendorAssignment(id: string): Promise<Result<{ sent: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role, "operations:update")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const row = await prisma.operationVendorAssignment.findUnique({
      where: { id },
      select: { id: true, status: true, operationId: true },
    });
    if (!row) return { success: false, error: "Vendor assignment not found" };
    if (row.status !== "NOTIFIED") {
      return { success: false, error: "This vendor has already responded." };
    }

    const sent = await sendVendorAssignmentNotification(id);
    await prisma.operationVendorAssignment
      .update({ where: { id }, data: { remindedAt: new Date() } })
      .catch(() => {});

    await revalidateOperationByBooking(row.operationId);
    return { success: true, data: { sent } };
  } catch (error) {
    console.error("[REMIND_VENDOR_ASSIGNMENT_ERROR]", error);
    return { success: false, error: "Failed to send reminder" };
  }
}
