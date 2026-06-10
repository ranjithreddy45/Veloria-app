import type OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfWeek, startOfMonth, subMonths, startOfQuarter, endOfDay, endOfWeek, endOfMonth, endOfQuarter } from "date-fns";
import { chatCompletionWithSystem } from "./openai-client";
import { buildEmailSystemPrompt } from "./system-prompt";
import { hasPermission, type Permission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Tool execution context — who is asking, and from where
// ============================================================
// Threaded into every tool so write tools act AS the user (createdById),
// enforce the same RBAC as the rest of the app, and so the assistant can
// reason about the page/entity the user is currently looking at.

export interface ToolContext {
  userId: string;
  userName: string;
  role: string;
  path?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
}

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
  {
    type: "function",
    function: {
      name: "getVenues",
      description: "List the company's venues with their id, name, and capacity. Use this to resolve a venue name to an id before checking availability.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "checkVenueAvailability",
      description: "Check whether a venue is available on a given date and time slot before promising a date to a client. Provide either venueId or venueName.",
      parameters: {
        type: "object",
        properties: {
          venueId: { type: "string", description: "The venue id (preferred)." },
          venueName: { type: "string", description: "The venue name, if id is unknown — it will be matched." },
          date: { type: "string", description: "Event date in YYYY-MM-DD format." },
          timeSlot: {
            type: "string",
            enum: ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"],
            description: "The time slot to check.",
          },
        },
        required: ["date", "timeSlot"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getEntityDetail",
      description: "Get a full detail summary of a single lead, contact, deal, or booking — including related context. If the user says 'this lead/contact/booking' and no id is given, omit the arguments to use the record currently open on their screen.",
      parameters: {
        type: "object",
        properties: {
          entityType: { type: "string", enum: ["lead", "contact", "deal", "booking"] },
          entityId: { type: "string", description: "The record id. Omit to use the currently-viewed record." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createTask",
      description: "Create a follow-up task / reminder for the team. Use when the user asks to remember, follow up, or schedule an internal to-do. The task is created as the current user.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title." },
          description: { type: "string", description: "Optional details." },
          dueDate: { type: "string", description: "Optional due date YYYY-MM-DD." },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "logCommunication",
      description: "Log a communication (call, note, meeting, etc.) against a contact — e.g. after the user describes a phone call. Records it on the contact's timeline.",
      parameters: {
        type: "object",
        properties: {
          contactId: { type: "string", description: "Contact id to log against." },
          type: { type: "string", enum: ["NOTE", "CALL", "EMAIL", "SMS", "MEETING", "WHATSAPP"] },
          content: { type: "string", description: "What happened / the note body." },
          subject: { type: "string", description: "Optional short subject." },
          direction: { type: "string", enum: ["INBOUND", "OUTBOUND"] },
        },
        required: ["contactId", "type", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createLeadEnquiry",
      description: "Capture a new enquiry. Finds an existing contact by phone/email or creates one, then creates a Lead attached to it. Ideal for logging a fresh phone/walk-in enquiry in one step.",
      parameters: {
        type: "object",
        properties: {
          contactFirstName: { type: "string" },
          contactLastName: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          leadTitle: { type: "string", description: "Short description, e.g. 'Dec wedding, 300 pax'." },
          eventType: { type: "string", description: "e.g. Wedding, Sangeet, Reception." },
          eventDate: { type: "string", description: "YYYY-MM-DD if known." },
          guestCount: { type: "number" },
          estimatedValue: { type: "number", description: "Estimated value in INR." },
          source: {
            type: "string",
            enum: ["WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "PHONE_INQUIRY", "EMAIL", "EVENT", "PARTNER", "ADVERTISEMENT", "WHATSAPP", "INSTAGRAM", "OTHER"],
          },
        },
        required: ["contactFirstName", "leadTitle"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moveDealStage",
      description: "Move a deal to a different pipeline stage. Provide the deal id and the target stage name (matched case-insensitively).",
      parameters: {
        type: "object",
        properties: {
          dealId: { type: "string" },
          stageName: { type: "string", description: "Target stage, e.g. 'Quote Sent', 'Token Paid'." },
        },
        required: ["dealId", "stageName"],
      },
    },
  },
];

// ============================================================
// Tool Executor
// ============================================================

export async function executeCRMTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: ToolContext
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
      case "getVenues":
        return await getVenues();
      case "checkVenueAvailability":
        return await checkVenueAvailabilityTool(args);
      case "getEntityDetail":
        return await getEntityDetail(args, ctx);
      // ---- write tools (permission-checked, act as the current user) ----
      case "createTask":
        return await createTaskTool(args, ctx);
      case "logCommunication":
        return await logCommunicationTool(args, ctx);
      case "createLeadEnquiry":
        return await createLeadEnquiryTool(args, ctx);
      case "moveDealStage":
        return await moveDealStageTool(args, ctx);
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    console.error(`[CRM Tool Error] ${name}:`, error);
    return JSON.stringify({ error: `Failed to execute ${name}: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
}

// Guard used by write tools — returns an error JSON string if the actor
// lacks the permission, otherwise null.
function requirePermission(ctx: ToolContext | undefined, perm: Permission): string | null {
  if (!ctx?.userId) {
    return JSON.stringify({ error: "No user context — cannot perform this action." });
  }
  if (!hasPermission(ctx.role, perm)) {
    return JSON.stringify({ error: `You don't have permission to do this (${perm}).` });
  }
  return null;
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

// ============================================================
// New read tools
// ============================================================

async function getVenues(): Promise<string> {
  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true, capacity: true },
    orderBy: { name: "asc" },
  });
  return JSON.stringify({ count: venues.length, venues });
}

async function checkVenueAvailabilityTool(args: Record<string, unknown>): Promise<string> {
  const dateStr = args.date as string;
  const timeSlot = (args.timeSlot as string) || "FULL_DAY";
  let venueId = args.venueId as string | undefined;
  const venueName = args.venueName as string | undefined;

  if (!venueId && venueName) {
    const v = await prisma.venue.findFirst({
      where: { name: { contains: venueName, mode: "insensitive" }, isActive: true },
      select: { id: true, name: true },
    });
    if (!v) return JSON.stringify({ error: `No venue matched "${venueName}".` });
    venueId = v.id;
  }
  if (!venueId) return JSON.stringify({ error: "Provide a venueId or venueName." });

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return JSON.stringify({ error: "Invalid date." });
  date.setHours(0, 0, 0, 0);

  const slotConflicts =
    timeSlot === "FULL_DAY"
      ? ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"]
      : [timeSlot, "FULL_DAY"];

  const conflict = await prisma.booking.findFirst({
    where: {
      venueId,
      date,
      status: { notIn: ["CANCELLED"] },
      timeSlot: { in: slotConflicts as never },
    },
    select: { eventName: true, timeSlot: true, status: true },
  });

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { name: true } });

  return JSON.stringify({
    venue: venue?.name,
    date: dateStr,
    timeSlot,
    available: !conflict,
    reason: conflict
      ? `Already booked: "${conflict.eventName}" (${conflict.timeSlot}, ${conflict.status})`
      : null,
  });
}

async function getEntityDetail(
  args: Record<string, unknown>,
  ctx?: ToolContext
): Promise<string> {
  const entityType = (args.entityType as string) || ctx?.entityType;
  const entityId = (args.entityId as string) || ctx?.entityId;
  if (!entityType || !entityId) {
    return JSON.stringify({
      error: "No entity specified and nothing is open on screen. Ask the user which record they mean.",
    });
  }

  switch (entityType) {
    case "lead": {
      const l = await prisma.lead.findUnique({
        where: { id: entityId },
        include: {
          contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
          assignedTo: { select: { name: true } },
          preferredVenue: { select: { name: true } },
        },
      });
      if (!l) return JSON.stringify({ error: "Lead not found." });
      return JSON.stringify({
        type: "lead",
        title: l.title,
        status: l.status,
        source: l.source,
        score: l.score,
        aiScore: l.aiScore,
        estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
        eventType: l.eventType,
        eventDate: l.eventDate ? l.eventDate.toISOString().split("T")[0] : null,
        guestCount: l.guestCount,
        slot: l.slot,
        vegNonVeg: l.vegNonVeg,
        perPlateBudget: l.perPlateBudget ? Number(l.perPlateBudget) : null,
        preferredVenue: l.preferredVenue?.name ?? null,
        contact: `${l.contact.firstName} ${l.contact.lastName}`,
        contactEmail: l.contact.email,
        contactPhone: l.contact.phone,
        assignedTo: l.assignedTo?.name ?? "Unassigned",
        followUpDate: l.followUpDate ? l.followUpDate.toISOString().split("T")[0] : null,
        description: l.description,
      });
    }
    case "contact": {
      const c = await prisma.contact.findUnique({
        where: { id: entityId },
        include: {
          _count: { select: { leads: true, bookings: true } },
          leads: { orderBy: { createdAt: "desc" }, take: 3, select: { title: true, status: true } },
        },
      });
      if (!c) return JSON.stringify({ error: "Contact not found." });
      return JSON.stringify({
        type: "contact",
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phone: c.phone,
        company: c.company,
        customerType: c.customerType,
        vip: c.vipCustomer,
        lifetimeBookings: c.lifetimeBookings,
        totalRevenue: c.totalRevenue ? Number(c.totalRevenue) : 0,
        lastEventDate: c.lastEventDate ? c.lastEventDate.toISOString().split("T")[0] : null,
        leadCount: c._count.leads,
        bookingCount: c._count.bookings,
        recentLeads: c.leads.map((l) => `${l.title} (${l.status})`),
      });
    }
    case "deal": {
      const d = await prisma.deal.findUnique({
        where: { id: entityId },
        include: {
          stage: { select: { name: true } },
          assignedTo: { select: { name: true } },
          lead: { include: { contact: { select: { firstName: true, lastName: true } } } },
        },
      });
      if (!d) return JSON.stringify({ error: "Deal not found." });
      return JSON.stringify({
        type: "deal",
        title: d.title,
        value: Number(d.value),
        probability: d.probability,
        stage: d.stage.name,
        contact: `${d.lead.contact.firstName} ${d.lead.contact.lastName}`,
        assignedTo: d.assignedTo?.name ?? "Unassigned",
      });
    }
    case "booking": {
      const b = await prisma.booking.findUnique({
        where: { id: entityId },
        include: {
          venue: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true, phone: true } },
        },
      });
      if (!b) return JSON.stringify({ error: "Booking not found." });
      return JSON.stringify({
        type: "booking",
        eventName: b.eventName,
        eventType: b.eventType,
        date: b.date.toISOString().split("T")[0],
        timeSlot: b.timeSlot,
        status: b.status,
        venue: b.venue.name,
        hallBooked: b.hallBooked,
        guestCount: b.guestCount,
        totalAmount: Number(b.totalAmount),
        perPlatePrice: b.perPlatePrice ? Number(b.perPlatePrice) : null,
        contact: `${b.contact.firstName} ${b.contact.lastName}`,
        contactPhone: b.contact.phone,
      });
    }
    default:
      return JSON.stringify({ error: `Unknown entity type: ${entityType}` });
  }
}

// ============================================================
// New write tools (permission-checked, logged, act as the user)
// ============================================================

async function createTaskTool(
  args: Record<string, unknown>,
  ctx?: ToolContext
): Promise<string> {
  const denied = requirePermission(ctx, "tasks:create");
  if (denied) return denied;

  const title = (args.title as string)?.trim();
  if (!title) return JSON.stringify({ error: "Task title is required." });

  const dueStr = args.dueDate as string | undefined;
  const dueDate = dueStr ? new Date(dueStr) : null;

  const task = await prisma.task.create({
    data: {
      title,
      description: (args.description as string) || null,
      dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
      priority: ((args.priority as string) || "MEDIUM") as never,
      creatorId: ctx!.userId,
      assigneeId: ctx!.userId,
    },
    select: { id: true, title: true },
  });

  logActivity({
    userId: ctx!.userId,
    action: "created",
    entityType: "Task",
    entityId: task.id,
    changes: { via: "Veloria AI" },
  });

  return JSON.stringify({ success: true, created: "task", id: task.id, title: task.title, actionUrl: `/tasks` });
}

async function logCommunicationTool(
  args: Record<string, unknown>,
  ctx?: ToolContext
): Promise<string> {
  const denied = requirePermission(ctx, "contacts:update");
  if (denied) return denied;

  const contactId = args.contactId as string;
  const content = (args.content as string)?.trim();
  if (!contactId || !content) return JSON.stringify({ error: "contactId and content are required." });

  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { id: true } });
  if (!contact) return JSON.stringify({ error: "Contact not found." });

  const comm = await prisma.communication.create({
    data: {
      contactId,
      type: ((args.type as string) || "NOTE") as never,
      content,
      subject: (args.subject as string) || null,
      direction: ((args.direction as string) || "OUTBOUND") as never,
      createdById: ctx!.userId,
    },
    select: { id: true },
  });

  logActivity({
    userId: ctx!.userId,
    action: "created",
    entityType: "Communication",
    entityId: comm.id,
    changes: { contactId, via: "Veloria AI" },
  });

  return JSON.stringify({ success: true, created: "communication", id: comm.id, actionUrl: `/contacts/${contactId}` });
}

async function createLeadEnquiryTool(
  args: Record<string, unknown>,
  ctx?: ToolContext
): Promise<string> {
  const denied = requirePermission(ctx, "leads:create");
  if (denied) return denied;

  const firstName = (args.contactFirstName as string)?.trim();
  const leadTitle = (args.leadTitle as string)?.trim();
  if (!firstName || !leadTitle) {
    return JSON.stringify({ error: "contactFirstName and leadTitle are required." });
  }
  const lastName = ((args.contactLastName as string) || "").trim();
  const phone = (args.phone as string) || null;
  const email = (args.email as string) || null;

  // Find an existing contact by phone or email; otherwise create one.
  let contact = null as { id: string } | null;
  if (phone || email) {
    contact = await prisma.contact.findFirst({
      where: {
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
      select: { id: true },
    });
  }
  let contactCreated = false;
  if (!contact) {
    contact = await prisma.contact.create({
      data: { firstName, lastName: lastName || "—", phone, email },
      select: { id: true },
    });
    contactCreated = true;
  }

  const eventDateStr = args.eventDate as string | undefined;
  const eventDate = eventDateStr ? new Date(eventDateStr) : null;

  const lead = await prisma.lead.create({
    data: {
      title: leadTitle,
      contactId: contact.id,
      createdById: ctx!.userId,
      assignedToId: ctx!.userId,
      source: ((args.source as string) || "PHONE_INQUIRY") as never,
      eventType: (args.eventType as string) || null,
      eventDate: eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null,
      guestCount: typeof args.guestCount === "number" ? (args.guestCount as number) : null,
      estimatedValue: typeof args.estimatedValue === "number" ? (args.estimatedValue as number) : null,
    },
    select: { id: true, title: true },
  });

  logActivity({
    userId: ctx!.userId,
    action: "created",
    entityType: "Lead",
    entityId: lead.id,
    changes: { via: "Veloria AI", contactCreated },
  });

  return JSON.stringify({
    success: true,
    created: "lead",
    leadId: lead.id,
    contactId: contact.id,
    contactCreated,
    actionUrl: `/leads/${lead.id}/edit`,
  });
}

async function moveDealStageTool(
  args: Record<string, unknown>,
  ctx?: ToolContext
): Promise<string> {
  const denied = requirePermission(ctx, "pipeline:manage");
  if (denied) return denied;

  const dealId = args.dealId as string;
  const stageName = (args.stageName as string)?.trim();
  if (!dealId || !stageName) return JSON.stringify({ error: "dealId and stageName are required." });

  const [deal, stage] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, title: true } }),
    prisma.pipelineStage.findFirst({
      where: { name: { contains: stageName, mode: "insensitive" } },
      select: { id: true, name: true, isWonStage: true },
    }),
  ]);
  if (!deal) return JSON.stringify({ error: "Deal not found." });
  if (!stage) return JSON.stringify({ error: `No pipeline stage matched "${stageName}".` });

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      stageId: stage.id,
      ...(stage.isWonStage ? { wonDate: new Date() } : {}),
    },
  });

  logActivity({
    userId: ctx!.userId,
    action: "updated",
    entityType: "Deal",
    entityId: dealId,
    changes: { stage: stage.name, via: "Veloria AI" },
  });

  return JSON.stringify({ success: true, updated: "deal", dealId, newStage: stage.name, actionUrl: `/pipeline` });
}
