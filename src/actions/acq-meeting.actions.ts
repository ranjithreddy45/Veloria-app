"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { ensureDealProperty } from "@/lib/acq/conversion";
import { acqHasAnyAccess } from "@/lib/acq/rbac";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

// Which roles make up each delivery team for the cross-team intro meeting.
const TEAM_ROLES: Record<"design" | "projects" | "sales" | "operations", string[]> = {
  design: ["DESIGN_EXEC", "DESIGN_HEAD"],
  projects: ["PROJECTS_EXEC", "PROJECTS_HEAD"],
  sales: ["SALES_EXEC", "SALES_HEAD"],
  operations: ["OPERATIONS"],
};

// ------------------------------------------------------------
// Convert a signed deal into an onboarding project (idempotent)
// ------------------------------------------------------------
/**
 * Turn a won/signed deal into an AcqProperty + AcqOnboardingProject (with seed
 * tasks), reusing the same conversion logic as the WON transition. Idempotent:
 * if the property/project already exist they are returned as-is.
 *
 * Guard: only allowed once the deal's contract is signed — contractStatus SIGNED
 * or the deal has reached the WON / SIGNED stage.
 */
export async function convertDealToProject(
  dealId: string
): Promise<Result<{ projectId: string; propertyName: string }>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };

  const deal = await prisma.acqDeal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };

  const signed = deal.contractStatus === "SIGNED" || deal.stage === "WON" || deal.stage === "SIGNED";
  if (!signed) {
    return { success: false, error: "The contract must be signed (deal Won/Signed) before it can be converted to a project." };
  }

  const res = await prisma.$transaction((tx) => ensureDealProperty(tx, deal, user.id));

  revalidatePath(`/bd/deals/${dealId}`);
  revalidatePath("/bd/properties");
  revalidatePath(`/bd/properties/${res.propertyId}`);
  return { success: true, data: { projectId: res.projectId, propertyName: res.propertyName } };
}

// ------------------------------------------------------------
// Introduction meetings
// ------------------------------------------------------------
export interface ScheduleIntroductionMeetingInput {
  dealId?: string;
  projectId?: string;
  propertyName: string;
  scheduledAt: string;
  location?: string;
  agenda?: string;
  teams: { design: boolean; projects: boolean; sales: boolean; operations: boolean };
  attendeeIds?: string[];
}

export async function scheduleIntroductionMeeting(
  input: ScheduleIntroductionMeetingInput
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };

  const propertyName = (input.propertyName ?? "").trim();
  if (!propertyName) return { success: false, error: "Property name is required." };

  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) return { success: false, error: "Enter a valid meeting date/time." };

  const teams = input.teams ?? { design: false, projects: false, sales: false, operations: false };
  const attendeeIds = Array.from(new Set((input.attendeeIds ?? []).filter(Boolean)));

  const meeting = await prisma.introductionMeeting.create({
    data: {
      dealId: input.dealId || null,
      projectId: input.projectId || null,
      propertyName,
      scheduledAt,
      location: input.location?.trim() || null,
      agenda: input.agenda?.trim() || null,
      status: "SCHEDULED",
      teamDesign: !!teams.design,
      teamProjects: !!teams.projects,
      teamSales: !!teams.sales,
      teamOperations: !!teams.operations,
      attendeeIds,
      scheduledById: user.id,
    },
    select: { id: true },
  });

  // Action link → the deal or project this meeting is about.
  const actionUrl = input.dealId
    ? `/bd/deals/${input.dealId}`
    : input.projectId
      ? `/bd/properties/${input.projectId}`
      : "/bd/dashboard";

  // Gather every recipient: the selected teams' active users + explicit attendees.
  const selectedRoles: string[] = [];
  (Object.keys(TEAM_ROLES) as (keyof typeof TEAM_ROLES)[]).forEach((team) => {
    if (teams[team]) selectedRoles.push(...TEAM_ROLES[team]);
  });

  const recipientIds = new Set<string>(attendeeIds);
  if (selectedRoles.length > 0) {
    const teamUsers = await prisma.user.findMany({
      where: { isActive: true, role: { in: selectedRoles as never } },
      select: { id: true },
    });
    for (const u of teamUsers) recipientIds.add(u.id);
  }

  const when = scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  for (const userId of recipientIds) {
    notify({
      userId,
      type: "TASK_ASSIGNED",
      title: "Property introduction meeting",
      message: `${propertyName} — intro meeting scheduled for ${when}${input.location ? ` at ${input.location}` : ""}.`,
      actionUrl,
    });
  }

  if (input.dealId) revalidatePath(`/bd/deals/${input.dealId}`);
  if (input.projectId) revalidatePath(`/bd/properties/${input.projectId}`);
  return { success: true, data: { id: meeting.id } };
}

export async function getIntroductionMeetings(
  args: { dealId?: string; projectId?: string }
): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };

  const where: Record<string, unknown> = {};
  if (args.dealId) where.dealId = args.dealId;
  if (args.projectId) where.projectId = args.projectId;

  const meetings = await prisma.introductionMeeting.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    take: 200,
  });
  return { success: true, data: serialize(meetings) as unknown[] };
}

const MEETING_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "RESCHEDULED"];

export async function updateIntroductionMeeting(
  id: string,
  patch: { status?: string; scheduledAt?: string; location?: string; agenda?: string }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };

  const meeting = await prisma.introductionMeeting.findUnique({ where: { id } });
  if (!meeting) return { success: false, error: "Meeting not found" };

  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    if (!MEETING_STATUSES.includes(patch.status)) return { success: false, error: "Invalid status." };
    data.status = patch.status;
  }
  if (patch.scheduledAt !== undefined) {
    const next = new Date(patch.scheduledAt);
    if (Number.isNaN(next.getTime())) return { success: false, error: "Enter a valid meeting date/time." };
    data.scheduledAt = next;
  }
  if (patch.location !== undefined) data.location = patch.location.trim() || null;
  if (patch.agenda !== undefined) data.agenda = patch.agenda.trim() || null;

  await prisma.introductionMeeting.update({ where: { id }, data });

  if (meeting.dealId) revalidatePath(`/bd/deals/${meeting.dealId}`);
  if (meeting.projectId) revalidatePath(`/bd/properties/${meeting.projectId}`);
  return { success: true, data: { id } };
}
