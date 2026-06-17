"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function canRead(role?: string) { return !!role && hasPermission(role, "projects:read"); }
const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d));

const COMMITTED_PO = ["ISSUED", "RECEIVED", "PAID"];

// Portfolio health/variance/risk across every in-flight venue project.
export async function getPortfolio() {
  const u = await requireUser();
  if (!canRead(u?.role)) return null;
  return computePortfolio();
}

// Same computation without the session gate, for trusted server contexts
// (e.g. the cron escalation job, which has no logged-in user). Never expose
// this directly to a request handler without its own auth.
export async function computePortfolio() {
  const [projects, openSnags, projections, pos] = await Promise.all([
    prisma.acqOnboardingProject.findMany({
      where: { phase: { not: "LIVE" } },
      select: { id: true, phase: true, targetReadyDate: true, property: { select: { propertyName: true, city: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectSnag.findMany({ where: { status: { not: "VERIFIED_CLOSED" } }, select: { projectId: true, severity: true } }),
    prisma.acqCapexProjection.findMany({ select: { projectId: true, totalCapex: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.projectPurchaseOrder.findMany({ where: { status: { in: COMMITTED_PO as never } }, select: { projectId: true, amount: true } }),
  ]);

  const snagBy = new Map<string, { critical: number; major: number }>();
  for (const s of openSnags) {
    const e = snagBy.get(s.projectId) ?? { critical: 0, major: 0 };
    if (s.severity === "CRITICAL") e.critical++; else if (s.severity === "MAJOR") e.major++;
    snagBy.set(s.projectId, e);
  }
  const estimateBy = new Map<string, number>();
  for (const p of projections) if (!estimateBy.has(p.projectId)) estimateBy.set(p.projectId, num(p.totalCapex)); // first = latest (desc)
  const committedBy = new Map<string, number>();
  for (const p of pos) committedBy.set(p.projectId, (committedBy.get(p.projectId) ?? 0) + num(p.amount));

  const now = Date.now();
  const rows = projects.map((p) => {
    const snags = snagBy.get(p.id) ?? { critical: 0, major: 0 };
    const estimate = estimateBy.get(p.id) ?? 0;
    const committed = committedBy.get(p.id) ?? 0;
    const overBudget = estimate > 0 && committed > estimate;
    const overdue = !!p.targetReadyDate && p.targetReadyDate.getTime() < now;
    const atRisk = snags.critical > 0 || overBudget || overdue;
    return {
      id: p.id, name: p.property?.propertyName ?? "Venue", city: p.property?.city ?? "",
      phase: p.phase, targetReadyDate: p.targetReadyDate,
      openCritical: snags.critical, openMajor: snags.major,
      estimate, committed, overBudget, overdue, atRisk,
    };
  });

  return {
    rows,
    summary: {
      total: rows.length,
      atRisk: rows.filter((r) => r.atRisk).length,
      openCritical: rows.reduce((s, r) => s + r.openCritical, 0),
      committed: rows.reduce((s, r) => s + r.committed, 0),
      estimate: rows.reduce((s, r) => s + r.estimate, 0),
    },
  };
}
