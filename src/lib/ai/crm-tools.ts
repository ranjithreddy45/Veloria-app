import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfWeek, startOfMonth, subMonths, startOfQuarter, endOfDay, endOfWeek, endOfMonth, endOfQuarter } from "date-fns";
import { chatCompletionWithSystem } from "./openai-client";
import { buildEmailSystemPrompt } from "./system-prompt";

// ============================================================
// Date range helper
// ============================================================

function getDateRange(range?: string): { gte?: Date; lte?: Date } | undefined {
  if (!range) return undefined;
  const now = new Date();
  switch (range) {
    case "today":
      return { gte: startOfDay(now), lte: endOfDay(now) };
    case "this_week":
      return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
    case "this_month":
      return { gte: startOfMonth(now), lte: endOfMonth(now) };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return { gte: startOfMonth(lastMonth), lte: endOfMonth(lastMonth) };
    }
    case "this_quarter":
      return { gte: startOfQuarter(now), lte: endOfQuarter(now) };
    default:
      return undefined;
  }
}

// ============================================================
// CRM Tool Definitions (OpenAI function-calling format)
// ============================================================

export const CRM_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "getLeadsData",
      description: "Get leads from the CRM with optional filters. Returns lead summaries including title, status, source, contact name, estimated value, score, and creation date.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"],
            description: "Filter by lead status",
          },
          dateRange: {
            type: "string",
            enum: ["today", "this_week", "this_month", "last_month", "this_quarter"],
            description: "Filter by creation date range",
          },
          source: {
            type: "string",
            enum: ["WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "PHONE_INQUIRY", "EMAIL", "EVENT", "PARTNER", "ADVERTISEMENT", "OTHER"],
            description: "Filter by lead source",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDealsData",
      description: "Get deals from the sales pipeline with optional filters. Returns deal summaries including title, value, probability, stage, contact, and assigned user.",
      parameters: {
        type: "object",
        properties: {
          stage: {
            type: "string",
            description: "Filter by pipeline stage name",
          },
          dateRange: {
            type: "string",
            enum: ["today", "this_week", "this_month", "last_month", "this_quarter"],
            description: "Filter by creation date range",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getBookingsData",
      description: "Get event bookings with optional filters. Returns booking summaries including event date, status, venue, total amount, and guest count.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
            description: "Filter by booking status",
          },
          dateRange: {
            type: "string",
            enum: ["today", "this_week", "this_month", "last_month", "this_quarter"],
            description: "Filter by event date range",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getContactCommunications",
      description: "Get recent communications for a specific contact. Returns the last 10 messages including type, subject, content snippet, direction, and date.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "The contact ID to get communications for",
          },
        },
        required: ["contactId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getRevenueStats",
      description: "Get revenue statistics from completed payments. Returns this month, last month, this quarter, and all-time totals.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getPipelineSummary",
      description: "Get a summary of the sales pipeline grouped by stage. Returns stage name, deal count, total value, and average probability for each stage.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getUpcomingEvents",
      description: "Get the next upcoming bookings/events. Returns event date, status, venue, total amount, and guest count.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of upcoming events to return (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getOverdueTasks",
      description: "Get tasks that are overdue (past due date and not completed). Returns title, due date, assigned person, and priority.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchContacts",
      description: "Search for contacts by name, email, or phone number. Returns matching contacts with their details and lead count.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term to match against name, email, or phone",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draftEmail",
      description: "Draft an email for a contact. Provide the contact ID, desired tone, and optional context. Returns a subject line and HTML body.",
      parameters: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            description: "Contact ID to draft the email for",
          },
          tone: {
            type: "string",
            enum: ["professional", "friendly", "urgent", "follow_up"],
            description: "Tone of the email",
          },
          context: {
            type: "string",
            description: "Additional context for the email (e.g., purpose, specific details to mention)",
          },
        },
        required: ["contactId", "tone"],
      },
    },
  },
];

// ============================================================
// Tool Executor
// ============================================================

export async function executeCRMTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "getLeadsData":
        return await getLeadsData(args);
      case "getDealsData":
        return await getDealsData(args);
      case "getBookingsData":
        return await getBookingsData(args);
      case "getContactCommunications":
        return await getContactCommunications(args);
      case "getRevenueStats":
        return await getRevenueStats();
      case "getPipelineSummary":
        return await getPipelineSummary();
      case "getUpcomingEvents":
        return await getUpcomingEvents(args);
      case "getOverdueTasks":
        return await getOverdueTasks();
      case "searchContacts":
        return await searchContacts(args);
      case "draftEmail":
        return await draftEmail(args);
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    console.error(`[CRM Tool Error] ${name}:`, error);
    return JSON.stringify({ error: `Failed to execute ${name}: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
}

// ============================================================
// Tool Implementations
// ============================================================

async function getLeadsData(args: Record<string, unknown>): Promise<string> {
  const dateRange = getDateRange(args.dateRange as string | undefined);

  const where: Record<string, unknown> = {};
  if (args.status) where.status = args.status;
  if (args.source) where.source = args.source;
  if (dateRange) where.createdAt = dateRange;

  const leads = await prisma.lead.findMany({
    where,
    include: {
      contact: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const summary = leads.map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    source: l.source,
    contactName: `${l.contact.firstName} ${l.contact.lastName}`,
    estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
    score: l.score,
    createdAt: l.createdAt.toISOString().split("T")[0],
  }));

  return JSON.stringify({ count: leads.length, leads: summary });
}

async function getDealsData(args: Record<string, unknown>): Promise<string> {
  const dateRange = getDateRange(args.dateRange as string | undefined);

  const where: Record<string, unknown> = {};
  if (args.stage) {
    where.stage = { name: { contains: args.stage as string, mode: "insensitive" } };
  }
  if (dateRange) where.createdAt = dateRange;

  const deals = await prisma.deal.findMany({
    where,
    include: {
      stage: { select: { name: true } },
      lead: {
        include: {
          contact: { select: { firstName: true, lastName: true } },
        },
      },
      assignedTo: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const summary = deals.map((d) => ({
    id: d.id,
    title: d.title,
    value: Number(d.value),
    probability: d.probability,
    stage: d.stage.name,
    contactName: `${d.lead.contact.firstName} ${d.lead.contact.lastName}`,
    assignedTo: d.assignedTo?.name ?? "Unassigned",
  }));

  const pipelineTotal = summary.reduce((sum, d) => sum + d.value, 0);

  return JSON.stringify({ count: deals.length, pipelineTotal, deals: summary });
}

async function getBookingsData(args: Record<string, unknown>): Promise<string> {
  const dateRange = getDateRange(args.dateRange as string | undefined);

  const where: Record<string, unknown> = {};
  if (args.status) where.status = args.status;
  if (dateRange) where.date = dateRange;

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      venue: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 25,
  });

  const summary = bookings.map((b) => ({
    id: b.id,
    eventName: b.eventName,
    eventDate: b.date.toISOString().split("T")[0],
    status: b.status,
    venueName: b.venue.name,
    totalAmount: Number(b.totalAmount),
    guestCount: b.guestCount,
  }));

  return JSON.stringify({ count: bookings.length, bookings: summary });
}

async function getContactCommunications(args: Record<string, unknown>): Promise<string> {
  const contactId = args.contactId as string;

  const communications = await prisma.communication.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const summary = communications.map((c) => ({
    id: c.id,
    type: c.type,
    subject: c.subject,
    contentSnippet: c.content.slice(0, 150) + (c.content.length > 150 ? "..." : ""),
    direction: c.direction,
    createdAt: c.createdAt.toISOString().split("T")[0],
  }));

  return JSON.stringify({ count: communications.length, communications: summary });
}

async function getRevenueStats(): Promise<string> {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthDate = subMonths(now, 1);
  const lastMonthStart = startOfMonth(lastMonthDate);
  const lastMonthEnd = endOfMonth(lastMonthDate);
  const thisQuarterStart = startOfQuarter(now);
  const thisQuarterEnd = endOfQuarter(now);

  const [thisMonth, lastMonth, thisQuarter, total] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED", paidAt: { gte: thisMonthStart, lte: thisMonthEnd } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED", paidAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED", paidAt: { gte: thisQuarterStart, lte: thisQuarterEnd } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" },
    }),
  ]);

  return JSON.stringify({
    thisMonth: Number(thisMonth._sum.amount ?? 0),
    lastMonth: Number(lastMonth._sum.amount ?? 0),
    thisQuarter: Number(thisQuarter._sum.amount ?? 0),
    total: Number(total._sum.amount ?? 0),
  });
}

async function getPipelineSummary(): Promise<string> {
  const stages = await prisma.pipelineStage.findMany({
    orderBy: { order: "asc" },
    include: {
      deals: {
        select: { value: true, probability: true },
      },
    },
  });

  const summary = stages.map((s) => ({
    stageName: s.name,
    dealCount: s.deals.length,
    totalValue: s.deals.reduce((sum, d) => sum + Number(d.value), 0),
    avgProbability: s.deals.length > 0
      ? Math.round(s.deals.reduce((sum, d) => sum + d.probability, 0) / s.deals.length)
      : 0,
  }));

  return JSON.stringify({ stages: summary });
}

async function getUpcomingEvents(args: Record<string, unknown>): Promise<string> {
  const limit = (args.limit as number) || 10;

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: startOfDay(new Date()) },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    include: {
      venue: { select: { name: true } },
    },
    orderBy: { date: "asc" },
    take: limit,
  });

  const summary = bookings.map((b) => ({
    id: b.id,
    eventName: b.eventName,
    eventDate: b.date.toISOString().split("T")[0],
    status: b.status,
    venueName: b.venue.name,
    totalAmount: Number(b.totalAmount),
    guestCount: b.guestCount,
  }));

  return JSON.stringify({ count: bookings.length, upcomingEvents: summary });
}

async function getOverdueTasks(): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { lt: startOfDay(new Date()) },
      status: { not: "DONE" },
    },
    include: {
      assignee: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 20,
  });

  const summary = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate?.toISOString().split("T")[0] ?? null,
    assignedToName: t.assignee?.name ?? "Unassigned",
    priority: t.priority,
    status: t.status,
  }));

  return JSON.stringify({ count: tasks.length, overdueTasks: summary });
}

async function searchContacts(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;

  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { company: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      _count: { select: { leads: true } },
    },
    take: 15,
  });

  const summary = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    email: c.email,
    phone: c.phone,
    company: c.company,
    type: c.type,
    leadCount: c._count.leads,
  }));

  return JSON.stringify({ count: contacts.length, contacts: summary });
}

async function draftEmail(args: Record<string, unknown>): Promise<string> {
  const contactId = args.contactId as string;
  const tone = (args.tone as string) || "professional";
  const context = (args.context as string) || "";

  // Get contact details
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      leads: { orderBy: { createdAt: "desc" }, take: 1 },
      bookings: { orderBy: { createdAt: "desc" }, take: 1, include: { venue: { select: { name: true } } } },
    },
  });

  if (!contact) {
    return JSON.stringify({ error: "Contact not found" });
  }

  const contactContext = [
    `Contact: ${contact.firstName} ${contact.lastName}`,
    contact.email ? `Email: ${contact.email}` : null,
    contact.company ? `Company: ${contact.company}` : null,
    contact.leads[0] ? `Latest Lead: ${contact.leads[0].title} (${contact.leads[0].status})` : null,
    contact.bookings[0] ? `Latest Booking: ${contact.bookings[0].eventName} at ${contact.bookings[0].venue.name} on ${contact.bookings[0].date.toISOString().split("T")[0]}` : null,
    context ? `Additional context: ${context}` : null,
  ].filter(Boolean).join("\n");

  const systemPrompt = buildEmailSystemPrompt(tone);
  const result = await chatCompletionWithSystem({
    system: systemPrompt,
    user: contactContext,
    temperature: 0.7,
  });

  return result;
}
