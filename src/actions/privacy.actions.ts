"use server";

// ============================================================
// Data-privacy actions (India DPDP Act 2023).
// ------------------------------------------------------------
// submitPrivacyRequest is PUBLIC (the /privacy page): zod-validated,
// honeypot-guarded, rate-limited per hashed IP (5/hour), and notifies admins.
// Everything else is gated on users:manage-roles (ADMIN / SUPER_ADMIN hold it)
// and powers /settings/privacy. Only async functions are exported.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { notifyAdmins } from "@/lib/notify";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPrivacyIp, requestClientMeta } from "@/lib/privacy/consent";
import {
  PRIVACY_REQUEST_KINDS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_KIND_LABEL,
  type PrivacyRequestKind,
  type PrivacyRequestStatus,
} from "@/lib/privacy/policy";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ============================================================
// (1) PUBLIC — raise a request from the policy page
// ============================================================

const submitPrivacyRequestSchema = z.object({
  kind: z.enum(PRIVACY_REQUEST_KINDS),
  requesterName: z.string().trim().min(2, "Please enter your name.").max(120),
  requesterEmail: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254)
    .optional()
    .or(z.literal("")),
  requesterPhone: z.string().trim().max(30).optional().or(z.literal("")),
  details: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Honeypot — real people never fill it. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type SubmitPrivacyRequestInput = z.input<typeof submitPrivacyRequestSchema>;

export async function submitPrivacyRequest(
  input: SubmitPrivacyRequestInput
): Promise<Result<{ id: string }>> {
  const parsed = submitPrivacyRequestSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Please check the form and try again." };
  }
  const d = parsed.data;

  // Honeypot hit: answer as if it worked, record nothing.
  if (d.website) return { success: true, data: { id: "received" } };

  const email = d.requesterEmail?.trim().toLowerCase() || null;
  const phone = d.requesterPhone?.trim() || null;
  if (!email && !phone) {
    return {
      success: false,
      error: "Please give an email address or phone number so we can verify it is you and reply.",
    };
  }
  if (phone && phone.replace(/\D/g, "").length < 7) {
    return { success: false, error: "Enter a valid phone number." };
  }

  // Rate limit: 5 requests / hour per (hashed) IP. Best-effort, per instance.
  const { ip } = await requestClientMeta();
  const key = hashPrivacyIp(ip) ?? ip ?? "unknown";
  const rl = checkRateLimit(`privacy-request:${key}`, { maxRequests: 5, windowSeconds: 3600 });
  if (!rl.success) {
    return {
      success: false,
      error: "Too many requests from your connection. Please try again in an hour.",
    };
  }

  try {
    const row = await prisma.privacyRequest.create({
      data: {
        kind: d.kind,
        requesterName: d.requesterName,
        requesterEmail: email,
        requesterPhone: phone,
        details: d.details?.trim() || null,
      },
      select: { id: true },
    });

    // Tell every active admin — the same recipient rule the rest of the app
    // uses for system-wide events. Awaited so a serverless freeze can't drop it.
    const admins = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
      select: { id: true },
    });
    await notifyAdmins(
      admins.map((a) => a.id),
      {
        type: "SYSTEM",
        title: "New privacy request",
        message: `${PRIVACY_REQUEST_KIND_LABEL[d.kind]} — ${d.requesterName}${
          email ? ` (${email})` : phone ? ` (${phone})` : ""
        }. Verify identity, then respond within 30 days.`,
        actionUrl: "/settings/privacy",
      }
    );

    return { success: true, data: { id: row.id } };
  } catch (error) {
    console.error("[PRIVACY_REQUEST_SUBMIT_ERROR]", error);
    return { success: false, error: "Something went wrong. Please try again or email us directly." };
  }
}

// ============================================================
// Admin gate — users:manage-roles (ADMIN / SUPER_ADMIN hold it)
// ============================================================

type Gate = { ok: true; userId: string; role: string } | { ok: false; error: string };

async function requirePrivacyAdmin(): Promise<Gate> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Unauthorized" };
  const role = String(session.user.role ?? "");
  const allowed =
    role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, "users:manage-roles");
  if (!allowed) return { ok: false, error: "Insufficient permissions" };
  return { ok: true, userId: session.user.id as string, role };
}

// ============================================================
// (2) List the queue
// ============================================================

export interface PrivacyRequestRow {
  id: string;
  kind: PrivacyRequestKind;
  status: PrivacyRequestStatus;
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  details: string | null;
  verifiedAt: string | null;
  handledById: string | null;
  handledByName: string | null;
  handledAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyQueueData {
  requests: PrivacyRequestRow[];
  counts: Record<PrivacyRequestStatus, number>;
}

export async function listPrivacyRequests(filter?: {
  status?: PrivacyRequestStatus | "ALL";
}): Promise<Result<PrivacyQueueData>> {
  const gate = await requirePrivacyAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  try {
    const status = filter?.status && filter.status !== "ALL" ? filter.status : undefined;
    const [rows, grouped] = await Promise.all([
      prisma.privacyRequest.findMany({
        where: status ? { status } : undefined,
        orderBy: [{ createdAt: "desc" }],
        take: 500,
      }),
      prisma.privacyRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    // No @relation on purpose (prod-push safety) — resolve handler names here.
    const handlerIds = Array.from(
      new Set(rows.map((r) => r.handledById).filter((v): v is string => !!v))
    );
    const handlers = handlerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: handlerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const handlerName = new Map(handlers.map((u) => [u.id, u.name || u.email]));

    const counts: Record<PrivacyRequestStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      REJECTED: 0,
    };
    for (const g of grouped) {
      if ((PRIVACY_REQUEST_STATUSES as readonly string[]).includes(g.status)) {
        counts[g.status as PrivacyRequestStatus] = g._count._all;
      }
    }

    const requests: PrivacyRequestRow[] = rows.map((r) => ({
      id: r.id,
      kind: (PRIVACY_REQUEST_KINDS as readonly string[]).includes(r.kind)
        ? (r.kind as PrivacyRequestKind)
        : "ACCESS",
      status: (PRIVACY_REQUEST_STATUSES as readonly string[]).includes(r.status)
        ? (r.status as PrivacyRequestStatus)
        : "OPEN",
      requesterName: r.requesterName,
      requesterEmail: r.requesterEmail,
      requesterPhone: r.requesterPhone,
      details: r.details,
      verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
      handledById: r.handledById,
      handledByName: r.handledById ? handlerName.get(r.handledById) ?? null : null,
      handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      resolutionNote: r.resolutionNote,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return { success: true, data: { requests, counts } };
  } catch (error) {
    console.error("[PRIVACY_REQUEST_LIST_ERROR]", error);
    return { success: false, error: "Failed to load privacy requests" };
  }
}

// ============================================================
// (3) Work a request — status / verification / note
// ============================================================

const updatePrivacyRequestSchema = z.object({
  id: z.string().min(1),
  status: z.enum(PRIVACY_REQUEST_STATUSES),
  resolutionNote: z.string().trim().max(2000).optional().or(z.literal("")),
  /** true = mark identity verified now; false = clear; undefined = leave as is. */
  verified: z.boolean().optional(),
});

export type UpdatePrivacyRequestInput = z.input<typeof updatePrivacyRequestSchema>;

export async function updatePrivacyRequest(
  input: UpdatePrivacyRequestInput
): Promise<Result<{ id: string }>> {
  const gate = await requirePrivacyAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = updatePrivacyRequestSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Invalid input" };
  }
  const d = parsed.data;

  try {
    const existing = await prisma.privacyRequest.findUnique({ where: { id: d.id } });
    if (!existing) return { success: false, error: "Request not found" };

    const closing = d.status === "DONE" || d.status === "REJECTED";
    const note = d.resolutionNote?.trim() || "";
    if (closing && !note && !existing.resolutionNote) {
      return {
        success: false,
        error: "Add a short resolution note before closing a request — it is the audit trail.",
      };
    }

    const now = new Date();
    const verifiedAt =
      d.verified === true
        ? existing.verifiedAt ?? now
        : d.verified === false
          ? null
          : existing.verifiedAt;

    await prisma.privacyRequest.update({
      where: { id: d.id },
      data: {
        status: d.status,
        resolutionNote: note || existing.resolutionNote,
        verifiedAt,
        handledById: closing ? gate.userId : existing.handledById,
        handledAt: closing ? now : existing.handledAt,
      },
    });

    await logActivity({
      userId: gate.userId,
      action: `privacy_request_${d.status.toLowerCase()}`,
      entityType: "PrivacyRequest",
      entityId: d.id,
      changes: {
        from: existing.status,
        to: d.status,
        verified: !!verifiedAt,
        noteChanged: !!note && note !== existing.resolutionNote,
      },
    });

    revalidatePath("/settings/privacy");
    return { success: true, data: { id: d.id } };
  } catch (error) {
    console.error("[PRIVACY_REQUEST_UPDATE_ERROR]", error);
    return { success: false, error: "Failed to update the request" };
  }
}

// ============================================================
// (4) Find the contact behind a request
// ============================================================

export interface PrivacyContactMatch {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  bookings: number;
  invoices: number;
  anonymised: boolean;
}

export async function searchContactsForPrivacy(
  query: string
): Promise<Result<PrivacyContactMatch[]>> {
  const gate = await requirePrivacyAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const q = (query ?? "").trim();
  if (q.length < 3) return { success: true, data: [] };
  const digits = q.replace(/\D/g, "");

  try {
    const or: Prisma.ContactWhereInput[] = [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ];
    // Phones are stored canonically (+91XXXXXXXXXX); the last 10 digits match
    // every spelling the requester might have typed.
    if (digits.length >= 6) or.push({ phone: { contains: digits.slice(-10) } });

    const rows = await prisma.contact.findMany({
      where: { deletedAt: null, OR: or },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { bookings: true, invoices: true } },
      },
    });

    return {
      success: true,
      data: rows.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        phone: c.phone,
        createdAt: c.createdAt.toISOString(),
        bookings: c._count.bookings,
        invoices: c._count.invoices,
        anonymised: c.firstName === "Anonymised" && !c.email && !c.phone,
      })),
    };
  } catch (error) {
    console.error("[PRIVACY_CONTACT_SEARCH_ERROR]", error);
    return { success: false, error: "Search failed" };
  }
}

// ============================================================
// (5) Erasure — anonymise a contact, keep the money trail
// ============================================================

const anonymiseContactSchema = z.object({
  contactId: z.string().min(1),
  requestId: z.string().min(1).optional(),
});

export type AnonymiseContactInput = z.input<typeof anonymiseContactSchema>;

/**
 * DPDP erasure for a Contact. Personal identifiers are replaced with
 * placeholders; the row itself, and every invoice / payment / booking hanging
 * off it, is left in place because Indian tax law requires the financial
 * record to survive. Linked consent-ledger rows and form submissions are
 * scrubbed of the same identifiers. The contact is NOT soft-deleted: the
 * trash purge cron would otherwise remove the financial spine after 30 days.
 */
export async function anonymiseContact(
  input: AnonymiseContactInput
): Promise<Result<{ contactId: string }>> {
  const gate = await requirePrivacyAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = anonymiseContactSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };
  const { contactId, requestId } = parsed.data;

  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        alternatePhone: true,
        company: true,
        designation: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        notes: true,
        anniversary: true,
      },
    });
    if (!contact) return { success: false, error: "Contact not found" };
    if (contact.firstName === "Anonymised" && !contact.email && !contact.phone) {
      return { success: false, error: "This contact has already been anonymised." };
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const placeholderNote = `Personal details removed on ${stamp} under privacy request ${
      requestId ?? "(manual)"
    } — DPDP erasure. Financial records retained for statutory purposes.`;
    const scrubbedFields = (
      [
        ["firstName", contact.firstName],
        ["lastName", contact.lastName],
        ["email", contact.email],
        ["phone", contact.phone],
        ["alternatePhone", contact.alternatePhone],
        ["company", contact.company],
        ["designation", contact.designation],
        ["address", contact.address],
        ["city", contact.city],
        ["state", contact.state],
        ["pincode", contact.pincode],
        ["notes", contact.notes],
        ["anniversary", contact.anniversary],
      ] as const
    )
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k]) => k);

    await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: contactId },
        data: {
          firstName: "Anonymised",
          lastName: `Contact ${contactId.slice(-6).toUpperCase()}`,
          email: null,
          phone: null,
          alternatePhone: null,
          company: null,
          designation: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          notes: placeholderNote,
          anniversary: null,
          isActive: false,
        },
      });

      // Consent ledger: keep the evidence (what/when), drop the identifiers.
      await tx.consentRecord.updateMany({
        where: {
          OR: [
            { subjectId: contactId },
            ...(contact.email ? [{ email: contact.email.toLowerCase() }] : []),
            ...(contact.phone ? [{ phone: contact.phone }] : []),
          ],
        },
        data: { email: null, phone: null, userAgent: null },
      });

      // Raw form payloads linked to this contact hold the same identifiers.
      await tx.webformSubmission.updateMany({
        where: { contactId },
        data: { data: { anonymised: true, at: stamp }, ipAddress: null, userAgent: null },
      });

      // Widget inquiries carry no contact link — match on the identifiers.
      if (contact.email || contact.phone) {
        await tx.widgetInquiry.updateMany({
          where: {
            OR: [
              ...(contact.email ? [{ email: { equals: contact.email, mode: "insensitive" as const } }] : []),
              ...(contact.phone ? [{ phone: contact.phone }] : []),
            ],
          },
          data: {
            name: "Anonymised",
            email: `anonymised+${contactId.slice(-8)}@removed.invalid`,
            phone: null,
            message: "Personal details removed under a privacy request.",
          },
        });
      }
    });

    await logActivity({
      userId: gate.userId,
      action: "anonymised",
      entityType: "Contact",
      entityId: contactId,
      // Field NAMES only — logging the values would defeat the erasure.
      changes: { requestId: requestId ?? null, scrubbedFields },
    });

    if (requestId) {
      const req = await prisma.privacyRequest.findUnique({ where: { id: requestId } });
      if (req) {
        await prisma.privacyRequest.update({
          where: { id: requestId },
          data: {
            resolutionNote: [req.resolutionNote, `Contact ${contactId} anonymised on ${stamp}.`]
              .filter(Boolean)
              .join("\n"),
            status: req.status === "OPEN" ? "IN_PROGRESS" : req.status,
          },
        });
      }
    }

    revalidatePath("/settings/privacy");
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    return { success: true, data: { contactId } };
  } catch (error) {
    console.error("[PRIVACY_ANONYMISE_ERROR]", error);
    return { success: false, error: "Failed to anonymise the contact" };
  }
}

// ============================================================
// (6) Consent ledger summary for the admin page
// ============================================================

export interface ConsentSummary {
  total: number;
  last30Days: number;
  bySource: { source: string; purpose: string; count: number; latest: string }[];
}

export async function getConsentSummary(): Promise<Result<ConsentSummary>> {
  const gate = await requirePrivacyAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, last30Days, grouped] = await Promise.all([
      prisma.consentRecord.count(),
      prisma.consentRecord.count({ where: { givenAt: { gte: since } } }),
      prisma.consentRecord.groupBy({
        by: ["source", "purpose"],
        _count: { _all: true },
        _max: { givenAt: true },
        orderBy: { _count: { source: "desc" } },
        take: 20,
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        last30Days,
        bySource: grouped.map((g) => ({
          source: g.source,
          purpose: g.purpose,
          count: g._count._all,
          latest: g._max.givenAt ? g._max.givenAt.toISOString() : "",
        })),
      },
    };
  } catch (error) {
    console.error("[CONSENT_SUMMARY_ERROR]", error);
    return { success: false, error: "Failed to load the consent summary" };
  }
}
