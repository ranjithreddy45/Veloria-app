// ============================================================
// Multi-site attendance geofence — integration test.
// Mocks auth / next-headers / next-cache / email and drives the REAL checkIn
// server action against the local Postgres DB, proving the end-to-end path
// (myEmployee → resolveAssignedSites → evaluateGeofenceMulti → AttendanceRecord):
//   - assigned [A,B], punch inside B        → verified, siteId = B
//   - assigned [A,B], punch far away        → flagged, PRESENT (not WFH)
//   - attendanceAllSites, punch inside A     → verified
//   - assigned [C] (WFH on), punch far away  → WFH, not flagged
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => null }) }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "@/lib/prisma";
import { checkIn } from "./hr-attendance.actions";

const U = Date.now();
const ids: { users: string[]; employees: string[]; sites: string[]; entity?: string } = { users: [], employees: [], sites: [] };

// Site centres (r=200m). A/B disallow WFH; C allows WFH.
const A = { lat: 12.9700, lng: 77.5940 };
const B = { lat: 13.0000, lng: 77.6000 };
const C = { lat: 12.9000, lng: 77.5000 };
let siteA = "", siteB = "", siteC = "";

async function makeEmployee(tag: string, assign: { siteIds?: string[]; attendanceAllSites?: boolean }) {
  const user = await prisma.user.create({
    data: { name: `Geo ${tag}`, email: `geo-${tag}-${U}@t.local`, role: "STAFF", isActive: true },
    select: { id: true },
  });
  ids.users.push(user.id);
  const emp = await prisma.employee.create({
    data: {
      empCode: `GEO-${tag}-${U}`, firstName: "Geo", lastName: tag,
      legalEntityId: ids.entity!, userId: user.id,
      siteIds: assign.siteIds ?? [], attendanceAllSites: assign.attendanceAllSites ?? false,
    },
    select: { id: true },
  });
  ids.employees.push(emp.id);
  return { userId: user.id, employeeId: emp.id };
}

async function punch(userId: string, coord: { lat: number; lng: number }) {
  authMock.mockResolvedValue({ user: { id: userId, role: "STAFF", name: "Geo" } });
  return checkIn({ lat: coord.lat, lng: coord.lng, accuracyM: 20, visitType: "OFFICE" });
}

beforeAll(async () => {
  const entity = await prisma.legalEntity.create({ data: { name: `Geo Entity ${U}` }, select: { id: true } });
  ids.entity = entity.id;
  const mk = (name: string, c: { lat: number; lng: number }, allowWfh: boolean) =>
    prisma.attendanceSite.create({ data: { name, lat: c.lat, lng: c.lng, radiusMeters: 200, allowWfh, isActive: true }, select: { id: true } });
  siteA = (await mk(`A ${U}`, A, false)).id;
  siteB = (await mk(`B ${U}`, B, false)).id;
  siteC = (await mk(`C ${U}`, C, true)).id;
  ids.sites.push(siteA, siteB, siteC);
});

afterAll(async () => {
  await prisma.attendanceRecord.deleteMany({ where: { employeeId: { in: ids.employees } } });
  await prisma.activityLog.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.employee.deleteMany({ where: { id: { in: ids.employees } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.attendanceSite.deleteMany({ where: { id: { in: ids.sites } } });
  if (ids.entity) await prisma.legalEntity.deleteMany({ where: { id: ids.entity } });
});

describe("multi-site geofence check-in (real action + DB)", () => {
  it("ACCEPTS a punch inside the SECOND of two assigned sites", async () => {
    const { userId, employeeId } = await makeEmployee("multi", { siteIds: [siteA, siteB] });
    const res = await punch(userId, { lat: 13.0001, lng: 77.6000 }); // inside B
    expect(res.success).toBe(true);
    const rec = await prisma.attendanceRecord.findFirst({ where: { employeeId } });
    expect(rec?.locationVerified).toBe(true);
    expect(rec?.flagged).toBe(false);
    expect(rec?.siteId).toBe(siteB);
    expect(rec?.status).toBe("PRESENT");
  });

  it("FLAGS a punch outside ALL assigned sites (no WFH)", async () => {
    const { userId, employeeId } = await makeEmployee("outside", { siteIds: [siteA, siteB] });
    const res = await punch(userId, { lat: 20.0, lng: 80.0 }); // far away
    expect(res.success).toBe(true);
    const rec = await prisma.attendanceRecord.findFirst({ where: { employeeId } });
    expect(rec?.flagged).toBe(true);
    expect(rec?.locationVerified).toBe(false);
    expect(rec?.status).toBe("PRESENT"); // not WFH — A/B disallow it
    expect(rec?.flagReason).toMatch(/assigned sites/);
  });

  it("ACCEPTS an 'all locations' employee inside any active site", async () => {
    const { userId, employeeId } = await makeEmployee("all", { attendanceAllSites: true });
    const res = await punch(userId, { lat: 12.9701, lng: 77.5940 }); // inside A
    expect(res.success).toBe(true);
    const rec = await prisma.attendanceRecord.findFirst({ where: { employeeId } });
    expect(rec?.locationVerified).toBe(true);
    expect(rec?.flagged).toBe(false);
    expect(rec?.siteId).toBe(siteA);
  });

  it("records WFH (unflagged) when the single assigned site permits it", async () => {
    const { userId, employeeId } = await makeEmployee("wfh", { siteIds: [siteC] }); // C allows WFH
    const res = await punch(userId, { lat: 20.0, lng: 80.0 }); // far away
    expect(res.success).toBe(true);
    const rec = await prisma.attendanceRecord.findFirst({ where: { employeeId } });
    expect(rec?.status).toBe("WFH");
    expect(rec?.flagged).toBe(false);
  });
});
