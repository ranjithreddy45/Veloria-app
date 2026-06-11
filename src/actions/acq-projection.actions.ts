"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { sendEmail } from "@/lib/email";
import { acqCan, acqHasAnyAccess } from "@/lib/acq/rbac";
import {
  computeProjection,
  validateProjectionInputs,
  type ProjectionModel,
  type ProjectionInputs,
} from "@/lib/acq/projection-calc";
import { Prisma } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string; code?: number };

// Default: a projection submitter cannot also approve it (needs a 2nd approver).
const REQUIRE_SECOND_APPROVER = true;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

function isAdmin(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// ------------------------------------------------------------
// List / get
// ------------------------------------------------------------
export async function getAcqProjections(dealId: string): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const rows = await prisma.acqProjection.findMany({
    where: { dealId },
    include: {
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      sentBy: { select: { name: true } },
    },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
  return { success: true, data: serialize(rows) as unknown[] };
}

export async function getAcqProjection(id: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const row = await prisma.acqProjection.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      sentBy: { select: { name: true } },
      transitions: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      deal: { select: { id: true, name: true, propertyName: true } },
    },
  });
  if (!row) return { success: false, error: "Projection not found" };
  return { success: true, data: serialize(row) };
}

// ------------------------------------------------------------
// Create draft
// ------------------------------------------------------------
export async function createAcqProjection(
  dealId: string,
  modelType: ProjectionModel,
  inputs: ProjectionInputs
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const deal = await prisma.acqDeal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };

  const errs = validateProjectionInputs(modelType, inputs);
  if (errs.length) return { success: false, error: errs.join(" ") };

  const last = await prisma.acqProjection.findFirst({
    where: { dealId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const row = await prisma.acqProjection.create({
    data: {
      dealId,
      version,
      modelType,
      status: "DRAFT",
      inputsJson: inputs as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  await prisma.acqProjectionTransition.create({
    data: { projectionId: row.id, fromStatus: null, toStatus: "DRAFT", actorId: user.id, note: `v${version} created` },
  });
  revalidatePath(`/bd/deals/${dealId}`);
  return { success: true, data: { id: row.id } };
}

// ------------------------------------------------------------
// Edit draft (DRAFT only)
// ------------------------------------------------------------
export async function updateAcqProjection(
  id: string,
  inputs: ProjectionInputs
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const row = await prisma.acqProjection.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Projection not found" };
  if (row.status !== "DRAFT") return { success: false, error: "Only a draft projection can be edited. Create a new version instead.", code: 409 };

  const errs = validateProjectionInputs(row.modelType, inputs);
  if (errs.length) return { success: false, error: errs.join(" ") };

  await prisma.acqProjection.update({
    where: { id },
    data: { inputsJson: inputs as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/bd/deals/${row.dealId}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Submit for approval (DRAFT -> PENDING_APPROVAL)
// ------------------------------------------------------------
export async function submitAcqProjection(id: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const row = await prisma.acqProjection.findUnique({ where: { id }, include: { deal: true } });
  if (!row) return { success: false, error: "Projection not found" };
  if (row.status !== "DRAFT") return { success: false, error: `Cannot submit from ${row.status}.`, code: 409 };

  const errs = validateProjectionInputs(row.modelType, row.inputsJson as unknown as ProjectionInputs);
  if (errs.length) return { success: false, error: errs.join(" ") };

  await prisma.$transaction([
    prisma.acqProjection.update({
      where: { id },
      data: { status: "PENDING_APPROVAL", submittedById: user.id, submittedAt: new Date(), rejectedReason: null },
    }),
    prisma.acqProjectionTransition.create({
      data: { projectionId: id, fromStatus: "DRAFT", toStatus: "PENDING_APPROVAL", actorId: user.id },
    }),
  ]);

  // Notify BD Heads + admins.
  const heads = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["BD_HEAD", "SUPER_ADMIN", "ADMIN"] } },
    select: { id: true },
  });
  for (const h of heads) {
    notify({
      userId: h.id,
      type: "SLA_WARNING",
      title: "Projection awaiting approval",
      message: `A 5-year projection for ${row.deal.propertyName} needs your approval.`,
      actionUrl: `/bd/deals/${row.dealId}`,
    });
  }
  revalidatePath(`/bd/deals/${row.dealId}`);
  return { success: true, data: { status: "PENDING_APPROVAL" } };
}

// ------------------------------------------------------------
// Approve (PENDING_APPROVAL -> APPROVED) — freezes the snapshot.
// ------------------------------------------------------------
export async function approveAcqProjection(id: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) {
    return { success: false, error: "Only BD Head / Admin can approve projections." };
  }
  const row = await prisma.acqProjection.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Projection not found" };
  if (row.status !== "PENDING_APPROVAL") return { success: false, error: `Cannot approve from ${row.status}.`, code: 409 };

  // A BD exec cannot approve their own; a BD Head needs a 2nd approver unless admin.
  if (row.submittedById === user.id && REQUIRE_SECOND_APPROVER && !isAdmin(user.role)) {
    return { success: false, error: "You submitted this projection — it needs a different BD Head or Admin to approve." };
  }

  // Freeze the snapshot: compute the full grid server-side from the stored inputs.
  const inputs = row.inputsJson as unknown as ProjectionInputs;
  const grid = computeProjection(row.modelType, inputs);

  await prisma.$transaction([
    prisma.acqProjection.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        outputsJson: grid as unknown as Prisma.InputJsonValue,
        pdfUrl: `/api/bd/projections/${id}/pdf`,
      },
    }),
    prisma.acqProjectionTransition.create({
      data: { projectionId: id, fromStatus: "PENDING_APPROVAL", toStatus: "APPROVED", actorId: user.id },
    }),
  ]);

  if (row.submittedById) {
    notify({
      userId: row.submittedById,
      type: "SYSTEM",
      title: "Projection approved",
      message: "Your 5-year projection was approved and is ready to send to the owner.",
      actionUrl: `/bd/deals/${row.dealId}`,
    });
  }
  revalidatePath(`/bd/deals/${row.dealId}`);
  return { success: true, data: { status: "APPROVED" } };
}

// ------------------------------------------------------------
// Reject (PENDING_APPROVAL -> DRAFT) with a required comment.
// ------------------------------------------------------------
export async function rejectAcqProjection(id: string, reason: string): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) {
    return { success: false, error: "Only BD Head / Admin can reject projections." };
  }
  if (!reason?.trim()) return { success: false, error: "A rejection comment is required." };
  const row = await prisma.acqProjection.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Projection not found" };
  if (row.status !== "PENDING_APPROVAL") return { success: false, error: `Cannot reject from ${row.status}.`, code: 409 };

  await prisma.$transaction([
    prisma.acqProjection.update({
      where: { id },
      data: { status: "DRAFT", rejectedReason: reason.trim() },
    }),
    prisma.acqProjectionTransition.create({
      data: { projectionId: id, fromStatus: "PENDING_APPROVAL", toStatus: "DRAFT", actorId: user.id, note: reason.trim() },
    }),
  ]);
  if (row.submittedById) {
    notify({
      userId: row.submittedById,
      type: "SYSTEM",
      title: "Projection returned for changes",
      message: `BD Head returned the projection: ${reason.trim()}`,
      actionUrl: `/bd/deals/${row.dealId}`,
    });
  }
  revalidatePath(`/bd/deals/${row.dealId}`);
  return { success: true, data: { status: "DRAFT" } };
}

// ------------------------------------------------------------
// Send (APPROVED -> SENT). Renders from the frozen snapshot.
// ------------------------------------------------------------
export async function sendAcqProjection(
  id: string,
  opts: {
    method: "EMAIL_APP" | "MANUAL_DOWNLOAD";
    channel?: string;
    to?: string;
    subject?: string;
    body?: string;
  }
): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const row = await prisma.acqProjection.findUnique({
    where: { id },
    include: { deal: { include: { lead: { select: { email: true, ownerName: true } } } } },
  });
  if (!row) return { success: false, error: "Projection not found" };
  if (row.status !== "APPROVED") return { success: false, error: "A projection can only be sent after it is approved.", code: 409 };

  const ownerEmail = opts.to?.trim() || row.deal.lead.email || "";
  if (opts.method === "EMAIL_APP" && !ownerEmail) {
    return { success: false, error: "No owner email on file — add one to the lead or enter a recipient." };
  }

  const pdfUrl = row.pdfUrl ?? `/api/bd/projections/${id}/pdf`;

  await prisma.$transaction([
    prisma.acqProjection.update({
      where: { id },
      data: {
        status: "SENT",
        sendMethod: opts.method,
        sentChannel: opts.channel || (opts.method === "EMAIL_APP" ? "email" : null),
        sentTo: opts.method === "EMAIL_APP" ? ownerEmail : opts.channel || null,
        sentById: user.id,
        sentAt: new Date(),
      },
    }),
    prisma.acqProjectionTransition.create({
      data: { projectionId: id, fromStatus: "APPROVED", toStatus: "SENT", actorId: user.id, note: opts.method },
    }),
    // Log to the deal's attachments (kind=PROJECTION) and timeline.
    prisma.acqAttachment.create({
      data: { dealId: row.dealId, kind: "PROJECTION", label: `Projection v${row.version}`, url: pdfUrl, uploadedById: user.id },
    }),
  ]);

  if (opts.method === "EMAIL_APP") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";
    const subject = opts.subject?.trim() || `5-Year Revenue Projection — ${row.deal.propertyName}`;
    const body =
      opts.body?.trim() ||
      `Dear ${row.deal.lead.ownerName || "Partner"},<br/><br/>Please find your indicative 5-year revenue projection for ${row.deal.propertyName} prepared by Veloria Grand.<br/><br/><a href="${appUrl}${pdfUrl}">View / download the projection (PDF)</a><br/><br/>Warm regards,<br/>Veloria Grand`;
    sendEmail({ to: ownerEmail, subject, html: body }).catch((e) =>
      console.error("[PROJECTION_EMAIL_ERROR]", e)
    );
  }

  logActivity({
    userId: user.id,
    action: "PROJECTION_SENT",
    entityType: "AcqProjection",
    entityId: id,
    changes: { method: opts.method, dealId: row.dealId },
  });
  revalidatePath(`/bd/deals/${row.dealId}`);
  return { success: true, data: { status: "SENT" } };
}

// ------------------------------------------------------------
// New version: clone an APPROVED/SENT projection into a fresh DRAFT.
// ------------------------------------------------------------
export async function newAcqProjectionVersion(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const row = await prisma.acqProjection.findUnique({ where: { id } });
  if (!row) return { success: false, error: "Projection not found" };
  if (row.status !== "APPROVED" && row.status !== "SENT") {
    return { success: false, error: "Only an approved or sent projection can be versioned." };
  }
  const last = await prisma.acqProjection.findFirst({
    where: { dealId: row.dealId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? row.version) + 1;
  const clone = await prisma.acqProjection.create({
    data: {
      dealId: row.dealId,
      version,
      modelType: row.modelType,
      status: "DRAFT",
      inputsJson: row.inputsJson as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  await prisma.acqProjectionTransition.create({
    data: { projectionId: clone.id, fromStatus: null, toStatus: "DRAFT", actorId: user.id, note: `v${version} from v${row.version}` },
  });
  revalidatePath(`/bd/deals/${row.dealId}`);
  return { success: true, data: { id: clone.id } };
}
