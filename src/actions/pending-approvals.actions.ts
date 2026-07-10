"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Pending-approvals count — how many items are awaiting THIS user's action.
//
// Self-scoped and permission-aware: every source count reuses the exact same
// scoping rules as the queue action it mirrors, so a user never sees a count of
// records they couldn't open:
//   - leave           → getLeaveApprovalQueue   (hr:approve sees all PENDING;
//                        otherwise only requests routed to their employee id)
//   - regularizations → getRegularizationQueue  (same rule)
//   - flagged         → getFlaggedPunches        (gated on hr:read)
//
// A user with no HR permissions and no reports simply counts zero everywhere —
// this returns zeros, never an error.
// ============================================================

export interface PendingApprovalsCount {
  total: number;
  breakdown: {
    leave: number;
    regularizations: number;
    flagged: number;
  };
}

const ZERO: PendingApprovalsCount = {
  total: 0,
  breakdown: { leave: 0, regularizations: 0, flagged: 0 },
};

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

/** Count only items the CALLER can actually action. Returns zeros, never throws. */
export async function getMyPendingApprovalsCount(): Promise<PendingApprovalsCount> {
  const u = await requireUser();
  if (!u?.id) return ZERO;

  const isHrApprover = can(u.role, "hr:approve");
  const canReadHr = can(u.role, "hr:read");

  // Their linked employee id — needed to scope manager-routed approvals. A user
  // with no employee record and no hr:approve is not an approver for anything.
  const me = await prisma.employee.findFirst({
    where: { userId: u.id, deletedAt: null },
    select: { id: true },
  });

  // Fast path: no approver permission, no reports routed to them, no hr:read →
  // nothing this user could ever action. Skip all queries.
  if (!isHrApprover && !me && !canReadHr) return ZERO;

  // Mirror getLeaveApprovalQueue / getRegularizationQueue scoping exactly.
  const leaveWhere: Prisma.LeaveRequestWhereInput = isHrApprover
    ? { status: "PENDING" }
    : me
      ? { status: "PENDING", approverId: me.id }
      : { id: "__none__" };

  const regWhere: Prisma.RegularizationWhereInput = isHrApprover
    ? { status: "PENDING" }
    : me
      ? { status: "PENDING", approverId: me.id }
      : { id: "__none__" };

  try {
    const [leave, regularizations, flagged] = await Promise.all([
      // Only count leave/reg if the user is an approver (hr:approve) or has a
      // routed employee id — otherwise the where resolves to the __none__ guard.
      isHrApprover || me
        ? prisma.leaveRequest.count({ where: leaveWhere })
        : Promise.resolve(0),
      isHrApprover || me
        ? prisma.regularization.count({ where: regWhere })
        : Promise.resolve(0),
      // Flagged punches are HR-only, gated on hr:read — same as getFlaggedPunches.
      canReadHr
        ? prisma.attendanceRecord.count({
            where: { flagged: true, flagClearedAt: null },
          })
        : Promise.resolve(0),
    ]);

    return {
      total: leave + regularizations + flagged,
      breakdown: { leave, regularizations, flagged },
    };
  } catch {
    // Never surface an error into the header chrome — degrade to zero.
    return ZERO;
  }
}
