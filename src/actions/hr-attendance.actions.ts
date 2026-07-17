"use server";

import { auth } from "@/../auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma, type UserRole } from "@prisma/client";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  withinRadius, ipAllowed, clientIpFromHeaders,
  isValidCoord, isTrustedAccuracy, MAX_TRUSTED_ACCURACY_M,
  evaluateGeofence,
} from "@/lib/hr/geo";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";
import { FULL_DAY_MINUTES, HALF_DAY_MINUTES } from "@/lib/hr/constants";
import { sendEmail } from "@/lib/email";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}
async function myEmployee(userId: string) {
  return prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, reportingManagerId: true, legalEntityId: true,
      site: { select: { id: true, name: true, lat: true, lng: true, radiusMeters: true, allowedIps: true, allowWfh: true, isActive: true } },
    },
  });
}
function todayUtcMidnight(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Format an instant as IST (fixed +5:30) clock time, e.g. "3:42 PM". */
function istTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

/** Roles that carry the hr:admin permission — used to resolve HR cc recipients. */
const HR_ADMIN_ROLES = Object.keys(ROLE_PERMISSIONS).filter((r) =>
  (ROLE_PERMISSIONS[r] ?? []).includes("hr:admin")
);

/**
 * Best-effort punch notification: email the employee's reporting manager,
 * cc all resolvable HR admins. Never throws — callers must not await-fail on it.
 */
async function notifyPunch(args: {
  employeeName: string; reportingManagerId: string | null;
  visitType: "OFFICE" | "FIELD" | "CLIENT"; locationVerified: boolean | null;
  flagged: boolean; flagReason: string | null; siteName: string | null; at: Date;
}): Promise<void> {
  try {
    if (!args.reportingManagerId) return; // no manager → nothing to notify
    const [manager, hrEmployees] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: args.reportingManagerId },
        select: { workEmail: true },
      }),
      prisma.employee.findMany({
        where: { deletedAt: null, workEmail: { not: null }, user: { role: { in: HR_ADMIN_ROLES as UserRole[] } } },
        select: { workEmail: true },
      }),
    ]);
    const to = manager?.workEmail?.trim();
    if (!to) return; // manager has no work email → skip (best-effort)

    const cc = hrEmployees
      .map((e) => e.workEmail?.trim())
      .filter((e): e is string => !!e && e !== to);

    const statusLine = args.flagged
      ? `⚠️ Flagged — ${args.flagReason ?? "needs review"}`
      : args.visitType === "CLIENT"
        ? "Client visit (no geo-tag required)"
        : args.locationVerified
          ? `✓ Location match verified${args.siteName ? ` — ${args.siteName}` : ""}`
          : "Not location-verified";

    const html = `
      <div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.5">
        <p><strong>${args.employeeName}</strong> punched in.</p>
        <table style="border-collapse:collapse;font-size:13px">
          <tr><td style="padding:2px 12px 2px 0;color:#666">Time (IST)</td><td>${istTime(args.at)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#666">Visit type</td><td>${args.visitType}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#666">Status</td><td>${statusLine}</td></tr>
        </table>
      </div>`;

    await sendEmail({
      to,
      cc: cc.length ? cc : undefined, // HR looped in as a real cc header
      subject: `Attendance • ${args.employeeName} punched in (${args.visitType})`,
      html,
    });
  } catch (err) {
    console.error("[ATTENDANCE_NOTIFY_ERROR]", err);
  }
}

// ============================================================
// Sites (admin)
// ============================================================
export async function getAttendanceSites() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.attendanceSite.findMany({ orderBy: { name: "asc" } });
}

export interface SiteInput {
  id?: string; name: string; legalEntityId?: string; lat?: number; lng?: number;
  radiusMeters?: number; allowedIps?: string; allowWfh?: boolean; isActive?: boolean;
}

export async function upsertAttendanceSite(input: SiteInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (!input.name?.trim()) return { success: false, error: "Site name is required." };

  const data = {
    name: input.name.trim(),
    legalEntityId: input.legalEntityId || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    radiusMeters: input.radiusMeters ?? 200,
    allowedIps: input.allowedIps?.trim() || null,
    allowWfh: input.allowWfh ?? true,
    isActive: input.isActive ?? true,
  };
  const rec = input.id
    ? await prisma.attendanceSite.update({ where: { id: input.id }, data })
    : await prisma.attendanceSite.create({ data });
  revalidatePath("/people/attendance/sites");
  return { success: true, data: { id: rec.id } };
}

// ============================================================
// Check-in / Check-out
// ============================================================
// ============================================================
// Geo evaluation — the single source of truth for BOTH punches.
// ------------------------------------------------------------
// Coordinates arrive from the browser, so they are untrusted input:
//   * validate range/finiteness (and reject 0,0 "Null Island"),
//   * refuse to trust a radius match from a coarse GPS fix (a ±5km wifi fix
//     lands inside a 200m radius by luck),
//   * a punch claiming OFFICE that lands off-site is a discrepancy → flag it,
//     rather than silently downgrading it to WFH.
// This can never be spoof-proof on the web (devtools can feed any coordinate);
// the goal is to make a bad punch VISIBLE (unverified / flagged) rather than
// to pretend it is proof.
// ============================================================

/** Max selfie payload (~1.4MB of base64 ≈ a 1MB JPEG). Keeps the row sane. */
const MAX_SELFIE_CHARS = 1_400_000;

/**
 * A selfie is untrusted client input. Accept only an https URL or an image
 * data-URL (the app's established upload pattern), and cap the size — this
 * blocks `javascript:` / `data:text/html` payloads and DB-bloating uploads.
 */
function safeSelfie(url: string | undefined | null): string | null {
  const v = (url ?? "").trim();
  if (!v) return null;
  if (v.length > MAX_SELFIE_CHARS) return null;
  if (!isSafeReceiptUrl(v)) return null;
  return v;
}

interface GeoInput {
  lat?: number;
  lng?: number;
  accuracyM?: number;
  visitType: "OFFICE" | "FIELD" | "CLIENT";
  ip: string | null;
}

interface GeoVerdict {
  matchedSite: { id: string; name: string } | null;
  verified: boolean | null; // true = inside a radius with a trusted fix
  flagged: boolean;
  flagReason: string | null;
  wfh: boolean; // caller may downgrade status to WFH
}

/** The employee's assigned attendance site, as selected by myEmployee(). */
type AssignedSite = {
  id: string; name: string; lat: number | null; lng: number | null;
  radiusMeters: number; allowedIps: string | null; allowWfh: boolean; isActive: boolean;
} | null;

async function evaluateGeo({ lat, lng, accuracyM, visitType, ip }: GeoInput, assignedSite: AssignedSite = null): Promise<GeoVerdict> {
  const none: GeoVerdict = { matchedSite: null, verified: null, flagged: false, flagReason: null, wfh: false };

  // A client visit is off-site by definition — no geo-tag required.
  if (visitType === "CLIENT") return none;

  // Employee has an assigned site with a geofence → validate against THAT site via
  // the pure, unit-tested rule. (An inactive or geo-less assignment can't be
  // enforced; fall through to the org-wide any-site match below.)
  if (assignedSite?.isActive && assignedSite.lat != null && assignedSite.lng != null) {
    return evaluateGeofence(assignedSite, { lat, lng, accuracyM, visitType, ip });
  }

  const sites = await prisma.attendanceSite.findMany({ where: { isActive: true } });
  const geoSites = sites.filter((s) => s.lat != null && s.lng != null);

  // Nothing to verify against. The muster shows a "location verification is OFF"
  // banner for exactly this state, so don't flag every punch in the org.
  if (geoSites.length === 0) return none;

  // Untrusted or absent coordinates → never claim verification.
  if (!isValidCoord(lat, lng)) {
    return { ...none, verified: false, flagged: true, flagReason: "No valid location captured for this punch" };
  }

  // A coarse fix cannot substantiate a radius match.
  if (!isTrustedAccuracy(accuracyM)) {
    const acc = accuracyM == null ? "unknown" : `±${Math.round(accuracyM)}m`;
    return {
      ...none,
      verified: false, flagged: true,
      flagReason: `GPS accuracy ${acc} is too coarse to verify (needs ≤${MAX_TRUSTED_ACCURACY_M}m)`,
    };
  }

  const hit = geoSites.find((s) => withinRadius(lat!, lng!, s.lat!, s.lng!, s.radiusMeters)) ?? null;

  if (hit) {
    const matchedSite = { id: hit.id, name: hit.name };
    if (!ipAllowed(ip, hit.allowedIps)) {
      // On-site GPS but off an allowed network — PREFER FLAG OVER BLOCK so a
      // physically-present employee is never locked out; HR reviews the flag.
      return { matchedSite, verified: false, flagged: true, flagReason: "On-site but network not on the allow-list — needs review", wfh: false };
    }
    return { matchedSite, verified: true, flagged: false, flagReason: null, wfh: false };
  }

  // Off-site, with a trusted fix.
  if (visitType === "FIELD") {
    // Field work is off-site by nature — record it unverified, but don't flag.
    return { ...none, verified: false };
  }

  // visitType === "OFFICE" but they are not at any office.
  // The WFH escape hatch applies only when EVERY active site permits it (the old
  // `some()` meant one permissive site disabled flagging for the whole org).
  if (sites.every((s) => s.allowWfh)) {
    return { ...none, verified: false, flagged: true, flagReason: "Off-site check-in recorded as WFH", wfh: true };
  }
  return { ...none, verified: false, flagged: true, flagReason: "Location outside every site radius" };
}

export async function checkIn(input: {
  lat?: number; lng?: number; accuracyM?: number; selfieUrl?: string;
  visitType?: "OFFICE" | "FIELD" | "CLIENT";
}): Promise<Result<{ status: string; siteName: string | null; visitType: string; locationVerified: boolean | null; flagged: boolean }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const emp = await myEmployee(u.id);
  if (!emp) return { success: false, error: "Your account isn't linked to an employee record yet." };

  const visitType: "OFFICE" | "FIELD" | "CLIENT" = input.visitType ?? "OFFICE";

  const date = todayUtcMidnight();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: emp.id, date } },
  });
  if (existing?.checkInAt) return { success: false, error: "You've already checked in today." };

  // Resolve client IP.
  const h = await headers();
  const ip = clientIpFromHeaders(h.get("x-forwarded-for"), h.get("x-real-ip"));

  const verdict = await evaluateGeo({ lat: input.lat, lng: input.lng, accuracyM: input.accuracyM, visitType, ip }, emp.site);
  const { matchedSite, verified: locationVerified, flagged, flagReason } = verdict;
  const status: "PRESENT" | "WFH" = verdict.wfh ? "WFH" : "PRESENT";

  // Only persist coordinates that passed validation — never store junk/spoofed
  // sentinels like (0,0) that would later read as a real position.
  const okCoords = isValidCoord(input.lat, input.lng);
  const lat = okCoords ? input.lat! : null;
  const lng = okCoords ? input.lng! : null;
  const accuracyM = Number.isFinite(input.accuracyM as number) ? (input.accuracyM as number) : null;
  const selfieUrl = safeSelfie(input.selfieUrl);

  const now = new Date();
  const rec = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: emp.id, date } },
    create: {
      employeeId: emp.id, date, checkInAt: now,
      checkInLat: lat, checkInLng: lng, checkInIp: ip, checkInAccuracyM: accuracyM,
      siteId: matchedSite?.id ?? null, source: "WEB", status, selfieUrl,
      visitType, locationVerified, flagged, flagReason,
    },
    update: {
      checkInAt: now, checkInLat: lat, checkInLng: lng, checkInIp: ip, checkInAccuracyM: accuracyM,
      siteId: matchedSite?.id ?? null, status, visitType, locationVerified, flagged, flagReason,
      ...(selfieUrl ? { selfieUrl } : {}),
    },
  });
  await prisma.activityLog.create({
    data: { action: "ATTENDANCE_CHECK_IN", entityType: "ATTENDANCE", entityId: rec.id, userId: u.id, changes: { status, visitType, locationVerified, flagged } },
  });

  // Best-effort notification — fire-and-forget so email latency never delays
  // the check-in response (notifyPunch already swallows its own errors).
  void notifyPunch({
    employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
    reportingManagerId: emp.reportingManagerId,
    visitType, locationVerified, flagged, flagReason,
    siteName: matchedSite?.name ?? null, at: now,
  });

  revalidatePath("/people/attendance");
  return { success: true, data: { status, siteName: matchedSite?.name ?? null, visitType, locationVerified, flagged } };
}

export async function checkOut(input: {
  lat?: number; lng?: number; accuracyM?: number; selfieUrl?: string;
} = {}): Promise<Result<{ workedMinutes: number; status: string; locationVerified: boolean | null; flagged: boolean }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const emp = await myEmployee(u.id);
  if (!emp) return { success: false, error: "No employee record." };

  const date = todayUtcMidnight();
  const rec = await prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } });
  if (!rec?.checkInAt) return { success: false, error: "You haven't checked in today." };
  if (rec.checkOutAt) return { success: false, error: "You've already checked out today." };

  const h = await headers();
  const ip = clientIpFromHeaders(h.get("x-forwarded-for"), h.get("x-real-ip"));

  // Geo-verify the punch-OUT with the same rules as the punch-in, using the
  // visit type recorded at check-in. Without this you could check in at the
  // venue and check out from home while the worked hours still counted.
  const visitType = (rec.visitType as "OFFICE" | "FIELD" | "CLIENT" | null) ?? "OFFICE";
  const verdict = await evaluateGeo({ lat: input.lat, lng: input.lng, accuracyM: input.accuracyM, visitType, ip }, emp.site);

  const okCoords = isValidCoord(input.lat, input.lng);
  const outLat = okCoords ? input.lat! : null;
  const outLng = okCoords ? input.lng! : null;
  const outAccuracy = Number.isFinite(input.accuracyM as number) ? (input.accuracyM as number) : null;
  const outSelfie = safeSelfie(input.selfieUrl);

  const now = new Date();
  const workedMinutes = Math.max(0, Math.round((now.getTime() - rec.checkInAt.getTime()) / 60000));
  // Downgrade to half-day if short — but never overwrite a WFH classification.
  let status = rec.status;
  if (rec.status !== "WFH" && workedMinutes < HALF_DAY_MINUTES) status = "HALF_DAY";

  // A flag raised at check-OUT must not silently clear a flag raised at check-in.
  const flagged = rec.flagged || verdict.flagged;
  const flagReason = rec.flagged
    ? rec.flagReason
    : verdict.flagged
      ? `Check-out: ${verdict.flagReason}`
      : null;

  await prisma.attendanceRecord.update({
    where: { id: rec.id },
    data: {
      checkOutAt: now, workedMinutes, status,
      checkOutLat: outLat, checkOutLng: outLng, checkOutIp: ip, checkOutAccuracyM: outAccuracy,
      checkOutSiteId: verdict.matchedSite?.id ?? null,
      checkOutVerified: verdict.verified,
      ...(outSelfie ? { checkOutSelfieUrl: outSelfie } : {}),
      flagged, flagReason,
    },
  });
  await prisma.activityLog.create({
    data: {
      action: "ATTENDANCE_CHECK_OUT", entityType: "ATTENDANCE", entityId: rec.id, userId: u.id,
      // Report the MERGED flag (a check-in flag survives a clean check-out) so the
      // log and the caller's payload match the persisted row, not just this punch.
      changes: { workedMinutes, checkOutVerified: verdict.verified, flagged },
    },
  });
  revalidatePath("/people/attendance");
  revalidatePath("/me/attendance");
  return { success: true, data: { workedMinutes, status, locationVerified: verdict.verified, flagged } };
}

// ============================================================
// Flagged-punch review queue (HR clears a flag after checking it).
// ============================================================

export interface FlaggedPunch {
  id: string;
  employeeId: string;
  name: string;
  empCode: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  visitType: string | null;
  flagReason: string | null;
  locationVerified: boolean | null;
  checkOutVerified: boolean | null;
  siteName: string | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  selfieUrl: string | null;
}

/** Every unresolved flagged punch, newest first. Gate: hr:read. */
export async function getFlaggedPunches(limit = 200): Promise<FlaggedPunch[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];

  const [rows, sites] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { flagged: true, flagClearedAt: null },
      orderBy: [{ date: "desc" }, { checkInAt: "desc" }],
      take: Math.min(500, Math.max(1, limit)),
      include: { employee: { select: { id: true, firstName: true, lastName: true, empCode: true } } },
    }),
    prisma.attendanceSite.findMany({ select: { id: true, name: true } }),
  ]);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    name: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
    empCode: r.employee.empCode,
    date: r.date.toISOString(),
    checkInAt: r.checkInAt?.toISOString() ?? null,
    checkOutAt: r.checkOutAt?.toISOString() ?? null,
    visitType: r.visitType,
    flagReason: r.flagReason,
    locationVerified: r.locationVerified,
    checkOutVerified: r.checkOutVerified,
    siteName: r.siteId ? siteName.get(r.siteId) ?? null : null,
    lat: r.checkInLat,
    lng: r.checkInLng,
    accuracyM: r.checkInAccuracyM,
    selfieUrl: r.selfieUrl,
  }));
}

/** Clear a flag after HR has reviewed it. Gate: hr:write || hr:admin. Audited. */
export async function clearAttendanceFlag(recordId: string, note?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write") && !can(u?.role, "hr:admin")) {
    return { success: false, error: "Not authorized." };
  }
  const rec = await prisma.attendanceRecord.findUnique({ where: { id: recordId }, select: { id: true, flagged: true } });
  if (!rec) return { success: false, error: "Attendance record not found." };
  if (!rec.flagged) return { success: false, error: "This punch isn't flagged." };

  await prisma.attendanceRecord.update({
    where: { id: recordId },
    // Keep flagReason for the audit trail — clear the flag, not the history.
    data: { flagged: false, flagClearedById: u!.id, flagClearedAt: new Date(), flagClearNote: note?.trim() || null },
  });
  await prisma.activityLog.create({
    data: { action: "ATTENDANCE_FLAG_CLEARED", entityType: "ATTENDANCE", entityId: recordId, userId: u!.id, changes: { note: note ?? null } },
  });
  revalidatePath("/people/attendance/flagged");
  revalidatePath("/people/attendance/muster");
  return { success: true, data: { id: recordId } };
}

// ============================================================
// My attendance (today + month)
// ============================================================
export async function getMyAttendance(year?: number, month?: number) {
  const u = await requireUser();
  if (!u?.id) return null;
  const emp = await myEmployee(u.id);
  if (!emp) return { linked: false as const };

  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));
  const today = todayUtcMidnight();

  const [todayRec, monthRecs, siteRows] = await Promise.all([
    prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: emp.id, date: today } } }),
    prisma.attendanceRecord.findMany({ where: { employeeId: emp.id, date: { gte: from, lte: to } }, orderBy: { date: "desc" } }),
    prisma.attendanceSite.findMany({ select: { id: true, name: true, isActive: true, lat: true, lng: true } }),
  ]);

  const presentDays = monthRecs.filter((r) => r.status === "PRESENT" || r.status === "WFH").length;
  const halfDays = monthRecs.filter((r) => r.status === "HALF_DAY").length;
  const totalMinutes = monthRecs.reduce((s, r) => s + r.workedMinutes, 0);

  // siteId is a plain String (no relation) — expose an id→name map so the UI can
  // label a check-in's site. geoEnabled = any ACTIVE site with lat AND lng.
  const sites: Record<string, string> = Object.fromEntries(siteRows.map((s) => [s.id, s.name]));
  const geoEnabled = siteRows.some((s) => s.isActive && s.lat != null && s.lng != null);

  return {
    linked: true as const, employeeId: emp.id, year: y, month: m,
    today: todayRec, records: monthRecs, sites, geoEnabled,
    stats: { presentDays, halfDays, totalHours: Math.round(totalMinutes / 60) },
  };
}

// ============================================================
// Regularization
// ============================================================
export async function requestRegularization(input: {
  date: string; requestedStatus: string; reason: string; checkIn?: string; checkOut?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const emp = await myEmployee(u.id);
  if (!emp) return { success: false, error: "No employee record." };
  if (!input.reason?.trim()) return { success: false, error: "Please give a reason." };

  const date = new Date(input.date + "T00:00:00.000Z");
  if (isNaN(date.getTime())) return { success: false, error: "Invalid date." };

  // Only statuses an employee may legitimately request a correction to.
  const ALLOWED_REG_STATUSES = ["PRESENT", "HALF_DAY", "WFH", "ON_LEAVE"] as const;
  if (!ALLOWED_REG_STATUSES.includes(input.requestedStatus as (typeof ALLOWED_REG_STATUSES)[number]))
    return { success: false, error: "Invalid requested status." };

  const rec = await prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } });

  const reg = await prisma.regularization.create({
    data: {
      employeeId: emp.id,
      attendanceRecordId: rec?.id ?? null,
      date,
      requestedStatus: input.requestedStatus as Prisma.RegularizationCreateInput["requestedStatus"],
      requestedCheckIn: input.checkIn ? new Date(`${input.date}T${input.checkIn}:00.000Z`) : null,
      requestedCheckOut: input.checkOut ? new Date(`${input.date}T${input.checkOut}:00.000Z`) : null,
      reason: input.reason.trim(),
      approverId: emp.reportingManagerId,
    },
  });
  revalidatePath("/people/attendance");
  revalidatePath("/people/attendance/regularizations");
  return { success: true, data: { id: reg.id } };
}

export async function getRegularizationQueue() {
  const u = await requireUser();
  if (!u?.id) return { rows: [] };
  const isHr = can(u.role, "hr:approve");
  const me = await myEmployee(u.id);
  const where: Prisma.RegularizationWhereInput = isHr
    ? { status: "PENDING" }
    : me ? { status: "PENDING", approverId: me.id } : { id: "__none__" };

  const rows = await prisma.regularization.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true, empCode: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { rows };
}

export async function decideRegularization(id: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const isHr = can(u.role, "hr:approve");
  const me = await myEmployee(u.id);

  const reg = await prisma.regularization.findUnique({ where: { id } });
  if (!reg || reg.status !== "PENDING") return { success: false, error: "Not found or already decided." };
  if (!isHr && !(me && reg.approverId === me.id)) return { success: false, error: "You're not the approver." };

  await prisma.$transaction(async (tx) => {
    await tx.regularization.update({
      where: { id }, data: { status: decision, decidedAt: new Date(), decisionNote: note || null, approverId: me?.id ?? reg.approverId },
    });
    if (decision === "APPROVED") {
      const workedMinutes = reg.requestedCheckIn && reg.requestedCheckOut
        ? Math.max(0, Math.round((reg.requestedCheckOut.getTime() - reg.requestedCheckIn.getTime()) / 60000))
        : reg.requestedStatus === "HALF_DAY" ? HALF_DAY_MINUTES : FULL_DAY_MINUTES;
      await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: reg.employeeId, date: reg.date } },
        create: {
          employeeId: reg.employeeId, date: reg.date,
          checkInAt: reg.requestedCheckIn, checkOutAt: reg.requestedCheckOut,
          status: reg.requestedStatus, workedMinutes, source: "MANUAL", isRegularized: true,
        },
        update: {
          checkInAt: reg.requestedCheckIn ?? undefined, checkOutAt: reg.requestedCheckOut ?? undefined,
          status: reg.requestedStatus, workedMinutes, isRegularized: true,
        },
      });
    }
    await tx.activityLog.create({
      data: { action: decision === "APPROVED" ? "REGULARIZATION_APPROVED" : "REGULARIZATION_REJECTED", entityType: "REGULARIZATION", entityId: id, userId: u.id },
    });
  });
  revalidatePath("/people/attendance/regularizations");
  return { success: true, data: { id } };
}

// ============================================================
// HR backend — manual attendance entry & employee picker
// ============================================================
const MANUAL_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "WFH", "ON_LEAVE", "HOLIDAY"] as const;
type ManualStatus = (typeof MANUAL_STATUSES)[number];

/** Employees an HR user can pick when entering attendance manually. */
export async function getAttendanceEmployees() {
  const u = await requireUser();
  if (!can(u?.role, "hr:write") && !can(u?.role, "hr:admin")) return [];
  return prisma.employee.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, empCode: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

/**
 * HR manually marks/enters a day's attendance from the backend (flowchart:
 * "marked/entered manually by HR"). Idempotent on @@unique([employeeId, date]);
 * records the entry as MANUAL and clears any auto-flag on that day.
 */
export async function markAttendanceManually(input: {
  employeeId: string; date: string; status: string; note?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write") && !can(u?.role, "hr:admin"))
    return { success: false, error: "Not authorized." };

  if (!input.employeeId) return { success: false, error: "Pick an employee." };
  if (!MANUAL_STATUSES.includes(input.status as ManualStatus))
    return { success: false, error: "Invalid status." };

  const date = new Date(input.date + "T00:00:00.000Z");
  if (isNaN(date.getTime())) return { success: false, error: "Invalid date." };

  const emp = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  const status = input.status as ManualStatus;
  const workedMinutes =
    status === "PRESENT" || status === "WFH" ? FULL_DAY_MINUTES
      : status === "HALF_DAY" ? HALF_DAY_MINUTES
        : 0;
  const note = input.note?.trim() || null;

  const rec = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: emp.id, date } },
    create: {
      employeeId: emp.id, date, status, workedMinutes,
      source: "MANUAL", note, flagged: false, flagReason: null,
    },
    update: {
      status, workedMinutes, source: "MANUAL", note, flagged: false, flagReason: null,
    },
  });
  await prisma.activityLog.create({
    data: { action: "ATTENDANCE_MANUAL_MARK", entityType: "ATTENDANCE", entityId: rec.id, userId: u!.id, changes: { status, note } },
  });
  revalidatePath("/people/attendance");
  return { success: true, data: { id: rec.id } };
}
