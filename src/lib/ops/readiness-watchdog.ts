// ============================================================
// Event Readiness Watchdog — turn advisory flags into human escalations.
// ------------------------------------------------------------
// The ops module computes readiness, assigns tasks, and tracks vendors — but a
// flag sitting red on a screen no one watches doesn't prevent a failed event.
// This daily sweep (runs on the native Vercel cron — NO frequent pinger needed)
// looks at every event in the next few days and, for any that still has gaps —
// unassigned mandatory tasks, unconfirmed vendors, un-received procurement, a
// degraded data plan (no quotation), or no human sign-off as the day nears —
// ESCALATES a consolidated alert to the Ops Head + the booking owner. Throttled
// to ~once a day per event via EventOperation.lastWatchdogAlertAt.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { computeOperationReadiness } from "@/lib/ops/state-machine";
import { loadBookingMenu } from "@/lib/ops/beo-content";

const HORIZON_DAYS = 3; // look at events happening within this many days
const ALERT_THROTTLE_MS = 18 * 3_600_000; // re-escalate at most ~once a day

export interface WatchdogResult {
  scanned: number;
  escalated: number;
  issuesByBooking: { bookingNumber: string; issues: string[] }[];
}

function opsHeadRoles(): string[] {
  return ["OPERATIONS", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"];
}

/** Run one readiness-watchdog sweep. Best-effort; never throws. */
export async function runEventReadinessWatchdog(): Promise<WatchdogResult> {
  const out: WatchdogResult = { scanned: 0, escalated: 0, issuesByBooking: [] };
  try {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const horizon = new Date(todayUtc.getTime() + HORIZON_DAYS * 86_400_000);

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        date: { gte: todayUtc, lte: horizon },
      },
      select: {
        id: true, bookingNumber: true, eventName: true, date: true, guestCount: true, createdById: true,
        operation: { select: { id: true, opsProvisionedAt: true, signedOffAt: true, lastWatchdogAlertAt: true } },
      },
      orderBy: { date: "asc" },
      take: 200,
    });
    out.scanned = bookings.length;
    if (bookings.length === 0) return out;

    // Resolve Ops Head recipients once.
    const heads = await prisma.user.findMany({
      where: { isActive: true, role: { in: opsHeadRoles() as never } },
      select: { id: true },
    });
    const headIds = heads.map((h) => h.id);

    const msNow = now.getTime();
    for (const b of bookings) {
      try {
        const op = b.operation;
        const issues: string[] = [];

        if (!op || !op.opsProvisionedAt) {
          issues.push("Ops not provisioned yet (no execution plan / function sheet)");
        }

        if (op) {
          // Orphaned MANDATORY tasks (nobody owns them).
          const orphaned = await prisma.executionTask.count({
            where: { isMandatory: true, status: { not: "COMPLETED" }, assigneeId: null, phase: { plan: { bookingId: b.id } } },
          });
          if (orphaned > 0) issues.push(`${orphaned} mandatory task${orphaned > 1 ? "s" : ""} unassigned (no owner)`);

          // Unconfirmed vendors.
          const unconfirmedVendors = await prisma.operationVendorAssignment.count({
            where: { operationId: op.id, status: { not: "CONFIRMED" } },
          });
          if (unconfirmedVendors > 0) issues.push(`${unconfirmedVendors} vendor${unconfirmedVendors > 1 ? "s" : ""} not yet confirmed`);

          // Procurement still open (not received / rejected).
          const openPr = await prisma.purchaseRequisition.count({
            where: { bookingId: b.id, status: { in: ["PENDING", "APPROVED", "ORDERED"] } },
          });
          if (openPr > 0) issues.push(`${openPr} procurement requisition${openPr > 1 ? "s" : ""} not yet received`);

          // Overall readiness gates.
          const readiness = await computeOperationReadiness(op.id);
          if (readiness && !readiness.canGoLive) {
            const blocking = readiness.gates.filter((g) => g.required && !g.ready).map((g) => g.label);
            if (blocking.length) issues.push(`Readiness blocked: ${blocking.join(", ")}`);
          }

          // No human sign-off as the event gets close (≤ 36h out).
          const hoursToEvent = (new Date(b.date).getTime() - msNow) / 3_600_000;
          if (!op.signedOffAt && hoursToEvent <= 36) {
            issues.push("Not signed off by Ops — needs final go-ahead");
          }
        }

        // Data quality: a confirmed event with no menu/quotation runs on a generic plan.
        const menu = await loadBookingMenu(b.id, b.guestCount ?? 0);
        if (!menu) issues.push("No menu found from a quotation — plan is generic, confirm the order");
        if ((b.guestCount ?? 0) <= 0) issues.push("Guest count is missing/zero — kitchen & seating can't be sized");

        if (issues.length === 0) continue;
        out.issuesByBooking.push({ bookingNumber: b.bookingNumber, issues });

        // Throttle: don't re-alert the same event more than ~once a day.
        const last = op?.lastWatchdogAlertAt ? new Date(op.lastWatchdogAlertAt).getTime() : 0;
        if (msNow - last < ALERT_THROTTLE_MS) continue;

        const dateStr = new Date(b.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
        const body = `${b.eventName} (${b.bookingNumber}) on ${dateStr} needs attention:\n• ${issues.join("\n• ")}`;
        const recipients = new Set<string>([...headIds, b.createdById].filter(Boolean));
        for (const userId of recipients) {
          await notifyAwait({
            userId,
            type: "SYSTEM",
            title: `⚠️ Event readiness — ${b.bookingNumber} (${dateStr})`,
            message: body,
            actionUrl: `/bookings/${b.id}/control`,
          }).catch(() => {});
        }
        if (op) {
          await prisma.eventOperation.update({ where: { id: op.id }, data: { lastWatchdogAlertAt: now } }).catch(() => {});
        }
        out.escalated++;
      } catch (e) {
        console.error("[readiness-watchdog] booking error:", b.id, e);
      }
    }
  } catch (e) {
    console.error("[readiness-watchdog] error:", e);
  }
  return out;
}
