"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Types
// ============================================================

export interface TimelineItem {
  id: string;
  type:
    | "communication"
    | "booking"
    | "invoice"
    | "payment"
    | "quote"
    | "deal"
    | "whatsapp"
    | "contract"
    | "task"
    | "lead";
  title: string;
  description: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
  entityId: string;
  entityUrl: string | null;
}

export interface Contact360TimelineResult {
  items: TimelineItem[];
  total: number;
  hasMore: boolean;
}

// ============================================================
// Contact 360° Timeline
// ============================================================

export async function getContact360Timeline(
  contactId: string,
  page = 1,
  limit = 20,
  filterTypes?: string[]
): Promise<
  | { success: true; data: Contact360TimelineResult }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "contacts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const items: TimelineItem[] = [];

    // Build type filter set
    const types = filterTypes && filterTypes.length > 0 ? new Set(filterTypes) : null;

    // ── 1. Communications ──
    if (!types || types.has("communication")) {
      const communications = await prisma.communication.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          subject: true,
          content: true,
          direction: true,
          createdAt: true,
          bookingId: true,
        },
      });
      for (const c of communications) {
        items.push({
          id: c.id,
          type: "communication",
          title: c.subject || `${c.type} — ${c.direction}`,
          description: c.content.length > 200 ? c.content.slice(0, 200) + "…" : c.content,
          timestamp: c.createdAt.toISOString(),
          metadata: { commType: c.type, direction: c.direction, bookingId: c.bookingId },
          entityId: c.id,
          entityUrl: null,
        });
      }
    }

    // ── 2. Bookings ──
    if (!types || types.has("booking")) {
      const bookings = await prisma.booking.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          bookingNumber: true,
          eventName: true,
          eventType: true,
          status: true,
          date: true,
          totalAmount: true,
          createdAt: true,
          venue: { select: { name: true } },
        },
      });
      for (const b of bookings) {
        items.push({
          id: b.id,
          type: "booking",
          title: `${b.eventName} (${b.bookingNumber})`,
          description: `${b.eventType} at ${b.venue.name} — ${b.status}`,
          timestamp: b.createdAt.toISOString(),
          metadata: {
            status: b.status,
            eventDate: b.date.toISOString(),
            totalAmount: Number(b.totalAmount),
            venue: b.venue.name,
          },
          entityId: b.id,
          entityUrl: `/bookings/${b.id}`,
        });
      }
    }

    // ── 3. Invoices + Payments ──
    if (!types || types.has("invoice") || types.has("payment")) {
      const invoices = await prisma.invoice.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        include: {
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              status: true,
              method: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      });
      for (const inv of invoices) {
        if (!types || types.has("invoice")) {
          items.push({
            id: inv.id,
            type: "invoice",
            title: `Invoice ${inv.invoiceNumber}`,
            description: `${inv.status} — Total: ₹${Number(inv.totalAmount).toLocaleString("en-IN")}`,
            timestamp: inv.createdAt.toISOString(),
            metadata: {
              status: inv.status,
              totalAmount: Number(inv.totalAmount),
              balanceDue: Number(inv.balanceDue),
            },
            entityId: inv.id,
            entityUrl: `/invoices/${inv.id}`,
          });
        }
        if (!types || types.has("payment")) {
          for (const p of inv.payments) {
            items.push({
              id: p.id,
              type: "payment",
              title: `Payment — ₹${Number(p.amount).toLocaleString("en-IN")}`,
              description: `${p.method} — ${p.status}`,
              timestamp: (p.paidAt || p.createdAt).toISOString(),
              metadata: {
                status: p.status,
                method: p.method,
                amount: Number(p.amount),
                invoiceNumber: inv.invoiceNumber,
              },
              entityId: inv.id,
              entityUrl: `/invoices/${inv.id}`,
            });
          }
        }
      }
    }

    // ── 4. Quotes ──
    if (!types || types.has("quote")) {
      const quotes = await prisma.quote.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quoteNumber: true,
          title: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      });
      for (const q of quotes) {
        items.push({
          id: q.id,
          type: "quote",
          title: `Quote ${q.quoteNumber} — ${q.title}`,
          description: `${q.status} — ₹${Number(q.totalAmount).toLocaleString("en-IN")}`,
          timestamp: q.createdAt.toISOString(),
          metadata: { status: q.status, totalAmount: Number(q.totalAmount) },
          entityId: q.id,
          entityUrl: `/quotes/${q.id}`,
        });
      }
    }

    // ── 5. Leads + Deals ──
    if (!types || types.has("lead") || types.has("deal")) {
      const leads = await prisma.lead.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        include: {
          deal: {
            select: {
              id: true,
              title: true,
              value: true,
              stage: { select: { name: true } },
              wonDate: true,
              lostDate: true,
              createdAt: true,
            },
          },
          assignedTo: { select: { name: true } },
        },
      });
      for (const l of leads) {
        if (!types || types.has("lead")) {
          items.push({
            id: l.id,
            type: "lead",
            title: l.title,
            description: `${l.status} — Source: ${l.source.replace(/_/g, " ")}${l.assignedTo ? ` — Assigned to ${l.assignedTo.name}` : ""}`,
            timestamp: l.createdAt.toISOString(),
            metadata: {
              status: l.status,
              source: l.source,
              score: l.score,
              estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
            },
            entityId: l.id,
            entityUrl: `/leads/${l.id}`,
          });
        }
        if (l.deal && (!types || types.has("deal"))) {
          items.push({
            id: l.deal.id,
            type: "deal",
            title: l.deal.title,
            description: `Stage: ${l.deal.stage.name} — ₹${Number(l.deal.value).toLocaleString("en-IN")}`,
            timestamp: l.deal.createdAt.toISOString(),
            metadata: {
              stage: l.deal.stage.name,
              value: Number(l.deal.value),
              wonDate: l.deal.wonDate?.toISOString() || null,
              lostDate: l.deal.lostDate?.toISOString() || null,
            },
            entityId: l.deal.id,
            entityUrl: `/pipeline`,
          });
        }
      }
    }

    // ── 6. WhatsApp Messages ──
    if (!types || types.has("whatsapp")) {
      const whatsappMessages = await prisma.whatsAppMessage.findMany({
        where: { contactId },
        orderBy: { sentAt: "desc" },
        select: {
          id: true,
          content: true,
          direction: true,
          status: true,
          templateName: true,
          sentAt: true,
        },
      });
      for (const w of whatsappMessages) {
        items.push({
          id: w.id,
          type: "whatsapp",
          title: w.templateName
            ? `WhatsApp Template: ${w.templateName}`
            : `WhatsApp Message — ${w.direction}`,
          description: w.content.length > 200 ? w.content.slice(0, 200) + "…" : w.content,
          timestamp: w.sentAt.toISOString(),
          metadata: { direction: w.direction, status: w.status, template: w.templateName },
          entityId: w.id,
          entityUrl: null,
        });
      }
    }

    // ── 7. Contracts ──
    if (!types || types.has("contract")) {
      const contracts = await prisma.contract.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          signedAt: true,
          sentAt: true,
          createdAt: true,
          bookingId: true,
        },
      });
      for (const c of contracts) {
        items.push({
          id: c.id,
          type: "contract",
          title: c.title,
          description: `${c.status}${c.signedAt ? " — Signed" : c.sentAt ? " — Sent" : ""}`,
          timestamp: c.createdAt.toISOString(),
          metadata: { status: c.status, signedAt: c.signedAt?.toISOString(), bookingId: c.bookingId },
          entityId: c.id,
          entityUrl: `/contracts/${c.id}`,
        });
      }
    }

    // ── 8. Tasks (via Bookings) ──
    if (!types || types.has("task")) {
      const contactBookingIds = await prisma.booking.findMany({
        where: { contactId },
        select: { id: true },
      });
      const bookingIds = contactBookingIds.map((b) => b.id);
      if (bookingIds.length > 0) {
        const tasks = await prisma.task.findMany({
          where: { bookingId: { in: bookingIds } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            completedAt: true,
            createdAt: true,
            assignee: { select: { name: true } },
            booking: { select: { eventName: true } },
          },
        });
        for (const t of tasks) {
          items.push({
            id: t.id,
            type: "task",
            title: t.title,
            description: `${t.status} — ${t.priority} priority${t.assignee ? ` — ${t.assignee.name}` : ""}${t.booking ? ` (${t.booking.eventName})` : ""}`,
            timestamp: t.createdAt.toISOString(),
            metadata: {
              status: t.status,
              priority: t.priority,
              dueDate: t.dueDate?.toISOString() || null,
              completedAt: t.completedAt?.toISOString() || null,
            },
            entityId: t.id,
            entityUrl: `/tasks`,
          });
        }
      }
    }

    // ── Sort all items by timestamp descending ──
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = items.length;
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);

    return {
      success: true as const,
      data: serialize({
        items: paginatedItems,
        total,
        hasMore: start + limit < total,
      }),
    };
  } catch (error) {
    console.error("getContact360Timeline error:", error);
    return { success: false as const, error: "Failed to load timeline" };
  }
}
