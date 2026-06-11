// End-to-end test of the projection lifecycle against the real DB.
// Mocks auth + next/cache and drives the real server actions.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }));

import { prisma } from "@/lib/prisma";
import {
  createAcqProjection,
  submitAcqProjection,
  approveAcqProjection,
  sendAcqProjection,
  newAcqProjectionVersion,
  updateAcqProjection,
} from "./acq-projection.actions";

const U = Date.now();
let headId: string; // submitter (BD_HEAD)
let adminId: string; // second approver (ADMIN)
let dealId: string;
let leadId: string;
let projId: string;

const setActor = (id: string, role: string) => authMock.mockResolvedValue({ user: { id, role, name: role } });

const ORACLE = {
  banquetSizeSft: 1500, seatingCapacity: 100,
  eventsBaseCase: 20, eventsBestCase: 25,
  hourlyHallCharge: 6999, hoursPerEvent: 4,
};

beforeAll(async () => {
  const head = await prisma.user.create({ data: { name: "Head", email: `proj-head-${U}@t.local`, role: "BD_HEAD", isActive: true }, select: { id: true } });
  const admin = await prisma.user.create({ data: { name: "Admin", email: `proj-admin-${U}@t.local`, role: "ADMIN", isActive: true }, select: { id: true } });
  headId = head.id; adminId = admin.id;
  const lead = await prisma.acqLead.create({
    data: { ownerName: "Proj Owner", mobilePrimary: `+9199${String(U).slice(-8)}`, email: "owner@t.local",
      propertyName: "Proj Hall", propertyType: "BANQUET", city: "Bangalore", locality: `Loc${U}`,
      leadSource: "REFERRAL", ownerType: "SOLE_OWNER", bdExecutiveId: headId, status: "QUALIFIED", firstContactDue: new Date() },
    select: { id: true },
  });
  leadId = lead.id;
  const deal = await prisma.acqDeal.create({
    data: { name: "Proj Deal", leadId, stage: "QUALIFIED", ownerName: "Proj Owner", ownerType: "SOLE_OWNER",
      propertyName: "Proj Hall", propertyType: "BANQUET", city: "Bangalore", locality: `Loc${U}`, bdExecutiveId: headId },
    select: { id: true },
  });
  dealId = deal.id;
});

afterAll(async () => {
  await prisma.acqProjectionTransition.deleteMany({ where: { projection: { dealId } } });
  await prisma.acqProjection.deleteMany({ where: { dealId } });
  await prisma.acqAttachment.deleteMany({ where: { dealId } });
  await prisma.acqDeal.deleteMany({ where: { id: dealId } });
  await prisma.acqLead.deleteMany({ where: { id: leadId } });
  await prisma.activityLog.deleteMany({ where: { userId: { in: [headId, adminId] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [headId, adminId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [headId, adminId] } } });
  await prisma.$disconnect();
});

describe("projection lifecycle", () => {
  it("creates a DRAFT", async () => {
    setActor(headId, "BD_HEAD");
    const r = await createAcqProjection(dealId, "WITHOUT_FOOD", ORACLE);
    expect(r.success).toBe(true);
    if (r.success) projId = r.data.id;
  });

  it("submits to PENDING_APPROVAL", async () => {
    setActor(headId, "BD_HEAD");
    const r = await submitAcqProjection(projId);
    expect(r.success).toBe(true);
  });

  it("blocks the submitter from approving their own (needs 2nd approver)", async () => {
    setActor(headId, "BD_HEAD");
    const r = await approveAcqProjection(projId);
    expect(r.success).toBe(false);
  });

  it("cannot be sent before approval", async () => {
    setActor(headId, "BD_HEAD");
    const r = await sendAcqProjection(projId, { method: "MANUAL_DOWNLOAD" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.code).toBe(409);
  });

  it("a different approver approves and freezes the oracle snapshot", async () => {
    setActor(adminId, "ADMIN");
    const r = await approveAcqProjection(projId);
    expect(r.success).toBe(true);
    const row = await prisma.acqProjection.findUnique({ where: { id: projId } });
    expect(row?.status).toBe("APPROVED");
    // snapshot reproduces the oracle to the rupee
    const grid = row?.outputsJson as unknown as { base: { netOwnerReturn: number; totalRevenue: number }[] };
    expect(grid.base[0].totalRevenue).toBe(559920);
    expect(grid.base[0].netOwnerReturn).toBe(332740);
  });

  it("cannot edit an approved projection", async () => {
    setActor(headId, "BD_HEAD");
    const r = await updateAcqProjection(projId, ORACLE);
    expect(r.success).toBe(false);
  });

  it("sends from APPROVED and logs a PROJECTION attachment", async () => {
    setActor(headId, "BD_HEAD");
    const r = await sendAcqProjection(projId, { method: "MANUAL_DOWNLOAD", channel: "in-person" });
    expect(r.success).toBe(true);
    const att = await prisma.acqAttachment.count({ where: { dealId, kind: "PROJECTION" } });
    expect(att).toBeGreaterThan(0);
    const row = await prisma.acqProjection.findUnique({ where: { id: projId } });
    expect(row?.status).toBe("SENT");
  });

  it("new version clones into a fresh DRAFT v2", async () => {
    setActor(headId, "BD_HEAD");
    const r = await newAcqProjectionVersion(projId);
    expect(r.success).toBe(true);
    if (r.success) {
      const v2 = await prisma.acqProjection.findUnique({ where: { id: r.data.id } });
      expect(v2?.status).toBe("DRAFT");
      expect(v2?.version).toBe(2);
    }
  });
});
