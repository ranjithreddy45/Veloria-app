import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { sendSMSFireAndForget } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import type { TaskCategory, UserRole } from "@prisma/client";

// ============================================================
// Ops auto-assignment + vendor trigger for a confirmed booking.
//
// When a booking is confirmed (advance paid), its SOP execution tasks must
// land on the RIGHT team automatically, and the vendors working the event must
// be triggered. This module owns both:
//   • buildOpsAssigner()  — round-robins each task to the internal role that
//                            owns its category (so tasks aren't left orphaned).
//   • notifyOpsAssignees() — one TASK_ASSIGNED nudge per assignee.
//   • triggerVendorsForBooking() — alerts attached vendors (their channels) +
//                            the internal vendor-coordination team.
//
// All best-effort: a messaging failure never blocks confirmation.
// ============================================================

export interface BookingEventInfo {
  bookingId: string;
  bookingNumber: string;
  eventName: string;
  dateStr: string;
  slot: string;
  venueName: string;
}

/**
 * Which internal role owns each SOP task category. The categories ARE the
 * "teams" — decor/catering/seating/entertainment are coordinated by event
 * coordinators (who also brief the external vendors), while the operational
 * categories (AV, housekeeping, logistics, security) sit with operations.
 * Tune freely — assignment falls back gracefully if a pool is empty.
 */
const CATEGORY_OWNER_ROLES: Record<TaskCategory, string[]> = {
  DECOR: ["EVENT_COORDINATOR"],
  CATERING: ["EVENT_COORDINATOR"],
  GUEST_SEATING: ["EVENT_COORDINATOR"],
  ENTERTAINMENT: ["EVENT_COORDINATOR"],
  AV: ["OPERATIONS"],
  HOUSEKEEPING: ["OPERATIONS"],
  LOGISTICS: ["OPERATIONS"],
  SECURITY: ["OPERATIONS"],
  GENERAL: ["OPERATIONS", "EVENT_COORDINATOR"],
};

// Roles to fetch once for the round-robin (owners + fallbacks).
const ASSIGNABLE_ROLES: UserRole[] = ["OPERATIONS", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"];

type Candidate = { id: string; role: string };

export interface OpsAssignment {
  userId: string;
  count: number;
}

export interface OpsAssigner {
  /** Resolve an assignee for a task of this category (null if no internal users). */
  assign(category: TaskCategory): string | null;
  /** Per-assignee task counts, for notification fan-out. */
  summary(): OpsAssignment[];
}

/**
 * Build a round-robin assigner over the active internal ops staff. Fetches the
 * candidate pool ONCE; `assign()` is then synchronous so it can be called
 * inside the SOP-instantiation transaction without extra round-trips.
 */
export async function buildOpsAssigner(): Promise<OpsAssigner> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ASSIGNABLE_ROLES } },
    select: { id: true, role: true },
  });

  const byRole = new Map<string, Candidate[]>();
  for (const u of users) {
    const list = byRole.get(u.role) ?? [];
    list.push({ id: u.id, role: u.role });
    byRole.set(u.role, list);
  }
  const ofRoles = (roles: string[]) => roles.flatMap((r) => byRole.get(r) ?? []);

  // Fallback chain so a task is never left unassigned when ANY internal user
  // exists: category owners → general ops → admins.
  const generalOps = ofRoles(["OPERATIONS", "EVENT_COORDINATOR"]);
  const admins = ofRoles(["ADMIN", "SUPER_ADMIN"]);

  const counters = new Map<string, number>();
  const counts = new Map<string, number>();

  return {
    assign(category: TaskCategory): string | null {
      const ownerRoles = CATEGORY_OWNER_ROLES[category] ?? ["OPERATIONS", "EVENT_COORDINATOR"];
      let pool = ofRoles(ownerRoles);
      if (pool.length === 0) pool = generalOps;
      if (pool.length === 0) pool = admins;
      if (pool.length === 0) return null;

      // Round-robin within this category's pool, keyed by the role-set so each
      // team rotates independently.
      const key = ownerRoles.join("+");
      const idx = (counters.get(key) ?? 0) % pool.length;
      counters.set(key, (counters.get(key) ?? 0) + 1);
      const userId = pool[idx].id;
      counts.set(userId, (counts.get(userId) ?? 0) + 1);
      return userId;
    },
    summary(): OpsAssignment[] {
      return [...counts.entries()].map(([userId, count]) => ({ userId, count }));
    },
  };
}

/** One TASK_ASSIGNED nudge per assignee with their task count for the event. */
export function notifyOpsAssignees(assignments: OpsAssignment[], info: BookingEventInfo): void {
  for (const a of assignments) {
    notify({
      userId: a.userId,
      type: "TASK_ASSIGNED",
      title: `Ops tasks assigned — ${info.bookingNumber}`,
      message: `You have ${a.count} task${a.count === 1 ? "" : "s"} for ${info.eventName} on ${info.dateStr} (${info.slot}) at ${info.venueName}. Open the execution checklist to begin.`,
      actionUrl: `/bookings/${info.bookingId}/execution`,
    });
  }
}

/**
 * Trigger the vendor team for a confirmed booking: alert every attached vendor
 * on their own channels (email + WhatsApp + SMS, best-effort) and notify the
 * internal vendor-coordination team in-app so they can confirm / engage vendors.
 * Idempotent at the call site (runs once, after the atomic confirm flip).
 */
export async function triggerVendorsForBooking(bookingId: string, info: BookingEventInfo): Promise<void> {
  try {
    const bookingVendors = await prisma.bookingVendor.findMany({
      where: { bookingId },
      select: {
        role: true,
        status: true,
        vendor: { select: { name: true, email: true, phone: true } },
      },
    });

    // 1) Alert each attached vendor on their own channels.
    for (const bv of bookingVendors) {
      const v = bv.vendor;
      if (!v) continue;
      const roleLine = bv.role ? ` as ${bv.role}` : "";
      const msg =
        `Hi ${v.name}, the event ${info.eventName} (${info.bookingNumber}) is CONFIRMED for ` +
        `${info.dateStr} (${info.slot}) at ${info.venueName}${roleLine}. ` +
        `Please confirm your readiness and arrival plan. — Veloria Grand`;

      if (v.email) {
        sendEmail({
          to: v.email,
          subject: `Confirmed event — ${info.eventName} (${info.bookingNumber})`,
          html:
            `<p>Hi ${v.name},</p>` +
            `<p>The event <strong>${info.eventName}</strong> (${info.bookingNumber}) is <strong>confirmed</strong> for ` +
            `<strong>${info.dateStr}</strong> (${info.slot}) at <strong>${info.venueName}</strong>${roleLine}.</p>` +
            `<p>Please confirm your readiness and share your arrival/setup plan.</p>` +
            `<p>Warm regards,<br/>Veloria Grand</p>`,
        }).catch((e) => console.error("[VENDOR_TRIGGER_EMAIL_ERROR]", e));
      }
      if (v.phone) {
        sendSMSFireAndForget({ to: v.phone, message: msg });
        sendWhatsApp({ to: v.phone, message: msg }).catch((e) =>
          console.error("[VENDOR_TRIGGER_WA_ERROR]", e)
        );
      }
    }

    // 2) Notify the internal vendor-coordination team in-app.
    const coordinators = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "SUPER_ADMIN", "OPERATIONS"] } },
      select: { id: true },
    });
    const vendorSummary =
      bookingVendors.length > 0
        ? `${bookingVendors.length} vendor${bookingVendors.length === 1 ? "" : "s"} to confirm`
        : `No vendors assigned yet — engage vendors`;
    for (const c of coordinators) {
      notify({
        userId: c.id,
        type: "BOOKING_CREATED",
        title: `Vendor coordination — ${info.bookingNumber}`,
        message: `${vendorSummary} for ${info.eventName} on ${info.dateStr} (${info.slot}) at ${info.venueName}.`,
        actionUrl: `/bookings/${info.bookingId}`,
      });
    }
  } catch (e) {
    console.error("[VENDOR_TRIGGER_ERROR]", e);
  }
}
