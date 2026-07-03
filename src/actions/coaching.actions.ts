"use server";

// ============================================================
// 1:1 Coaching / check-in log — the manager↔report ritual that turns KRA /
// Velos / dashboard numbers into action (a win, the one focus, an agreed step,
// a follow-up). Additive; new CoachingNote table.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

// Who can log/coach: admins, HR, or any team head.
function canCoach(role: string | undefined | null): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  if (hasPermission(role, "hr:read")) return true;
  return role.endsWith("_HEAD");
}

export interface CoachingInput {
  subjectId: string;
  win?: string | null;
  focus?: string | null;
  actionItem?: string | null;
  rating?: number | null;
  followUpAt?: string | null; // yyyy-mm-dd
}

function currentPeriod(): string {
  // IST month scoping (fixed +5:30).
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ------------------------------------------------------------
// List a person's check-ins (visible to the person themselves or a coach)
// ------------------------------------------------------------
export async function getCoachingNotes(subjectId: string): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (user.id !== subjectId && !canCoach(user.role)) return { success: false, error: "Not authorized" };

  const notes = await prisma.coachingNote.findMany({
    where: { subjectId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { manager: { select: { name: true } } },
  });
  return { success: true, data: serialize(notes) as unknown[] };
}

// ------------------------------------------------------------
// Log a 1:1 / check-in
// ------------------------------------------------------------
export async function createCoachingNote(input: CoachingInput): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!canCoach(user.role)) return { success: false, error: "Only managers can log a 1:1." };
  if (!input.subjectId) return { success: false, error: "Missing team member." };

  const win = input.win?.trim() || null;
  const focus = input.focus?.trim() || null;
  const actionItem = input.actionItem?.trim() || null;
  if (!win && !focus && !actionItem) return { success: false, error: "Add at least a win, a focus, or an action." };

  const rating = input.rating != null && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : null;
  let followUpAt: Date | null = null;
  if (input.followUpAt) {
    const d = new Date(input.followUpAt);
    if (!Number.isNaN(d.getTime())) followUpAt = d;
  }

  const note = await prisma.coachingNote.create({
    data: {
      subjectId: input.subjectId, managerId: user.id, period: currentPeriod(),
      win, focus, actionItem, rating, followUpAt, status: "OPEN",
    },
    select: { id: true },
  });

  await logActivity({ userId: user.id, action: "coaching_logged", entityType: "User", entityId: input.subjectId }).catch(() => {});
  // Let the team member know their manager logged a check-in.
  if (input.subjectId !== user.id) {
    notify({
      userId: input.subjectId,
      type: "SYSTEM",
      title: "New 1:1 check-in",
      message: `${user.name ?? "Your manager"} logged a coaching check-in with you.`,
      actionUrl: `/performance/${input.subjectId}`,
    });
  }

  revalidatePath(`/performance/${input.subjectId}`);
  return { success: true, data: { id: note.id } };
}

// ------------------------------------------------------------
// Close out an action item
// ------------------------------------------------------------
export async function completeCoachingNote(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !canCoach(user.role)) return { success: false, error: "Not authorized" };
  const note = await prisma.coachingNote.findUnique({ where: { id }, select: { subjectId: true } });
  if (!note) return { success: false, error: "Not found" };
  await prisma.coachingNote.update({ where: { id }, data: { status: "DONE" } });
  revalidatePath(`/performance/${note.subjectId}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// A coach's own open follow-ups (for a "what I owe my team" surface)
// ------------------------------------------------------------
export async function getMyOpenFollowups(): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!canCoach(user.role)) return { success: true, data: [] };
  const notes = await prisma.coachingNote.findMany({
    where: { managerId: user.id, status: "OPEN", followUpAt: { not: null } },
    orderBy: { followUpAt: "asc" },
    take: 50,
    include: { subject: { select: { id: true, name: true } } },
  });
  return { success: true, data: serialize(notes) as unknown[] };
}

// Expose the coach-permission to the UI without leaking the rule.
export async function canCurrentUserCoach(): Promise<boolean> {
  const user = await requireUser();
  return !!user && canCoach(user.role);
}
