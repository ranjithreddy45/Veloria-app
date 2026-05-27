"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Types
// ============================================================

export interface SalesSignal {
  id: string;
  category: "lead" | "deal" | "payment" | "booking" | "communication" | "task" | "activity";
  title: string;
  description: string | null;
  timestamp: string;
  icon: string;
  color: string;
  entityUrl: string | null;
  metadata: Record<string, unknown>;
}

export interface SalesSignalsSummary {
  newLeadsToday: number;
  dealsMoved: number;
  paymentsReceived: number;
  tasksCompleted: number;
}

export interface SalesSignalsResult {
  signals: SalesSignal[];
  total: number;
  hasMore: boolean;
}

// ============================================================
// SalesSignals Feed
// ============================================================

export async function getSalesSignals(
  category?: string,
  page = 1,
  limit = 30
): Promise<
  | { success: true; data: SalesSignalsResult }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const signals: SalesSignal[] = [];
    const since = new Date();
    since.setHours(since.getHours() - 72); // Last 72 hours of activity

    const categories = category ? new Set([category]) : null;

    // ── 1. New Leads ──
    if (!categories || categories.has("lead")) {
      const leads = await prisma.lead.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          source: true,
          score: true,
          createdAt: true,
          contact: { select: { firstName: true, lastName: true } },
          assignedTo: { select: { name: true } },
        },
      });
      for (const l of leads) {
        signals.push({
          id: `lead-${l.id}`,
          category: "lead",
          title: `New Lead: ${l.title}`,
          description: `${l.contact.firstName} ${l.contact.lastName} — ${l.source.replace(/_/g, " ")}${l.assignedTo ? ` → ${l.assignedTo.name}` : ""}`,
          timestamp: l.createdAt.toISOString(),
          icon: "UserPlus",
          color: "bg-blue-100 text-blue-700",
          entityUrl: `/leads/${l.id}`,
          metadata: { status: l.status, source: l.source, score: l.score },
        });
      }
    }

    // ── 2. Deal Stage Changes (via Activity Log) ──
    if (!categories || categories.has("deal")) {
      const dealActivities = await prisma.activityLog.findMany({
        where: {
          entityType: "deal",
          createdAt: { gte: since },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          entityId: true,
          changes: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      });
      for (const a of dealActivities) {
        signals.push({
          id: `deal-${a.id}`,
          category: "deal",
          title: `Deal ${a.action.replace(/_/g, " ").toLowerCase()}`,
          description: `by ${a.user.name || "System"}`,
          timestamp: a.createdAt.toISOString(),
          icon: "TrendingUp",
          color: "bg-purple-100 text-purple-700",
          entityUrl: `/pipeline`,
          metadata: { action: a.action, changes: a.changes },
        });
      }

      // Also new deals
      const newDeals = await prisma.deal.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          value: true,
          createdAt: true,
          stage: { select: { name: true } },
          lead: { select: { contact: { select: { firstName: true, lastName: true } } } },
        },
      });
      for (const d of newDeals) {
        signals.push({
          id: `deal-new-${d.id}`,
          category: "deal",
          title: `New Deal: ${d.title}`,
          description: `${d.lead.contact.firstName} ${d.lead.contact.lastName} — ${d.stage.name} — ₹${Number(d.value).toLocaleString("en-IN")}`,
          timestamp: d.createdAt.toISOString(),
          icon: "Target",
          color: "bg-indigo-100 text-indigo-700",
          entityUrl: `/pipeline`,
          metadata: { stage: d.stage.name, value: Number(d.value) },
        });
      }
    }

    // ── 3. Payments Received ──
    if (!categories || categories.has("payment")) {
      const payments = await prisma.payment.findMany({
        where: {
          status: "COMPLETED",
          paidAt: { gte: since },
        },
        orderBy: { paidAt: "desc" },
        take: 50,
        select: {
          id: true,
          amount: true,
          method: true,
          paidAt: true,
          createdAt: true,
          invoice: {
            select: {
              invoiceNumber: true,
              contact: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
      for (const p of payments) {
        signals.push({
          id: `payment-${p.id}`,
          category: "payment",
          title: `Payment Received: ₹${Number(p.amount).toLocaleString("en-IN")}`,
          description: `${p.invoice.contact.firstName} ${p.invoice.contact.lastName} — ${p.invoice.invoiceNumber} (${p.method})`,
          timestamp: (p.paidAt || p.createdAt).toISOString(),
          icon: "IndianRupee",
          color: "bg-green-100 text-green-700",
          entityUrl: null,
          metadata: { amount: Number(p.amount), method: p.method },
        });
      }
    }

    // ── 4. Bookings ──
    if (!categories || categories.has("booking")) {
      const bookings = await prisma.booking.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          bookingNumber: true,
          eventName: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          contact: { select: { firstName: true, lastName: true } },
          venue: { select: { name: true } },
        },
      });
      for (const b of bookings) {
        signals.push({
          id: `booking-${b.id}`,
          category: "booking",
          title: `Booking: ${b.eventName}`,
          description: `${b.contact.firstName} ${b.contact.lastName} — ${b.venue.name} (${b.status})`,
          timestamp: b.createdAt.toISOString(),
          icon: "CalendarCheck",
          color: "bg-amber-100 text-amber-700",
          entityUrl: `/bookings/${b.id}`,
          metadata: { status: b.status, amount: Number(b.totalAmount) },
        });
      }
    }

    // ── 5. Communications ──
    if (!categories || categories.has("communication")) {
      const comms = await prisma.communication.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          subject: true,
          direction: true,
          createdAt: true,
          contact: { select: { firstName: true, lastName: true } },
        },
      });
      for (const c of comms) {
        signals.push({
          id: `comm-${c.id}`,
          category: "communication",
          title: `${c.type} — ${c.direction}`,
          description: `${c.contact.firstName} ${c.contact.lastName}${c.subject ? ` — ${c.subject}` : ""}`,
          timestamp: c.createdAt.toISOString(),
          icon: "MessageSquare",
          color: "bg-sky-100 text-sky-700",
          entityUrl: null,
          metadata: { commType: c.type, direction: c.direction },
        });
      }
    }

    // ── 6. Tasks Completed ──
    if (!categories || categories.has("task")) {
      const tasks = await prisma.task.findMany({
        where: {
          status: "DONE",
          completedAt: { gte: since },
        },
        orderBy: { completedAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          priority: true,
          completedAt: true,
          createdAt: true,
          assignee: { select: { name: true } },
          booking: { select: { eventName: true } },
        },
      });
      for (const t of tasks) {
        signals.push({
          id: `task-${t.id}`,
          category: "task",
          title: `Task Completed: ${t.title}`,
          description: `${t.assignee?.name || "Unassigned"}${t.booking ? ` — ${t.booking.eventName}` : ""}`,
          timestamp: (t.completedAt || t.createdAt).toISOString(),
          icon: "CheckCircle",
          color: "bg-emerald-100 text-emerald-700",
          entityUrl: `/tasks`,
          metadata: { priority: t.priority },
        });
      }
    }

    // ── Sort all signals by timestamp descending ──
    signals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = signals.length;
    const start = (page - 1) * limit;
    const paginatedSignals = signals.slice(start, start + limit);

    return {
      success: true as const,
      data: serialize({
        signals: paginatedSignals,
        total,
        hasMore: start + limit < total,
      }),
    };
  } catch (error) {
    console.error("getSalesSignals error:", error);
    return { success: false as const, error: "Failed to load signals" };
  }
}

// ============================================================
// SalesSignals Summary
// ============================================================

export async function getSalesSignalsSummary(): Promise<
  | { success: true; data: SalesSignalsSummary }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "analytics:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [newLeadsToday, dealsMoved, paymentsReceived, tasksCompleted] =
      await Promise.all([
        prisma.lead.count({
          where: { createdAt: { gte: todayStart } },
        }),
        prisma.activityLog.count({
          where: {
            entityType: "deal",
            createdAt: { gte: todayStart },
          },
        }),
        prisma.payment.count({
          where: {
            status: "COMPLETED",
            paidAt: { gte: todayStart },
          },
        }),
        prisma.task.count({
          where: {
            status: "DONE",
            completedAt: { gte: todayStart },
          },
        }),
      ]);

    return {
      success: true as const,
      data: { newLeadsToday, dealsMoved, paymentsReceived, tasksCompleted },
    };
  } catch (error) {
    console.error("getSalesSignalsSummary error:", error);
    return { success: false as const, error: "Failed to load summary" };
  }
}
