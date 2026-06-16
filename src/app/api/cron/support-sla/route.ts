import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// ============================================================
// Cron · Support ticket SLA escalation
// ------------------------------------------------------------
// Flags open/in-progress tickets that have blown their priority-based
// first-response SLA and haven't been escalated yet. Notifies the assignee
// (or the support managers if unassigned) exactly once — `slaEscalatedAt`
// dedupes so we don't re-alert every run. Idempotent; safe to run repeatedly.
// ============================================================

// SLA target (hours from creation) by priority.
const SLA_HOURS: Record<string, number> = {
  URGENT: 2,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 72,
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    !authHeader ||
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Candidate tickets: still open, never escalated.
  const open = await prisma.supportTicket.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      slaEscalatedAt: null,
      resolvedAt: null,
    },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      priority: true,
      assignedToId: true,
      createdAt: true,
    },
  });

  // Support managers — fallback recipients when a ticket is unassigned.
  const managers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["OPERATIONS", "ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });

  let escalated = 0;
  for (const t of open) {
    const slaHours = SLA_HOURS[t.priority] ?? SLA_HOURS.MEDIUM;
    const dueBy = new Date(t.createdAt.getTime() + slaHours * 60 * 60 * 1000);
    if (now < dueBy) continue; // still within SLA

    const recipients = t.assignedToId ? [t.assignedToId] : managers.map((m) => m.id);
    for (const userId of recipients) {
      notify({
        userId,
        type: "SLA_WARNING",
        title: `Support SLA breached — ${t.ticketNumber}`,
        message: `"${t.subject}" (${t.priority}) has passed its ${slaHours}h response SLA and is still unresolved.`,
        actionUrl: `/support/${t.id}`,
      });
    }

    await prisma.supportTicket.update({
      where: { id: t.id },
      data: { slaEscalatedAt: now },
    });
    escalated++;
  }

  return NextResponse.json({ success: true, ranAt: now.toISOString(), checked: open.length, escalated });
}
