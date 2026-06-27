"use server";

// ============================================================
// Event readiness sign-off — the enforced HUMAN gate before an event runs.
// ------------------------------------------------------------
// The system computes readiness, but a person must take responsibility that the
// event is good to go. Sign-off records WHO confirmed and WHEN. Recommended use:
// the Ops Head signs off ~24h before the event, once the required readiness
// gates pass. An operation cannot be flipped LIVE without a sign-off (enforced
// in operations.actions.ts updateOperation; SUPER_ADMIN may override).
//
// POLICY (default — adjust if your process differs): anyone with operations:update
// (Ops Head / Admin / SUPER_ADMIN) may sign off. Sign-off is allowed only when
// the required readiness gates pass, UNLESS the actor is SUPER_ADMIN (override
// with a recorded note).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { computeOperationReadiness } from "@/lib/ops/state-machine";
import { logActivity } from "@/lib/activity-logger";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

export interface SignOffState {
  signedOff: boolean;
  signedOffAt: string | null;
  signedOffByName: string | null;
  canSignOff: boolean; // required readiness gates pass (or actor is SUPER_ADMIN)
  canManage: boolean; // the viewer has permission to sign off / revoke
  blockingGates: string[];
}

/** Read the sign-off state + whether it's clear to sign off. */
export async function getEventSignOff(bookingId: string): Promise<Result<SignOffState>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(user.role ?? "", "operations:read"))
    return { success: false, error: "Insufficient permissions" };

  const op = await prisma.eventOperation.findUnique({
    where: { bookingId },
    select: { id: true, signedOffAt: true, signedOffBy: { select: { name: true } } },
  });
  if (!op) return { success: false, error: "No operation for this booking yet." };

  const readiness = await computeOperationReadiness(op.id);
  const blockingGates = readiness ? readiness.gates.filter((g) => g.required && !g.ready).map((g) => g.label) : [];
  const isSuper = user.role === "SUPER_ADMIN";

  return {
    success: true,
    data: {
      signedOff: !!op.signedOffAt,
      signedOffAt: op.signedOffAt ? op.signedOffAt.toISOString() : null,
      signedOffByName: op.signedOffBy?.name ?? null,
      canSignOff: isSuper || (readiness?.canGoLive ?? false),
      canManage: hasPermission(user.role ?? "", "operations:update"),
      blockingGates,
    },
  };
}

/** Record the human go-ahead. Blocked unless required gates pass (SUPER_ADMIN may override). */
export async function signOffEventReadiness(bookingId: string, note?: string): Promise<Result<{ signedOffAt: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(user.role ?? "", "operations:update"))
    return { success: false, error: "You don't have permission to sign off events." };

  const op = await prisma.eventOperation.findUnique({
    where: { bookingId },
    select: { id: true, signedOffAt: true },
  });
  if (!op) return { success: false, error: "No operation for this booking yet." };
  if (op.signedOffAt) return { success: false, error: "This event is already signed off." };

  const isSuper = user.role === "SUPER_ADMIN";
  if (!isSuper) {
    const readiness = await computeOperationReadiness(op.id);
    if (!readiness?.canGoLive) {
      const blocking = readiness ? readiness.gates.filter((g) => g.required && !g.ready).map((g) => g.label) : [];
      return { success: false, error: `Can't sign off — these must be ready first: ${blocking.join(", ") || "readiness incomplete"}.` };
    }
  }

  const now = new Date();
  await prisma.eventOperation.update({
    where: { id: op.id },
    data: { signedOffAt: now, signedOffById: user.id },
  });
  await logActivity({
    action: "EVENT_SIGNED_OFF",
    entityType: "EventOperation",
    entityId: op.id,
    userId: user.id,
    changes: { bookingId, override: isSuper, note: note?.slice(0, 500) ?? null },
  }).catch(() => {});

  revalidatePath(`/bookings/${bookingId}/operations`);
  revalidatePath(`/bookings/${bookingId}/control`);
  return { success: true, data: { signedOffAt: now.toISOString() } };
}

/** Revoke a prior sign-off (e.g. a gate regressed). */
export async function revokeEventSignOff(bookingId: string): Promise<Result<{ revoked: true }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(user.role ?? "", "operations:update"))
    return { success: false, error: "You don't have permission to change sign-off." };

  const op = await prisma.eventOperation.findUnique({ where: { bookingId }, select: { id: true } });
  if (!op) return { success: false, error: "No operation for this booking yet." };

  await prisma.eventOperation.update({ where: { id: op.id }, data: { signedOffAt: null, signedOffById: null } });
  await logActivity({
    action: "EVENT_SIGNOFF_REVOKED", entityType: "EventOperation", entityId: op.id, userId: user.id, changes: { bookingId },
  }).catch(() => {});
  revalidatePath(`/bookings/${bookingId}/operations`);
  return { success: true, data: { revoked: true } };
}
