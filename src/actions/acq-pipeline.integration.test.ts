// ============================================================
// BD / Acquisition CRM — end-to-end integration test.
// Mocks auth + next/cache and drives the REAL server actions
// against the local Postgres DB to prove the spec's acceptance
// criteria (dedup, qualify gate, transition guards, WON / AVAILABLE
// automations, "Sales notified only on AVAILABLE").
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// --- mocks must be declared before importing the actions ---
const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import {
  createAcqLead,
  qualifyAcqLead,
} from "./acq-lead.actions";
import {
  transitionAcqDeal,
  submitAcqEvaluation,
  addAcqAttachment,
  updateAcqDeal,
  markAcqContractSigned,
} from "./acq-deal.actions";
import {
  markPropertyAvailable,
  setAcqOnboardingTaskDone,
  assignPropertyManager,
} from "./acq-property.actions";

let userId: string;
const UNIQUE = Date.now();
const MOBILE = "98450" + String(UNIQUE).slice(-5);
const setActor = (role: string) => authMock.mockResolvedValue({ user: { id: userId, role, name: "Tester" } });

const ids: { leadId?: string; dealId?: string; propertyId?: string } = {};

beforeAll(async () => {
  const u = await prisma.user.create({
    data: { name: "ACQ Test", email: `acq-${UNIQUE}@test.local`, role: "ADMIN", isActive: true },
    select: { id: true },
  });
  userId = u.id;
  setActor("ADMIN");
});

afterAll(async () => {
  // Tear down everything we created.
  if (ids.propertyId) {
    const proj = await prisma.acqOnboardingProject.findUnique({ where: { propertyId: ids.propertyId } });
    if (proj) {
      await prisma.acqOnboardingTask.deleteMany({ where: { projectId: proj.id } });
      await prisma.acqOnboardingProject.delete({ where: { id: proj.id } });
    }
  }
  if (ids.dealId) {
    await prisma.acqEvaluation.deleteMany({ where: { dealId: ids.dealId } });
    await prisma.acqAttachment.deleteMany({ where: { dealId: ids.dealId } });
    await prisma.acqDealNote.deleteMany({ where: { dealId: ids.dealId } });
  }
  if (ids.propertyId) await prisma.acqProperty.deleteMany({ where: { id: ids.propertyId } });
  if (ids.dealId) await prisma.acqDeal.deleteMany({ where: { id: ids.dealId } });
  if (ids.leadId) await prisma.acqLead.deleteMany({ where: { id: ids.leadId } });
  await prisma.acqStageTransition.deleteMany({ where: { actorId: userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.activityLog.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

const validLead = () => ({
  ownerName: "Test Owner",
  mobilePrimary: MOBILE,
  propertyName: `Test Hall ${UNIQUE}`,
  propertyType: "BANQUET" as const,
  city: "Bangalore",
  locality: `Locality ${UNIQUE}`,
  leadSource: "REFERRAL" as const,
  ownerType: "SOLE_OWNER" as const,
});

describe("BD acquisition pipeline (end-to-end)", () => {
  it("creates a lead", async () => {
    const r = await createAcqLead(validLead());
    expect(r.success).toBe(true);
    if (r.success) ids.leadId = r.data.id;
  });

  it("rejects a duplicate mobile and surfaces the existing lead", async () => {
    const r = await createAcqLead({ ...validLead(), propertyName: "Different Name", locality: "Different" });
    expect(r.success).toBe(false);
    if (!r.success) expect((r as { duplicateOf?: unknown }).duplicateOf).toBeTruthy();
  });

  it("blocks qualification unless all 4 gates are true", async () => {
    const bad = await qualifyAcqLead(ids.leadId!, {
      seating_100_plus: true,
      owner_interested_in_management_model: false, // the decisive one
      agrees_to_renovate_if_required: true,
      required_photos_available: true,
    });
    expect(bad.success).toBe(false);
  });

  it("qualifies and creates a deal in QUALIFIED", async () => {
    const r = await qualifyAcqLead(ids.leadId!, {
      seating_100_plus: true,
      owner_interested_in_management_model: true,
      agrees_to_renovate_if_required: true,
      required_photos_available: true,
    });
    expect(r.success).toBe(true);
    if (r.success) ids.dealId = r.data.dealId;
    const deal = await prisma.acqDeal.findUnique({ where: { id: ids.dealId } });
    expect(deal?.stage).toBe("QUALIFIED");
  });

  it("rejects an illegal stage jump (409)", async () => {
    const r = await transitionAcqDeal(ids.dealId!, "WON");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.code).toBe(409);
  });

  it("moves to EVALUATION, then blocks EVALUATION_COMPLETED until passed eval + 8 photos", async () => {
    expect((await transitionAcqDeal(ids.dealId!, "EVALUATION")).success).toBe(true);

    // No evaluation yet → blocked.
    expect((await transitionAcqDeal(ids.dealId!, "EVALUATION_COMPLETED")).success).toBe(false);

    const ev = await submitAcqEvaluation(ids.dealId!, {
      capacityScore: 5, parkingScore: 4, kitchenScore: 3, roomsScore: 3,
      conditionScore: 5, locationScore: 4, avAmenitiesScore: 3,
    });
    expect(ev.success && ev.data.passed).toBe(true);

    // Passed eval but only 7 photos → still blocked.
    for (let i = 0; i < 7; i++) await addAcqAttachment(ids.dealId!, { kind: "PHOTO", url: `https://x/${i}.jpg` });
    expect((await transitionAcqDeal(ids.dealId!, "EVALUATION_COMPLETED")).success).toBe(false);

    // 8th photo → allowed.
    await addAcqAttachment(ids.dealId!, { kind: "PHOTO", url: "https://x/8.jpg" });
    const ok = await transitionAcqDeal(ids.dealId!, "EVALUATION_COMPLETED");
    expect(ok.success).toBe(true);
    const deal = await prisma.acqDeal.findUnique({ where: { id: ids.dealId } });
    expect(deal?.evalPassed).toBe(true);
    expect(deal?.evalScore).toBe(82);
  });

  it("requires commercials before PROPOSAL_SENT", async () => {
    expect((await transitionAcqDeal(ids.dealId!, "PROPOSAL_SENT")).success).toBe(false);
    // projectedFeeValue is required to mark a deal WON (Round-5 economics gate);
    // ₹5L is below LARGE_DEAL_SIGNOFF_VALUE (₹15L) so no large-deal sign-off is needed.
    await updateAcqDeal(ids.dealId!, { model: "MANAGEMENT", baseFeePct: 8, incentivePct: 18, termYears: 5, lockinYears: 5, projectedFeeValue: 500000 });
    expect((await transitionAcqDeal(ids.dealId!, "PROPOSAL_SENT")).success).toBe(true);
    expect((await transitionAcqDeal(ids.dealId!, "NEGOTIATION")).success).toBe(true);
  });

  it("blocks CONTRACT_SENT until signatory verified; at/above floor needs no approval", async () => {
    expect((await transitionAcqDeal(ids.dealId!, "CONTRACT_SENT")).success).toBe(false); // signatory not verified
    await updateAcqDeal(ids.dealId!, { signatoryAuthorityVerified: true });
    const r = await transitionAcqDeal(ids.dealId!, "CONTRACT_SENT");
    expect(r.success).toBe(true); // 8>=5, 18>=15, lockin 5>=3 → no approval needed
    const deal = await prisma.acqDeal.findUnique({ where: { id: ids.dealId } });
    expect(deal?.contractStatus).toBe("SENT");
  });

  it("requires signed contract + agreement before SIGNED", async () => {
    expect((await transitionAcqDeal(ids.dealId!, "SIGNED")).success).toBe(false); // not signed yet
    await markAcqContractSigned(ids.dealId!);
    expect((await transitionAcqDeal(ids.dealId!, "SIGNED")).success).toBe(false); // no agreement attachment
    await addAcqAttachment(ids.dealId!, { kind: "AGREEMENT", url: "https://x/agreement.pdf" });
    expect((await transitionAcqDeal(ids.dealId!, "SIGNED")).success).toBe(true);
  });

  it("WON creates an ONBOARDING property + 6 seed tasks and does NOT notify Sales", async () => {
    const r = await transitionAcqDeal(ids.dealId!, "WON");
    expect(r.success).toBe(true);
    const property = await prisma.acqProperty.findFirst({ where: { dealId: ids.dealId } });
    expect(property?.status).toBe("ONBOARDING");
    ids.propertyId = property!.id;

    const project = await prisma.acqOnboardingProject.findUnique({ where: { propertyId: property!.id } });
    const taskCount = await prisma.acqOnboardingTask.count({ where: { projectId: project!.id } });
    expect(taskCount).toBe(6);

    // CRITICAL: Sales must NOT be notified on WON.
    const salesNotif = await prisma.notification.count({
      where: { userId, title: "New property available" },
    });
    expect(salesNotif).toBe(0);
  });

  it("blocks AVAILABLE until onboarding complete + manager assigned, then notifies Sales", async () => {
    // Not complete yet → blocked.
    expect((await markPropertyAvailable(ids.propertyId!)).success).toBe(false);

    const project = await prisma.acqOnboardingProject.findUnique({ where: { propertyId: ids.propertyId! } });
    const tasks = await prisma.acqOnboardingTask.findMany({ where: { projectId: project!.id } });
    for (const t of tasks) await setAcqOnboardingTaskDone(t.id, true);

    // Tasks done but no manager → still blocked.
    expect((await markPropertyAvailable(ids.propertyId!)).success).toBe(false);

    await assignPropertyManager(ids.propertyId!, userId);
    const ok = await markPropertyAvailable(ids.propertyId!);
    expect(ok.success).toBe(true);

    const property = await prisma.acqProperty.findUnique({ where: { id: ids.propertyId! } });
    expect(property?.status).toBe("AVAILABLE");
    expect(property?.availableAt).toBeTruthy();

    // Now Sales IS notified.
    const salesNotif = await prisma.notification.count({ where: { userId, title: "New property available" } });
    expect(salesNotif).toBeGreaterThan(0);
  });
});
