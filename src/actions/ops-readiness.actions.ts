"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import {
  computeOperationReadiness,
  type OperationReadiness,
} from "@/lib/ops/state-machine";

// ============================================================
// Ops Readiness — thin, RBAC-gated read wrappers around
// computeOperationReadiness() from the ops state machine.
// Read-only; gated on "operations:read" (same family the
// operations page reads under).
// ============================================================

type ReadinessResult =
  | { success: true; data: OperationReadiness }
  | { success: false; error: string };

/**
 * Readiness checklist for a known EventOperation id.
 */
export async function getOperationReadiness(
  operationId: string
): Promise<ReadinessResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "operations:read")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const readiness = await computeOperationReadiness(operationId);
    if (!readiness) {
      return { success: false, error: "Operation not found" };
    }

    // No Date fields today, but serialize defensively in case the
    // readiness shape grows timestamps later.
    return { success: true, data: serialize(readiness) };
  } catch (error) {
    console.error("[GET_OPERATION_READINESS_ERROR]", error);
    return { success: false, error: "Failed to compute readiness" };
  }
}

/**
 * Readiness checklist resolved from a bookingId — looks up the
 * one-per-booking EventOperation, then delegates to the helper.
 */
export async function getOperationReadinessForBooking(
  bookingId: string
): Promise<ReadinessResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "operations:read")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const operation = await prisma.eventOperation.findUnique({
      where: { bookingId },
      select: { id: true },
    });
    if (!operation) {
      return { success: false, error: "No operation for this booking" };
    }

    const readiness = await computeOperationReadiness(operation.id);
    if (!readiness) {
      return { success: false, error: "Operation not found" };
    }

    return { success: true, data: serialize(readiness) };
  } catch (error) {
    console.error("[GET_OPERATION_READINESS_FOR_BOOKING_ERROR]", error);
    return { success: false, error: "Failed to compute readiness" };
  }
}
