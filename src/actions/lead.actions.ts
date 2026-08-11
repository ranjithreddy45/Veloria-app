"use server";

import { auth } from "@/../auth";
import { isEnquirySource } from "@/lib/enquiry-source";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { leadSchema, type LeadInput } from "@/schemas/lead.schema";
import { isSafeReceiptDataUrl } from "@/lib/sales/receipt";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
import { runLeadIntake, leadSlaDeadline } from "@/lib/lead-pipeline";
import { resolveBdRange, istDateStr } from "@/lib/acq/analytics-range";
import { after } from "next/server";
// LeadStatus enum values matching Prisma schema
type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";

// Allowed filter values — an invalid enum string passed straight to Prisma throws
// a generic error, so we validate against these sets and ignore unknown values.
const LEAD_STATUS_VALUES = new Set<string>([
  "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST",
]);
const LEAD_SOURCE_VALUES = new Set<string>([
  "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "PHONE_INQUIRY", "EMAIL",
  "EVENT", "PARTNER", "ADVERTISEMENT", "FACEBOOK_ADS", "GOOGLE_ADS", "INDIAMART",
  "JUSTDIAL", "WEDMEGOOD", "INSTAGRAM", "WHATSAPP", "OTHER",
]);

// Roles a lead can be assigned to (mirrors the new/edit form's user list).
const ASSIGNABLE_ROLES = ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"];

// Next business day (skips Sat/Sun) at 09:00 local — used as a default
// follow-up when a lead is created without one, so active leads always surface
// in the Sales Follow-ups queue instead of silently falling out of it (S-11).
function nextBusinessDay(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  // Sat (6) -> Mon, Sun (0) -> Mon
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

// Keep only safe image data-URLs (base64 image/PDF). Anything else — a bare
// string, an https link, a data:text/html payload — is dropped so a tampered
// client can't write an unsafe value into Lead.images. Caps the count too.
function sanitizeLeadImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((v): v is string => typeof v === "string")
    .filter((v) => isSafeReceiptDataUrl(v) && v.startsWith("data:image/"))
    .slice(0, 24);
}

// Returns an error string if the id is not a real, active, assignable user; null if OK.
async function assigneeInvalid(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!u || !u.isActive || !ASSIGNABLE_ROLES.includes(u.role)) {
    return "Assigned user is invalid or not assignable.";
  }
  return null;
}

// ============================================================
// Lead list filters + ownership scoping (shared by the list and its KPIs)
// ============================================================

/**
 * Which leads the list shows. Defaults to "mine" (leads assigned to the signed-in
 * user). "all" and "unassigned" are manager views — see `canSeeAllLeads`.
 * "unassigned" is the routing inbox: leads with no owner yet (assignedToId=null).
 */
export type LeadScope = "mine" | "all" | "unassigned";

export interface LeadListFilters {
  search?: string;
  status?: string;
  source?: string;
  /** Event-date period — IST yyyy-mm-dd, inclusive on both ends. */
  eventFrom?: string;
  eventTo?: string;
  /** Lead-creation period — IST yyyy-mm-dd, inclusive on both ends. */
  createdFrom?: string;
  createdTo?: string;
  /**
   * Marketing channel, from `Contact.enquirySource` — the axis ad spend is
   * reconciled against. "NONE" = no channel recorded.
   */
  enquirySource?: string;
  /** Hall/Property (preferred venue). "UNASSIGNED" → leads with no venue. */
  venueId?: string;
  scope?: LeadScope;
}

/**
 * Ceiling on one page of leads.
 *
 * Deliberately above what any caller asks for (the leads page asks for 500), so
 * the cap is a memory backstop rather than a silent editor of the result set.
 * NOT exported: this is a `"use server"` module, where every export must be an
 * async function — exporting a const builds fine locally and fails on Vercel.
 */
const MAX_LEAD_PAGE_SIZE = 500;

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "All leads" is the lead-manager view. It reuses the EXISTING `leads:assign`
 * permission — the one that already distinguishes a lead manager (SUPER_ADMIN /
 * ADMIN / SALES_HEAD) from a rep who only works their own book — rather than
 * introducing a new permission key.
 */
function canSeeAllLeads(role: string): boolean {
  return hasPermission(role, "leads:assign");
}

/**
 * The absolute [start, end] UTC instants of one IST calendar day. Anchored via
 * the shared BD range resolver so leads use the same IST (+5:30) day boundaries
 * as every other date filter in the app — no bespoke timezone maths here.
 */
function istDayWindow(iso: string | undefined): { start: Date; end: Date } | null {
  if (!iso || !ISO_DAY_RE.test(iso)) return null;
  const r = resolveBdRange("custom", iso, iso);
  // resolveBdRange falls back to "this month" when the pair won't parse, and
  // Date.UTC silently rolls impossible days over (Feb 31 → Mar 3). Reject both by
  // requiring the resolved window to round-trip back to the same IST day.
  if (r.key !== "custom" || istDateStr(r.start) !== iso || istDateStr(r.end) !== iso) {
    return null;
  }
  return { start: r.start, end: r.end };
}

/** Inclusive IST day-range filter; either end may be omitted (open-ended). */
function istRangeFilter(fromISO?: string, toISO?: string): { gte?: Date; lte?: Date } | null {
  const from = istDayWindow(fromISO);
  const to = istDayWindow(toISO);
  if (!from && !to) return null;
  const f: { gte?: Date; lte?: Date } = {};
  if (from) f.gte = from.start; // 00:00:00.000 IST of the "from" day
  if (to) f.lte = to.end; // 23:59:59.999 IST of the "to" day
  return f;
}

/**
 * Builds the list `where` clause plus the EFFECTIVE scope. Scope is resolved
 * server-side from the viewer's role — a client asking for `scope: "all"` without
 * the permission is silently downgraded to "mine", so the query can never widen
 * beyond what the role allows.
 */
function buildLeadListWhere(
  filters: LeadListFilters | undefined,
  viewer: { id: string; role: string }
): { where: Record<string, unknown>; scope: LeadScope; canViewAll: boolean } {
  // Exclude soft-deleted records by default
  const where: Record<string, unknown> = { deletedAt: null };

  // ---- Ownership scoping (server-authoritative) ----
  const canViewAll = canSeeAllLeads(viewer.role);
  // "all" and "unassigned" are manager-only views; a rep asking for either is
  // silently downgraded to "mine" so the query can never widen past their book.
  const requested = filters?.scope;
  const scope: LeadScope =
    (requested === "all" || requested === "unassigned") && canViewAll
      ? requested
      : "mine";
  if (scope === "mine") {
    where.assignedToId = viewer.id;
  } else if (scope === "unassigned") {
    // The routing inbox: leads that landed with no owner. With the capture-side
    // fallback owner this should stay near-empty, but it's the safety net that
    // guarantees an ownerless lead is always one click away, never hidden.
    where.assignedToId = null;
  }
  // scope === "all" → no assignedToId filter (every lead in the company).

  const search = filters?.search?.trim();
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      {
        contact: {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  // Validate enum filters before querying — an unknown string would otherwise
  // make Prisma throw and surface as a generic "Failed to fetch leads".
  if (filters?.status && LEAD_STATUS_VALUES.has(filters.status)) {
    where.status = filters.status;
  }

  if (filters?.source && LEAD_SOURCE_VALUES.has(filters.source)) {
    where.source = filters.source;
  }

  // Marketing channel — the axis ad spend is actually reconciled against.
  //
  // It lives on the CONTACT (`enquirySource`), not the lead, because it records
  // how the PERSON first reached us; `Lead.source` is a different, finer thing
  // (INDIAMART, JUSTDIAL…). Until now leads could not be filtered by channel at
  // all, so "Google Ads says 88 leads in August" was unanswerable from the CRM —
  // you could see the total, but not the slice the number referred to.
  //
  // "NONE" selects contacts with no channel recorded. Those are real and must
  // stay findable: defaulting them into Direct would invent attribution in a
  // report someone spends money against.
  const channel = filters?.enquirySource?.trim();
  if (channel === "NONE") {
    where.contact = { ...(where.contact as Record<string, unknown>), enquirySource: null };
  } else if (isEnquirySource(channel)) {
    where.contact = { ...(where.contact as Record<string, unknown>), enquirySource: channel };
  }

  // Event-date period. eventDate is nullable — a lead with no event date simply
  // falls outside the window (Prisma treats NULL as non-matching for gte/lte).
  const eventRange = istRangeFilter(filters?.eventFrom, filters?.eventTo);
  if (eventRange) where.eventDate = eventRange;

  // Lead-creation period.
  const createdRange = istRangeFilter(filters?.createdFrom, filters?.createdTo);
  if (createdRange) where.createdAt = createdRange;

  // Hall/Property (preferred venue). "UNASSIGNED" is the no-venue bucket; any
  // other non-empty value narrows to that venue (a stale id returns no rows).
  const venueId = filters?.venueId?.trim();
  if (venueId === "UNASSIGNED") {
    where.preferredVenueId = null;
  } else if (venueId) {
    where.preferredVenueId = venueId;
  }

  return { where, scope, canViewAll };
}

// ============================================================
// Get Leads (Paginated + Filters)
// ============================================================

export async function getLeads(params?: LeadListFilters & {
  page?: number;
  limit?: number;
  sort?: "score" | "recent" | "cold"; // default: score (hot-lead worklist)
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = Math.max(1, Math.floor(params?.page ?? 1));
    // Page-size ceiling. This used to be 100 while the leads page asked for 500,
    // so the page rendered 100 rows beside a header reading the TRUE count from
    // getLeadStats — 141 leads announced, 100 findable, and nothing on screen
    // explaining the gap.
    //
    // Worse than the missing count: the default sort is score-descending, so the
    // rows dropped were always the LOWEST-scoring ones. Fresh, unworked, unscored
    // enquiries are exactly what falls off that edge — the leads a rep most needs
    // to see. A cap is not allowed to decide which leads exist.
    //
    // The ceiling is real (a nested include over thousands of rows is a genuine
    // memory concern) but it now sits above what any caller asks for, and
    // `total` is returned so the UI can say when it bites.
    const limit = Math.min(Math.max(1, Math.floor(params?.limit ?? 50)), MAX_LEAD_PAGE_SIZE);
    const skip = (page - 1) * limit;

    const { where, scope, canViewAll } = buildLeadListWhere(params, {
      id: session.user.id as string,
      role: session.user.role,
    });

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        // Default to a hot-lead worklist: highest score first so reps work the
        // best opportunities before cold ones. "recent" restores newest-first.
        orderBy:
          params?.sort === "recent"
            ? { createdAt: "desc" }
            : params?.sort === "cold"
              ? [
                  // The follow-up worklist: who has been left alone longest.
                  //
                  // `nulls: "first"` is the whole point. A lead nobody has EVER
                  // touched has lastTouchedAt = null, and that is the most
                  // urgent row on the board, not the least — Postgres sorts
                  // NULLs last by default, which would bury exactly the leads
                  // that have been completely forgotten.
                  { lastTouchedAt: { sort: "asc", nulls: "first" } },
                  { createdAt: "asc" },
                ]
              : [{ score: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(leads),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        // Effective (post-permission) scope + whether this viewer may switch to
        // "All leads". The UI renders the toggle from these, never from its own
        // role guess.
        scope,
        canViewAll,
      },
    };
  } catch (error) {
    console.error("[GET_LEADS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch leads" };
  }
}

// ============================================================
// Get Lead Stats (aggregate KPIs — not capped by pagination)
// ============================================================

// Header KPIs must reflect ALL leads matching the current scope + filters, not the
// paginated slice the list renders, so they're computed with DB aggregates here.
// `total` = every active lead in scope; `pipelineValue` = Σ estimatedValue over
// OPEN statuses only (excludes WON/LOST), matching the "Pipeline value"
// definition used elsewhere (S-1).
//
// It takes the SAME filter/scope input as getLeads and resolves it through the
// same server-side builder, so the header can never report a number the list
// isn't allowed to show (e.g. an org-wide total above a rep's own rows).
export async function getLeadStats(params?: LeadListFilters) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const { where } = buildLeadListWhere(params, {
      id: session.user.id as string,
      role: session.user.role,
    });

    const [total, openAgg] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.aggregate({
        // AND (not a spread) so an explicit status filter is intersected with the
        // open-status rule rather than overwritten by it — filtering to Won must
        // report ₹0 pipeline, not "all open leads".
        where: { AND: [where, { status: { notIn: ["WON", "LOST"] } }] },
        _sum: { estimatedValue: true },
      }),
    ]);

    return {
      success: true as const,
      data: {
        total,
        pipelineValue: Number(openAgg._sum.estimatedValue ?? 0),
      },
    };
  } catch (error) {
    console.error("[GET_LEAD_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch lead stats" };
  }
}

// ============================================================
// Get Single Lead
// ============================================================

export async function getLead(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        contact: true,
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            probability: true,
            stage: { select: { name: true, color: true } },
          },
        },
        salesQuotations: {
          select: {
            id: true,
            quoteNumber: true,
            version: true,
            status: true,
            grandTotal: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      return { success: false as const, error: "Lead not found" };
    }

    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    console.error("[GET_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to fetch lead" };
  }
}

// ============================================================
// Create Lead
// ============================================================

export async function createLead(data: LeadInput & { images?: string[] }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = leadSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const leadData = parsed.data;

    // Verify the contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: leadData.contactId },
    });

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    // Validate an explicit assignee: must be a real, active, sales-facing user
    // (otherwise a tampered id would silently FK-fail or bypass the role list).
    if (leadData.assignedToId) {
      const bad = await assigneeInvalid(leadData.assignedToId);
      if (bad) return { success: false as const, error: bad };
    }

    // Calculate lead score
    const score = calculateLeadScore({
      estimatedValue: leadData.estimatedValue,
      eventDate: leadData.eventDate,
      source: leadData.source,
      guestCount: leadData.guestCount,
      status: "NEW",
    });

    const lead = await prisma.lead.create({
      data: {
        title: leadData.title,
        contactId: leadData.contactId,
        source: leadData.source,
        eventType: leadData.eventType || null,
        eventDate: leadData.eventDate || null,
        guestCount: leadData.guestCount || null,
        estimatedValue: leadData.estimatedValue || null,
        preferredVenueId: leadData.preferredVenueId || null,
        slot: leadData.slot || null,
        vegNonVeg: leadData.vegNonVeg || null,
        perPlateBudget: leadData.perPlateBudget || null,
        description: leadData.description || null,
        images: sanitizeLeadImages(data.images),
        score,
        firstContactDue: leadSlaDeadline(),
        // Default next follow-up so the lead lands in the Follow-ups queue (S-11).
        followUpDate: nextBusinessDay(),
        ...(leadData.assignedToId ? { assignedToId: leadData.assignedToId } : {}),
        createdById: session.user.id as string,
      },
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Lead",
      entityId: lead.id,
    });

    // Auto-assign by rules ONLY when the sales rep didn't pick an assignee.
    try {
      const assignedUserId = leadData.assignedToId
        ? null
        : await evaluateAssignmentRules({
            source: lead.source,
            eventType: lead.eventType ?? undefined,
            status: lead.status,
            score: lead.score,
          });

      if (assignedUserId) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { assignedToId: assignedUserId },
        });

        // Notify assigned user
        notify({
          userId: assignedUserId,
          type: "LEAD_ASSIGNED",
          title: "New Lead Auto-Assigned",
          message: `Lead "${lead.title}" has been automatically assigned to you.`,
          actionUrl: `/leads/${lead.id}`,
        });
      }
    } catch (e) {
      // Don't fail lead creation if assignment rules fail
      console.error("[AUTO_ASSIGN_ERROR]", e);
    }

    // Intake: LEAD_CREATED workflows (instant email ack + "call now" task)
    // AND auto-enrolment into matching nurture cadences. `after()` runs it
    // once the response is sent while keeping the function alive to finish.
    after(async () => {
      try {
        await runLeadIntake({
          lead: {
            id: lead.id,
            contactId: lead.contactId,
            source: lead.source,
            eventType: lead.eventType,
            status: lead.status,
            guestCount: lead.guestCount,
            score: lead.score,
            estimatedValue: leadData.estimatedValue ?? null,
          },
          triggeredByUserId: session.user.id as string,
        });
      } catch (e) {
        console.error("[LEAD_INTAKE_ERROR]", e);
      }
    });

    revalidatePath("/leads");
    revalidatePath("/contacts");
    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    console.error("[CREATE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to create lead" };
  }
}

// ============================================================
// Update Lead
// ============================================================

export async function updateLead(
  id: string,
  data: Partial<LeadInput> & { assignedToId?: string | null; followUpDate?: Date | null; lostReason?: string | null; images?: string[] }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.lead.findUnique({
      where: { id },
      include: { deal: { select: { id: true } } },
    });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }

    // Server-side guards (updateLead doesn't run the full leadSchema). Reject
    // negative numbers (S-8) and an event date before the lead's createdAt (S-6).
    if (data.guestCount != null && (!Number.isInteger(data.guestCount) || data.guestCount < 1)) {
      return { success: false as const, error: "Guest count must be a whole number of at least 1." };
    }
    if (data.estimatedValue != null && Number(data.estimatedValue) < 0) {
      return { success: false as const, error: "Estimated value cannot be negative." };
    }
    if (data.eventDate) {
      const ev = new Date(data.eventDate);
      const created = new Date(existing.createdAt);
      const createdDay = new Date(created); createdDay.setHours(0, 0, 0, 0);
      if (!Number.isNaN(ev.getTime()) && ev.getTime() < createdDay.getTime()) {
        return { success: false as const, error: "Event date cannot be before the lead was created." };
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.contactId !== undefined) updateData.contactId = data.contactId;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.eventType !== undefined)
      updateData.eventType = data.eventType || null;
    if (data.eventDate !== undefined)
      updateData.eventDate = data.eventDate || null;
    if (data.guestCount !== undefined)
      updateData.guestCount = data.guestCount || null;
    if (data.estimatedValue !== undefined)
      updateData.estimatedValue = data.estimatedValue || null;
    if (data.preferredVenueId !== undefined)
      updateData.preferredVenueId = data.preferredVenueId || null;
    if (data.slot !== undefined) updateData.slot = data.slot || null;
    if (data.vegNonVeg !== undefined)
      updateData.vegNonVeg = data.vegNonVeg || null;
    if (data.perPlateBudget !== undefined)
      updateData.perPlateBudget = data.perPlateBudget || null;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.images !== undefined)
      updateData.images = sanitizeLeadImages(data.images);
    if (data.assignedToId !== undefined) {
      if (data.assignedToId) {
        const bad = await assigneeInvalid(data.assignedToId);
        if (bad) return { success: false as const, error: bad };
      }
      updateData.assignedToId = data.assignedToId || null;
    }
    if (data.followUpDate !== undefined)
      updateData.followUpDate = data.followUpDate || null;
    if (data.lostReason !== undefined)
      updateData.lostReason = data.lostReason || null;

    // Recalculate lead score with merged data
    const mergedForScoring = {
      estimatedValue:
        data.estimatedValue !== undefined
          ? data.estimatedValue
          : existing.estimatedValue
            ? Number(existing.estimatedValue)
            : null,
      eventDate:
        data.eventDate !== undefined ? data.eventDate : existing.eventDate,
      followUpDate:
        data.followUpDate !== undefined
          ? data.followUpDate
          : existing.followUpDate,
      source: data.source ?? existing.source,
      guestCount: data.guestCount ?? existing.guestCount,
      status: existing.status,
      createdAt: existing.createdAt,
    };

    updateData.score = calculateLeadScore(mergedForScoring);

    // Keep the linked pipeline Deal's money in sync: when estimatedValue actually
    // changes on a lead that already has a Deal, update deal.value in the SAME
    // transaction so the lead and its pipeline deal can never report different
    // amounts. Decimal compare via Number to avoid Prisma.Decimal identity quirks.
    const newEstimated =
      data.estimatedValue !== undefined ? data.estimatedValue || null : undefined;
    const estimatedChanged =
      newEstimated !== undefined &&
      Number(newEstimated ?? 0) !==
        Number(existing.estimatedValue ? Number(existing.estimatedValue) : 0);
    const shouldSyncDeal = !!existing.deal && estimatedChanged;

    const lead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: updateData,
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      if (shouldSyncDeal) {
        await tx.deal.update({
          where: { id: existing.deal!.id },
          data: { value: Number(newEstimated ?? 0) },
        });
      }
      return updated;
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Lead",
      entityId: lead.id,
    });

    // Notify assigned user if lead was re-assigned
    if (data.assignedToId && lead.assignedTo && data.assignedToId !== session.user.id) {
      notify({
        userId: data.assignedToId,
        type: "LEAD_ASSIGNED",
        title: "Lead Assigned to You",
        message: `You've been assigned the lead "${lead.title}".`,
        actionUrl: `/leads/${lead.id}`,
      });
    }

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    if (shouldSyncDeal) revalidatePath("/pipeline");
    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    console.error("[UPDATE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to update lead" };
  }
}

// ============================================================
// Delete Lead
// ============================================================

export async function deleteLead(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { deal: { select: { id: true } } },
    });

    if (!lead) {
      return { success: false as const, error: "Lead not found" };
    }

    if (lead.deal) {
      return {
        success: false as const,
        error:
          "Cannot delete a lead that has been converted to a deal. Delete the deal first.",
      };
    }

    // Soft-delete: set deletedAt instead of removing the row.
    // A cron job (or admin action) purges leads older than 30 days.
    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Lead",
      entityId: id,
    });

    revalidatePath("/leads");
    revalidatePath("/contacts");
    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to delete lead" };
  }
}

// ============================================================
// Test-lead cleanup — remove the "[TEST] …" leads created by integration
// checks (Google Ads "Send test data", webhook verification) so they don't
// skew conversion reporting. Matches ONLY the "[TEST]" tag we control, never a
// real-looking name, so it can't delete a genuine lead. Soft-delete (trash),
// so it's recoverable for 30 days.
// ============================================================

/** How many undeleted "[TEST]" leads exist (drives the cleanup button). */
/**
 * Count of ownerless leads — powers the "Unassigned" routing-inbox badge. Only
 * meaningful for managers (who can open that view); reps get 0 since they can't
 * switch to it anyway.
 */
export async function getUnassignedLeadsCount(): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "leads:read")) {
    return { success: false as const, error: "Insufficient permissions" };
  }
  if (!canSeeAllLeads(session.user.role)) return { success: true as const, count: 0 };
  const count = await prisma.lead.count({
    where: { deletedAt: null, assignedToId: null },
  });
  return { success: true as const, count };
}

export async function getTestLeadsCount(): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "leads:read")) {
    return { success: false as const, error: "Insufficient permissions" };
  }
  const count = await prisma.lead.count({
    where: { deletedAt: null, title: { contains: "[TEST]" } },
  });
  return { success: true as const, count };
}

export async function deleteTestLeads(): Promise<{ success: true; deleted: number } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "leads:delete")) {
    return { success: false as const, error: "Insufficient permissions" };
  }

  // Never touch a test lead that was already converted to a deal.
  const res = await prisma.lead.updateMany({
    where: { deletedAt: null, title: { contains: "[TEST]" }, deal: { is: null } },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: session.user.id as string,
    action: "deleted_test_leads",
    entityType: "Lead",
    entityId: "bulk",
  });
  revalidatePath("/leads");
  revalidatePath("/settings/trash");
  return { success: true as const, deleted: res.count };
}

// ============================================================
// Restore Lead (from trash)
// ============================================================

export async function restoreLead(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: null },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "restored",
      entityType: "Lead",
      entityId: id,
    });

    revalidatePath("/leads");
    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[RESTORE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to restore lead" };
  }
}

// ============================================================
// Permanently delete (admin only — bypasses 30-day retention)
// ============================================================

export async function purgeLead(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    const role = (session.user as { role?: string }).role ?? "";
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // FK safety: a lead with a converted deal cannot be hard-deleted
    // without orphaning the deal. Refuse rather than throw a DB error.
    const existing = await prisma.lead.findUnique({
      where: { id },
      include: { deal: { select: { id: true } }, quotes: { select: { id: true } } },
    });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }
    if (existing.deal || existing.quotes.length > 0) {
      return {
        success: false as const,
        error:
          "Cannot permanently delete a lead with a linked deal or quote. Delete those first.",
      };
    }

    await prisma.lead.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "purged",
      entityType: "Lead",
      entityId: id,
    });

    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[PURGE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to purge lead" };
  }
}

// ============================================================
// Update Lead Status
// ============================================================

// SCRM-001: keep the Pipeline in sync with a lead's status.
// A lead enters the pipeline (auto-creates a Deal at the entry stage) the first time it
// reaches a pipeline-worthy status, and Won/Lost move that deal to the won/lost stage.
async function syncPipelineDealForLead(
  tx: Prisma.TransactionClient,
  leadId: string,
  status: LeadStatus,
  lead: { title: string; estimatedValue: unknown; assignedToId: string | null }
) {
  const entryStage = async () =>
    (await tx.pipelineStage.findFirst({ where: { isDefault: true }, select: { id: true } })) ??
    (await tx.pipelineStage.findFirst({ orderBy: { order: "asc" }, select: { id: true } }));

  const OPEN_STATUSES: LeadStatus[] = ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"];
  if (OPEN_STATUSES.includes(status) || status === "WON") {
    const existingDeal = await tx.deal.findUnique({
      where: { leadId },
      select: { id: true, stage: { select: { isWonStage: true, isLostStage: true } } },
    });
    if (!existingDeal) {
      const entry = await entryStage();
      if (entry) {
        const last = await tx.deal.findFirst({ where: { stageId: entry.id }, orderBy: { orderInStage: "desc" }, select: { orderInStage: true } });
        await tx.deal.create({
          data: {
            title: lead.title,
            leadId,
            stageId: entry.id,
            value: (lead.estimatedValue as number | null) ?? 0,
            assignedToId: lead.assignedToId,
            orderInStage: (last?.orderInStage ?? -1) + 1,
          },
        });
      }
    } else if (status !== "WON" && (existingDeal.stage?.isWonStage || existingDeal.stage?.isLostStage)) {
      // Re-opening a previously closed deal: move it back to the entry stage and clear
      // the terminal dates so pipeline metrics stop counting it as won/lost (audit fix).
      const entry = await entryStage();
      if (entry) {
        await tx.deal.update({ where: { id: existingDeal.id }, data: { stageId: entry.id, wonDate: null, lostDate: null } });
      }
    }
  }
  if (status === "WON" || status === "LOST") {
    const stage = await tx.pipelineStage.findFirst({
      where: status === "WON" ? { isWonStage: true } : { isLostStage: true },
      select: { id: true },
    });
    const deal = await tx.deal.findUnique({ where: { leadId }, select: { id: true } });
    if (stage && deal) {
      await tx.deal.update({
        where: { id: deal.id },
        data: status === "WON" ? { stageId: stage.id, wonDate: new Date(), lostDate: null } : { stageId: stage.id, lostDate: new Date(), wonDate: null },
      });
    }
  }
}

// FEAT-S-005 — the rep's active Sales leads bucketed by follow-up date into
// Overdue / Today / Upcoming. Admins see the whole team; reps see their own.
export async function getSalesFollowupQueue(): Promise<
  { success: true; data: { overdue: unknown[]; today: unknown[]; upcoming: unknown[] } } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "leads:read")) return { success: false, error: "Insufficient permissions" };
  const role = session.user.role;
  const isManager = role === "ADMIN" || role === "SUPER_ADMIN" || role === "SALES_HEAD";
  const where: Prisma.LeadWhereInput = {
    status: { notIn: ["WON", "LOST"] },
    followUpDate: { not: null },
  };
  if (!isManager) where.assignedToId = session.user.id as string;

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true, title: true, status: true, estimatedValue: true, followUpDate: true,
      contact: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { followUpDate: "asc" },
    take: 300,
  });

  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  const overdue: typeof leads = [], today: typeof leads = [], upcoming: typeof leads = [];
  for (const l of leads) {
    const t = l.followUpDate!.getTime();
    if (t < startToday.getTime()) overdue.push(l);
    else if (t <= endToday.getTime()) today.push(l);
    else upcoming.push(l);
  }
  return { success: true, data: serialize({ overdue, today, upcoming }) as { overdue: unknown[]; today: unknown[]; upcoming: unknown[] } };
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }

    // A lead can't be marked Won without an owner (SCRM-004) — accountability for the close.
    if (status === "WON" && !existing.assignedToId) {
      return { success: false as const, error: "Assign an owner to this lead before marking it Won." };
    }

    // Recalculate score with new status
    const score = calculateLeadScore({
      estimatedValue: existing.estimatedValue
        ? Number(existing.estimatedValue)
        : null,
      eventDate: existing.eventDate,
      followUpDate: existing.followUpDate,
      source: existing.source,
      guestCount: existing.guestCount,
      status,
      createdAt: existing.createdAt,
    });

    // Keep active leads visible in the Follow-ups queue: if a lead moves to an
    // open/working status and still has no follow-up scheduled, default one to
    // the next business day so it never silently drops out (S-11).
    const statusData: { status: LeadStatus; score: number; followUpDate?: Date } = { status, score };
    const OPEN_FOR_FOLLOWUP: LeadStatus[] = ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"];
    if (OPEN_FOR_FOLLOWUP.includes(status) && !existing.followUpDate) {
      statusData.followUpDate = nextBusinessDay();
    }

    // SCRM-001: a lead enters the Pipeline once it's Qualified (auto-create a deal), and
    // its Won/Lost / re-open state keeps the deal's stage in sync. Status change + deal
    // sync commit together so the lead and its pipeline deal can never diverge (audit fix).
    const lead = await prisma.$transaction(async (tx) => {
      // Re-assert the "Won needs an owner" guard against the row inside the
      // transaction. The earlier check (line ~828) ran on a read taken outside
      // the transaction, so a concurrent un-assign could otherwise let a lead be
      // marked Won with no owner (SCRM-004). This catches that race atomically.
      if (status === "WON") {
        const current = await tx.lead.findUnique({
          where: { id },
          select: { assignedToId: true },
        });
        if (!current) {
          throw new Error("LEAD_NOT_FOUND");
        }
        if (!current.assignedToId) {
          throw new Error("WON_NEEDS_OWNER");
        }
      }
      const updated = await tx.lead.update({ where: { id }, data: statusData });
      await syncPipelineDealForLead(tx, id, status, existing);
      return updated;
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Lead",
      entityId: lead.id,
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    revalidatePath("/pipeline");
    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    if (error instanceof Error && error.message === "WON_NEEDS_OWNER") {
      return { success: false as const, error: "Assign an owner to this lead before marking it Won." };
    }
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") {
      return { success: false as const, error: "Lead not found" };
    }
    console.error("[UPDATE_LEAD_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update lead status" };
  }
}

// ============================================================
// Convert Lead → Deal (explicit user action from the lead detail).
// Reuses syncPipelineDealForLead so the created Deal is identical to the one the
// Qualified-status bridge produces (same entry stage, value, owner, ordering).
// If the lead is still NEW/CONTACTED we promote it to QUALIFIED as part of the
// same transaction — a Deal only exists for qualified-or-later leads (SCRM-001).
// Idempotent: if a Deal already exists we return it rather than erroring.
// ============================================================
export async function convertLeadToDeal(leadId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Same guard family as other lead mutations, plus pipeline write (creates a Deal).
    if (
      !hasPermission(session.user.role, "leads:update") ||
      !hasPermission(session.user.role, "pipeline:update")
    ) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      include: { deal: { select: { id: true } } },
    });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }

    // Already converted — surface the existing deal, don't create a second one.
    if (existing.deal) {
      return {
        success: true as const,
        data: { dealId: existing.deal.id, alreadyExisted: true },
      };
    }

    if (existing.status === "LOST") {
      return { success: false as const, error: "A lost lead can't be converted to a deal." };
    }

    // A Deal exists only for QUALIFIED-or-later leads; promote NEW/CONTACTED so the
    // pipeline sync will actually create the deal. WON keeps its status.
    const PROMOTE_FROM: LeadStatus[] = ["NEW", "CONTACTED"];
    const targetStatus: LeadStatus = PROMOTE_FROM.includes(existing.status as LeadStatus)
      ? "QUALIFIED"
      : (existing.status as LeadStatus);

    const dealId = await prisma.$transaction(async (tx) => {
      if (targetStatus !== existing.status) {
        const score = calculateLeadScore({
          estimatedValue: existing.estimatedValue ? Number(existing.estimatedValue) : null,
          eventDate: existing.eventDate,
          followUpDate: existing.followUpDate,
          source: existing.source,
          guestCount: existing.guestCount,
          status: targetStatus,
          createdAt: existing.createdAt,
        });
        await tx.lead.update({ where: { id: leadId }, data: { status: targetStatus, score } });
      }
      await syncPipelineDealForLead(tx, leadId, targetStatus, existing);
      const deal = await tx.deal.findUnique({ where: { leadId }, select: { id: true } });
      if (!deal) {
        // Only happens when no pipeline stage is configured — surface a clear error.
        throw new Error("NO_PIPELINE_STAGE");
      }
      return deal.id;
    });

    await logActivity({
      userId: session.user.id as string,
      action: "converted_to_deal",
      entityType: "Lead",
      entityId: leadId,
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/pipeline");
    return { success: true as const, data: { dealId, alreadyExisted: false } };
  } catch (error) {
    if (error instanceof Error && error.message === "NO_PIPELINE_STAGE") {
      return {
        success: false as const,
        error: "No pipeline stage is configured. Set up your pipeline stages first.",
      };
    }
    console.error("[CONVERT_LEAD_TO_DEAL_ERROR]", error);
    return { success: false as const, error: "Failed to convert lead to deal" };
  }
}

// ============================================================
// Backfill: ensure every open/won lead has a pipeline Deal (audit S-9).
// The lead→Deal bridge only fires on updateLeadStatus, so leads that were
// seeded or imported directly into an open/won status never produced a Deal —
// which is why the Pipeline board looked empty while Leads had records. This
// idempotent action (managers only) creates the missing Deals using the same
// sync logic; running it twice is a no-op.
// ============================================================
export async function backfillLeadPipeline() {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role, "pipeline:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Only statuses that syncPipelineDealForLead actually creates a deal for.
    // LOST is excluded: the sync only moves an EXISTING deal to the lost stage and
    // never creates one for a lost-without-deal lead, so scanning LOST here would
    // inflate the "scanned" count with leads that can never produce a deal.
    const PIPELINE_STATUSES: LeadStatus[] = ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
    const leads = await prisma.lead.findMany({
      where: { status: { in: PIPELINE_STATUSES }, deletedAt: null, deal: { is: null } },
      select: { id: true, title: true, estimatedValue: true, assignedToId: true, status: true },
    });

    let created = 0;
    for (const l of leads) {
      await prisma.$transaction(async (tx) => {
        const before = await tx.deal.findUnique({ where: { leadId: l.id }, select: { id: true } });
        await syncPipelineDealForLead(tx, l.id, l.status, { title: l.title, estimatedValue: l.estimatedValue, assignedToId: l.assignedToId });
        const after = await tx.deal.findUnique({ where: { leadId: l.id }, select: { id: true } });
        if (!before && after) created++;
      });
    }

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { success: true as const, data: { scanned: leads.length, created } };
  } catch (error) {
    console.error("[BACKFILL_LEAD_PIPELINE_ERROR]", error);
    return { success: false as const, error: "Failed to backfill pipeline deals" };
  }
}

/**
 * Run the engagement roll-up now, instead of waiting for the nightly cron.
 *
 * Exists because the counters ship at their defaults and stay there until the
 * daily lane next fires — so the whole feature reads "Not logged" on every row
 * for up to 24h, which is indistinguishable from it being broken.
 *
 * A button rather than only a cron is the established pattern here: `vercel env
 * pull` redacts CRON_SECRET, so the cron endpoints cannot be triggered from a
 * dev machine, and there is no way to run a one-off script against production.
 * Same shape as the enquiry-source repair.
 *
 * Idempotent — it recomputes from source, so pressing it twice is harmless.
 */
export async function runLeadEngagementRepair() {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  // Reuses the lead-manager permission rather than inventing a key: anyone who
  // may reassign the whole board may also recompute its counters.
  if (!hasPermission(session.user.role, "leads:assign")) {
    return { success: false as const, error: "Insufficient permissions" };
  }

  try {
    const { reconcileLeadEngagement } = await import("@/lib/crm/engagement");
    const { scanned, updated } = await reconcileLeadEngagement();
    revalidatePath("/leads");
    return { success: true as const, scanned, updated };
  } catch (e) {
    console.error("[LEAD_ENGAGEMENT_REPAIR_ERROR]", e);
    return { success: false as const, error: "Repair failed" };
  }
}
