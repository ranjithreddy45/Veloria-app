"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { acqCan, acqHasAnyAccess } from "@/lib/acq/rbac";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { notify } from "@/lib/notify";
import { sendForSignature } from "@/lib/acq/esign";
import { z } from "zod";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Escape owner-controlled fields before embedding in outbound HTML email/WhatsApp.
function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

async function logActivity(
  contractId: string,
  actorId: string,
  type: string,
  detail?: string
) {
  await prisma.acqContractActivity.create({
    data: { contractId, actorId, type, detail: detail ?? null },
  });
}

// ------------------------------------------------------------
// List + dashboard stats
// ------------------------------------------------------------
export async function getAcqContracts(): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const rows = await prisma.acqContract.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return { success: true, data: serialize(rows) as unknown[] };
}

export interface ContractStats {
  byStatus: Record<string, number>;
  upcomingValue: number; // not-yet-active (draft/approved/negotiated/signed)
  activeValue: number;
  terminatedGainLoss: number;
  upcomingSignings: { id: string; title: string; signByDate: string }[];
  activityByType: Record<string, number>;
}

export async function getAcqContractStats(): Promise<Result<ContractStats>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };

  const contracts = await prisma.acqContract.findMany({
    where: { deletedAt: null },
    select: {
      id: true, title: true, status: true, contractValue: true,
      terminationGainLoss: true, signByDate: true,
    },
  });

  const byStatus: Record<string, number> = {};
  let upcomingValue = 0;
  let activeValue = 0;
  let terminatedGainLoss = 0;
  const upcomingSignings: ContractStats["upcomingSignings"] = [];

  for (const c of contracts) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    const val = c.contractValue ? Number(c.contractValue) : 0;
    if (c.status === "ACTIVE") activeValue += val;
    else if (c.status !== "TERMINATED") upcomingValue += val;
    if (c.status === "TERMINATED") terminatedGainLoss += c.terminationGainLoss ? Number(c.terminationGainLoss) : 0;
    if (c.signByDate && c.status !== "ACTIVE" && c.status !== "TERMINATED") {
      upcomingSignings.push({ id: c.id, title: c.title, signByDate: c.signByDate.toISOString() });
    }
  }
  upcomingSignings.sort((a, b) => a.signByDate.localeCompare(b.signByDate));

  // Activity by type over the last 90 days.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const acts = await prisma.acqContractActivity.groupBy({
    by: ["type"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const activityByType: Record<string, number> = {};
  for (const a of acts) activityByType[a.type] = a._count._all;

  return {
    success: true,
    data: { byStatus, upcomingValue, activeValue, terminatedGainLoss, upcomingSignings, activityByType },
  };
}

export async function getAcqContract(id: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const c = await prisma.acqContract.findFirst({
    where: { id, deletedAt: null },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
      versions: { orderBy: { version: "desc" }, take: 50 },
    },
  });
  if (!c) return { success: false, error: "Contract not found" };
  // Resolve actor names for the activity feed.
  const actorIds = Array.from(new Set(c.activities.map((a) => a.actorId)));
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const nameById = new Map(actors.map((a) => [a.id, a.name]));
  const withNames = {
    ...c,
    activities: c.activities.map((a) => ({ ...a, actorName: nameById.get(a.actorId) ?? null })),
  };
  return { success: true, data: serialize(withNames) };
}

// ------------------------------------------------------------
// Create — from an agreed deal (auto-populate) OR a manual form
// ------------------------------------------------------------
const createSchema = z.object({
  dealId: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  ownerName: z.string().max(200).optional(),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  ownerPhone: z.string().max(20).optional(),
  propertyName: z.string().max(200).optional(),
  contractValue: z.number().nonnegative().optional(),
  signByDate: z.string().optional(),
  body: z.string().max(20000).optional(),
});
export type AcqContractCreateInput = z.infer<typeof createSchema>;

export async function createAcqContract(
  input: AcqContractCreateInput
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Validation failed" };
  const d = parsed.data;

  // Auto-populate from the deal when create-from-deal.
  let dealDefaults: Record<string, unknown> = {};
  if (d.dealId) {
    const deal = await prisma.acqDeal.findFirst({ where: { id: d.dealId, deletedAt: null } });
    if (!deal) return { success: false, error: "Source deal not found" };
    dealDefaults = {
      ownerName: deal.ownerName,
      propertyName: deal.propertyName,
      model: deal.model,
      baseFeePct: deal.baseFeePct,
      incentivePct: deal.incentivePct,
      termYears: deal.termYears,
      contractValue: deal.projectedFeeValue,
      bdExecutiveId: deal.bdExecutiveId,
    };
  }

  const ownerName = d.ownerName || (dealDefaults.ownerName as string) || "Owner";
  const propertyName = d.propertyName || (dealDefaults.propertyName as string) || "Property";

  // Sequential contract number: VG-CON-YYYY-NNN (year-scoped count).
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const countThisYear = await prisma.acqContract.count({ where: { createdAt: { gte: yearStart } } });
  const contractNumber = `VG-CON-${year}-${String(countThisYear + 1).padStart(3, "0")}`;

  const contract = await prisma.acqContract.create({
    data: {
      contractNumber,
      title: d.title || `Management Agreement — ${propertyName}`,
      dealId: d.dealId || null,
      ownerName,
      ownerEmail: d.ownerEmail || null,
      ownerPhone: d.ownerPhone || null,
      propertyName,
      model: (dealDefaults.model as string) ?? null,
      baseFeePct: (dealDefaults.baseFeePct as never) ?? null,
      incentivePct: (dealDefaults.incentivePct as never) ?? null,
      termYears: (dealDefaults.termYears as number) ?? null,
      contractValue:
        d.contractValue != null ? d.contractValue : ((dealDefaults.contractValue as never) ?? null),
      body: d.body || null,
      signByDate: d.signByDate ? new Date(d.signByDate) : null,
      bdExecutiveId: (dealDefaults.bdExecutiveId as string) || user.id,
      createdById: user.id,
      phase: "AUTHORING",
      status: "DRAFT",
    },
    select: { id: true },
  });
  await logActivity(contract.id, user.id, "AUTHORED", "Contract created");
  revalidatePath("/bd/contracts");
  return { success: true, data: { id: contract.id } };
}

export async function updateAcqContract(
  id: string,
  patch: Partial<{ title: string; ownerEmail: string; ownerPhone: string; contractValue: number | null; signByDate: string | null; body: string }>
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.ownerEmail !== undefined) data.ownerEmail = patch.ownerEmail || null;
  if (patch.ownerPhone !== undefined) data.ownerPhone = patch.ownerPhone || null;
  if (patch.contractValue !== undefined) data.contractValue = patch.contractValue;
  if (patch.signByDate !== undefined) data.signByDate = patch.signByDate ? new Date(patch.signByDate) : null;
  if (patch.body !== undefined) data.body = patch.body || null;
  await prisma.acqContract.update({ where: { id }, data });

  // Snapshot the body as a new version whenever it changes (version history).
  if (patch.body !== undefined && (patch.body ?? "").trim() && patch.body !== c.body) {
    const count = await prisma.acqContractVersion.count({ where: { contractId: id } });
    await prisma.acqContractVersion.create({
      data: { contractId: id, version: count + 1, body: patch.body, createdById: user.id },
    });
  }
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id } };
}

export async function restoreAcqContractVersion(
  contractId: string,
  versionId: string
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const v = await prisma.acqContractVersion.findFirst({ where: { id: versionId, contractId } });
  if (!v) return { success: false, error: "Version not found" };
  // Restoring writes the old body back, which itself snapshots as a new version.
  await prisma.acqContract.update({ where: { id: contractId }, data: { body: v.body } });
  const count = await prisma.acqContractVersion.count({ where: { contractId } });
  await prisma.acqContractVersion.create({
    data: { contractId, version: count + 1, body: v.body, createdById: user.id },
  });
  await logActivity(contractId, user.id, "NOTE", `Restored version ${v.version}`);
  revalidatePath(`/bd/contracts/${contractId}`);
  return { success: true, data: { id: contractId } };
}

// ------------------------------------------------------------
// Lifecycle — phase + status moves (with activity log)
// ------------------------------------------------------------
// Ordered lifecycle. Forward progression must go one step at a time and clear
// the same governance gates as the dedicated lifecycle actions — the free-form
// "Move phase" control must NOT let a draft jump straight to Execution and
// retroactively green-check Approval/Negotiation (audit O-3).
const CONTRACT_PHASE_ORDER = ["AUTHORING", "APPROVAL", "NEGOTIATION", "EXECUTION", "POST_EXECUTION"] as const;
type ContractPhase = (typeof CONTRACT_PHASE_ORDER)[number];

export async function setAcqContractPhase(
  id: string,
  phase: ContractPhase
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "deal:transition")) return { success: false, error: "Unauthorized" };
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };

  const from = CONTRACT_PHASE_ORDER.indexOf(c.phase as ContractPhase);
  const to = CONTRACT_PHASE_ORDER.indexOf(phase);
  if (to < 0) return { success: false, error: "Invalid phase." };
  if (to === from) return { success: true, data: { id } }; // no-op

  if (to < from) {
    // Backward moves are corrections — restricted to a BD Head / manager.
    if (!acqCan(user.role, "bdhead:approve")) {
      return { success: false, error: "Only a BD Head / manager can roll a contract back to an earlier phase." };
    }
  } else {
    // No skipping: one step forward at a time, via the lifecycle gates.
    if (to - from > 1) {
      return { success: false, error: "Phases can't be skipped — move it forward one step at a time (Submit → Approve → Send → Sign)." };
    }
    // A contract can't reach owner-facing negotiation or execution until a BD
    // Head has approved it (which is also where the below-floor sign-off lives).
    if ((phase === "NEGOTIATION" || phase === "EXECUTION") && c.status !== "APPROVED" && c.status !== "NEGOTIATED") {
      return { success: false, error: "The contract must be approved by a BD Head before it can move to that phase." };
    }
    if (phase === "POST_EXECUTION" && c.status !== "SIGNED") {
      return { success: false, error: "Mark the contract signed before moving it to post-execution." };
    }
  }

  await prisma.acqContract.update({ where: { id }, data: { phase } });
  await logActivity(id, user.id, "PHASE_CHANGE", `Phase → ${phase}`);
  revalidatePath(`/bd/contracts/${id}`);
  revalidatePath("/bd/contracts");
  return { success: true, data: { id } };
}

async function notifyManagers(title: string, message: string, actionUrl: string, alsoUserId?: string) {
  const recipients = await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: { in: ["SUPER_ADMIN", "ADMIN", "BD_HEAD"] } }, ...(alsoUserId ? [{ id: alsoUserId }] : [])] },
    select: { id: true },
  });
  for (const r of recipients) notify({ userId: r.id, type: "SYSTEM", title, message, actionUrl });
}

// Submit a draft for manager approval (routes it to BD Heads).
export async function submitContractForApproval(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  if (c.status !== "DRAFT") return { success: false, error: "Only a draft can be submitted for approval." };
  await prisma.acqContract.update({ where: { id }, data: { phase: "APPROVAL" } });
  await logActivity(id, user.id, "NOTE", "Submitted for approval");
  await notifyManagers("Contract awaiting approval", `${c.propertyName} — ${c.title}`, `/bd/contracts/${id}`);
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id } };
}

// Reject — sends it back to authoring with a reason; notifies the author.
export async function rejectAcqContract(id: string, reason: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) {
    return { success: false, error: "Only a BD Head / manager can reject a contract." };
  }
  if (!reason.trim()) return { success: false, error: "A reason is required." };
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  await prisma.acqContract.update({ where: { id }, data: { status: "DRAFT", phase: "AUTHORING" } });
  await logActivity(id, user.id, "NOTE", `Rejected: ${reason.trim()}`);
  notify({ userId: c.createdById, type: "SYSTEM", title: "Contract changes requested", message: `${c.propertyName}: ${reason.trim().slice(0, 120)}`, actionUrl: `/bd/contracts/${id}` });
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id } };
}

// Send the approved contract document to the owner (email and/or WhatsApp).
export async function sendAcqContractToOwner(
  id: string,
  channel: "EMAIL" | "WHATSAPP"
): Promise<Result<{ sent: boolean }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "deal:transition")) return { success: false, error: "Unauthorized" };
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  if (c.status !== "APPROVED" && c.status !== "NEGOTIATED")
    return { success: false, error: "A contract can only be sent to the owner while it is approved or under negotiation." };

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";
  const link = `${base}/api/bd/contracts/${id}/pdf`;
  let sent = false;

  if (channel === "EMAIL") {
    if (!c.ownerEmail) return { success: false, error: "No owner email on file." };
    const r = await sendEmail({
      to: c.ownerEmail,
      subject: `Your Veloria Grand agreement — ${c.propertyName}`,
      html: `<p>Dear ${esc(c.ownerName)},</p><p>Please find your management agreement for <strong>${esc(c.propertyName)}</strong> here:</p><p><a href="${link}">View / download the agreement</a></p><p>Kindly review and let us know if you have any questions.</p><p>— Team Veloria Grand</p>`,
    });
    sent = !!r.success;
  } else {
    if (!c.ownerPhone) return { success: false, error: "No owner phone on file." };
    const r = await sendWhatsApp({
      to: c.ownerPhone,
      message: `Hi ${c.ownerName}, your Veloria Grand management agreement for ${c.propertyName} is ready: ${link}`,
    });
    sent = !!r.success;
  }

  await logActivity(id, user.id, "SENT_FOR_SIGN", `Sent to owner via ${channel.toLowerCase()}`);
  await prisma.acqContract.update({ where: { id }, data: { phase: "NEGOTIATION" } });
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { sent } };
}

// Approval — BD Head/manager approves before it goes to the owner.
export async function approveAcqContract(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) {
    return { success: false, error: "Only a BD Head / manager can approve a contract." };
  }
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  await prisma.acqContract.update({
    where: { id },
    data: { status: "APPROVED", phase: "APPROVAL", approvedById: user.id, approvedAt: new Date() },
  });
  await logActivity(id, user.id, "APPROVED", "Approved by manager");
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id } };
}

// Send for e-signature — must be approved first.
export async function sendAcqContractForEsign(id: string): Promise<Result<{ configured: boolean }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "deal:transition")) return { success: false, error: "Unauthorized" };
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  if (c.status !== "APPROVED" && c.status !== "NEGOTIATED")
    return { success: false, error: "A contract can only be sent for signature while it is approved or under negotiation." };

  const doc = await prisma.acqContractDocument.findFirst({ where: { contractId: id }, orderBy: { createdAt: "desc" } });
  const res = await sendForSignature({
    contractId: id,
    title: c.title,
    signerName: c.ownerName,
    signerEmail: c.ownerEmail,
    signerPhone: c.ownerPhone,
    documentUrl: doc?.url ?? null,
  });

  await prisma.acqContract.update({
    where: { id },
    data: {
      phase: "EXECUTION",
      esignProvider: res.provider ?? null,
      esignRequestId: res.requestId ?? null,
      esignStatus: res.success ? "SENT" : null,
    },
  });
  await logActivity(id, user.id, "SENT_FOR_SIGN", res.configured ? `Sent via ${res.provider}` : "Pending e-sign setup (manual signing)");
  revalidatePath(`/bd/contracts/${id}`);
  // If not configured, surface the hint but don't fail the flow.
  if (!res.configured) return { success: true, data: { configured: false } };
  return { success: true, data: { configured: true } };
}

// Mark signed (manual upload OR e-sign callback) → notify stakeholders.
export async function markAcqContractSignedCLM(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "deal:transition")) return { success: false, error: "Unauthorized" };
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  // Can't jump DRAFT→SIGNED and bypass approval; must be approved/sent first.
  if (c.status !== "APPROVED" && c.status !== "NEGOTIATED")
    return { success: false, error: "Get manager approval and send the contract before marking it signed." };
  await prisma.acqContract.update({
    where: { id },
    data: { status: "SIGNED", phase: "POST_EXECUTION", signedAt: new Date(), esignStatus: "SIGNED" },
  });
  await logActivity(id, user.id, "SIGNED", "Contract signed");

  // Post-signing notifications: owner + BD Head + manager + management.
  await postSigningNotify(c.id, c.title, c.propertyName, c.ownerEmail, c.bdExecutiveId);
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id } };
}

async function postSigningNotify(
  contractId: string,
  title: string,
  propertyName: string,
  ownerEmail: string | null,
  bdExecutiveId: string
) {
  try {
    const internal = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [{ role: { in: ["SUPER_ADMIN", "ADMIN", "BD_HEAD"] } }, { id: bdExecutiveId }],
      },
      select: { id: true, email: true },
    });
    const subject = `Contract signed — ${propertyName}`;
    const html = `<p>The contract <strong>${esc(title)}</strong> for <strong>${esc(propertyName)}</strong> has been signed.</p>`;
    for (const u of internal) {
      notify({ userId: u.id, type: "SYSTEM", title: "Contract signed", message: `${propertyName} — ${title}`, actionUrl: `/bd/contracts/${contractId}` });
      if (u.email) sendEmail({ to: u.email, subject, html }).catch(() => {});
    }
    if (ownerEmail) {
      sendEmail({
        to: ownerEmail,
        subject: `Welcome to Veloria Grand — ${propertyName}`,
        html: `<p>Thank you! Your management agreement for <strong>${esc(propertyName)}</strong> is now signed. Our team will be in touch with next steps.</p>`,
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[postSigningNotify] error:", e);
  }
}

// Activate (start of operations) and Terminate (with gain/loss).
export async function activateAcqContract(
  id: string,
  startDate?: string,
  endDate?: string
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "deal:transition")) return { success: false, error: "Unauthorized" };
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  if (c.status !== "SIGNED") return { success: false, error: "Sign the contract before activating." };
  await prisma.acqContract.update({
    where: { id },
    data: { status: "ACTIVE", startDate: startDate ? new Date(startDate) : new Date(), endDate: endDate ? new Date(endDate) : null },
  });
  await logActivity(id, user.id, "ACTIVATED", "Contract activated");
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id } };
}

export async function terminateAcqContract(
  id: string,
  gainLoss: number,
  reason?: string
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) {
    return { success: false, error: "Only a BD Head / manager can terminate a contract." };
  }
  const c = await prisma.acqContract.findFirst({ where: { id, deletedAt: null } });
  if (!c) return { success: false, error: "Contract not found" };
  if (c.status !== "ACTIVE")
    return { success: false, error: "Only an active contract can be terminated." };
  await prisma.acqContract.update({
    where: { id },
    data: { status: "TERMINATED", terminatedAt: new Date(), terminationGainLoss: gainLoss },
  });
  await logActivity(id, user.id, "TERMINATED", reason || `Terminated (gain/loss ${gainLoss})`);
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id } };
}

// Documents + notes
export async function addAcqContractDocument(
  id: string,
  input: { url: string; label?: string }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const url = (input.url ?? "").trim();
  if (!url) return { success: false, error: "URL required" };
  // Must be a real absolute http(s) link, not a bare string that renders as a
  // broken in-app path (audit O-7).
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { success: false, error: "Enter a valid link starting with https:// (or http://)." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { success: false, error: "Document links must use https:// (or http://)." };
  }
  const doc = await prisma.acqContractDocument.create({
    data: { contractId: id, url, label: input.label || null, uploadedById: user.id },
    select: { id: true },
  });
  await logActivity(id, user.id, "NOTE", `Document added: ${input.label ?? "file"}`);
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id: doc.id } };
}

export async function addAcqContractNote(id: string, body: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  if (!body.trim()) return { success: false, error: "Note required" };
  await logActivity(id, user.id, "NOTE", body.trim());
  revalidatePath(`/bd/contracts/${id}`);
  return { success: true, data: { id } };
}

// Signing reminders — notify the BD owner + managers about contracts whose
// target sign date is near or overdue and not yet signed. Called by the daily cron.
export async function remindContractSignings(): Promise<number> {
  const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  let reminded = 0;
  try {
    const due = await prisma.acqContract.findMany({
      where: {
        deletedAt: null,
        status: { in: ["DRAFT", "APPROVED", "NEGOTIATED", "SIGNED"] },
        signByDate: { not: null, lte: soon },
      },
      select: { id: true, title: true, propertyName: true, signByDate: true, bdExecutiveId: true },
      take: 200,
    });
    if (due.length === 0) return 0;
    const managers = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "BD_HEAD"] } },
      select: { id: true },
    });
    const now = new Date();
    for (const c of due) {
      const overdue = c.signByDate! < now;
      const ids = new Set<string>([c.bdExecutiveId, ...managers.map((m) => m.id)]);
      for (const id of ids) {
        notify({
          userId: id,
          type: "SLA_WARNING",
          title: overdue ? "⏰ Contract signing overdue" : "Contract signing due soon",
          message: `${c.propertyName} — ${c.title}`,
          actionUrl: `/bd/contracts/${c.id}`,
        });
      }
      reminded++;
    }
  } catch (e) {
    console.error("[remindContractSignings] error:", e);
  }
  return reminded;
}

// Won deals available to turn into a contract.
export type ContractableDeal = {
  id: string;
  name: string;
  propertyName: string;
  ownerName: string;
  contractValue: number | null;
  model: string | null;
  baseFeePct: number | null;
  incentivePct: number | null;
  termYears: number | null;
};

// Returns agreed deals plus the commercials the contract should inherit, so the
// create-contract form can pre-fill instead of forcing a re-key (audit O-1/O-2).
export async function getContractableDeals(): Promise<ContractableDeal[]> {
  const deals = await prisma.acqDeal.findMany({
    where: { deletedAt: null, stage: { in: ["SIGNED", "WON", "CONTRACT_SENT", "NEGOTIATION"] } },
    select: {
      id: true, name: true, propertyName: true, ownerName: true,
      projectedFeeValue: true, model: true, baseFeePct: true, incentivePct: true, termYears: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return deals.map((d) => ({
    id: d.id,
    name: d.name,
    propertyName: d.propertyName,
    ownerName: d.ownerName,
    contractValue: d.projectedFeeValue != null ? Number(d.projectedFeeValue) : null,
    model: d.model ?? null,
    baseFeePct: d.baseFeePct != null ? Number(d.baseFeePct) : null,
    incentivePct: d.incentivePct != null ? Number(d.incentivePct) : null,
    termYears: d.termYears ?? null,
  }));
}
