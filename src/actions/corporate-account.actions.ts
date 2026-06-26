"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { CorporateAccountTier } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { enrollEntityIntoCadence } from "@/lib/winback/enroll-into-cadence";
import { WINBACK_CADENCE_NAMES } from "@/lib/winback/winback-config";
import {
  promoteSchema,
  corporateAccountUpdateSchema,
  commitmentOfferSchema,
  type CorporateAccountTierValue,
} from "@/schemas/corporate-account.schema";

// ============================================================
// Corporate Account-Farming actions
// ============================================================
// Promotes corporate Contacts (Contact.type == CORPORATE) into farmable
// CorporateAccounts and drives the worklist / commitment-offer / re-engage
// surface. All money (lifetimeRevenue, lockedPricePerPlate) is Decimal and is
// serialized at the boundary. Every action gates at the top via hasPermission.

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

// ------------------------------------------------------------
// Promote a corporate Contact into a CorporateAccount (idempotent)
// ------------------------------------------------------------
export async function promoteContactToAccount(
  contactId: string
): Promise<Result<{ id: string; created: boolean }>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "accounts:manage")) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = promoteSchema.safeParse({ contactId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const contact = await prisma.contact.findFirst({
    where: { id: parsed.data.contactId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      type: true,
      corporateAccountId: true,
    },
  });
  if (!contact) return { success: false, error: "Contact not found" };
  if (contact.type !== "CORPORATE") {
    return { success: false, error: "Only corporate contacts can be promoted to accounts" };
  }

  // Already promoted (denormalised flag) — return existing.
  if (contact.corporateAccountId) {
    return { success: true, data: { id: contact.corporateAccountId, created: false } };
  }

  const accountName =
    contact.company?.trim() ||
    `${contact.firstName} ${contact.lastName}`.trim() ||
    "Corporate Account";

  try {
    const account = await prisma.corporateAccount.create({
      data: {
        contactId: contact.id,
        accountName,
        tier: "PROSPECT",
        ownerUserId: user.id,
      },
      select: { id: true },
    });

    // Stamp the back-reference on the contact (denormalised pointer).
    await prisma.contact.update({
      where: { id: contact.id },
      data: { corporateAccountId: account.id },
    });

    await logActivity({
      userId: user.id,
      action: "CORPORATE_ACCOUNT_PROMOTE",
      entityType: "corporate_account",
      entityId: account.id,
      changes: { contactId: contact.id, accountName },
    });

    revalidatePath("/accounts");
    return { success: true, data: { id: account.id, created: true } };
  } catch (e) {
    // contactId is @unique — a concurrent promote raced us. Treat as already
    // promoted and return the existing account.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.corporateAccount.findUnique({
        where: { contactId: contact.id },
        select: { id: true },
      });
      if (existing) {
        // Self-heal the back-reference if the prior run missed it.
        await prisma.contact
          .update({ where: { id: contact.id }, data: { corporateAccountId: existing.id } })
          .catch(() => undefined);
        return { success: true, data: { id: existing.id, created: false } };
      }
    }
    console.error("[promoteContactToAccount] error:", e);
    return { success: false, error: "Failed to promote contact" };
  }
}

// ------------------------------------------------------------
// Farming worklist — sorted by re-engage-due / dormancy
// ------------------------------------------------------------
export async function getCorporateAccounts(params?: {
  tier?: CorporateAccountTierValue;
  ownerUserId?: string;
  dueOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<
  Result<{ rows: unknown[]; total: number; page: number; pageSize: number }>
> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "accounts:read")) {
    return { success: false, error: "Unauthorized" };
  }

  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, params?.pageSize ?? PAGE_SIZE_DEFAULT));

  const where: Prisma.CorporateAccountWhereInput = {};
  if (params?.tier) where.tier = params.tier as CorporateAccountTier;
  if (params?.ownerUserId) where.ownerUserId = params.ownerUserId;
  if (params?.dueOnly) {
    where.tier = { not: "CHURNED" };
    where.nextReengageAt = { not: null, lte: new Date() };
  }
  const search = params?.search?.trim();
  if (search) {
    where.OR = [
      { accountName: { contains: search, mode: "insensitive" } },
      { contact: { company: { contains: search, mode: "insensitive" } } },
      { contact: { firstName: { contains: search, mode: "insensitive" } } },
      { contact: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [accounts, total] = await Promise.all([
    prisma.corporateAccount.findMany({
      where,
      // Due (oldest re-engage) first, then most-dormant by last event.
      orderBy: [{ nextReengageAt: "asc" }, { lastEventDate: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true, company: true, phone: true, email: true },
        },
      },
    }),
    prisma.corporateAccount.count({ where }),
  ]);

  // Resolve owner display names in one batched query (no N+1).
  const ownerIds = Array.from(
    new Set(accounts.map((a) => a.ownerUserId).filter((id): id is string => !!id))
  );
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
    : [];
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));

  const now = Date.now();
  const rows = accounts.map((a) => ({
    ...serialize(a),
    ownerName: a.ownerUserId ? ownerName.get(a.ownerUserId) ?? null : null,
    isDue:
      a.tier !== "CHURNED" &&
      !!a.nextReengageAt &&
      a.nextReengageAt.getTime() <= now,
    hasCommitment: a.committedEventsPerYear > 0 || a.lockedPricePerPlate != null,
  }));

  return { success: true, data: { rows, total, page, pageSize } };
}

// ------------------------------------------------------------
// Account-360 header + rollups
// ------------------------------------------------------------
export async function getCorporateAccount(id: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "accounts:read")) {
    return { success: false, error: "Unauthorized" };
  }

  const account = await prisma.corporateAccount.findUnique({
    where: { id },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          email: true,
          phone: true,
          designation: true,
          type: true,
        },
      },
    },
  });
  if (!account) return { success: false, error: "Account not found" };

  let ownerName: string | null = null;
  if (account.ownerUserId) {
    const owner = await prisma.user.findUnique({
      where: { id: account.ownerUserId },
      select: { name: true },
    });
    ownerName = owner?.name ?? null;
  }

  const now = Date.now();
  const data = {
    ...serialize(account),
    ownerName,
    isDue:
      account.tier !== "CHURNED" &&
      !!account.nextReengageAt &&
      account.nextReengageAt.getTime() <= now,
  };
  return { success: true, data };
}

// ------------------------------------------------------------
// Update owner / tier / notes / accountName
// ------------------------------------------------------------
export async function updateCorporateAccount(
  id: string,
  patch: {
    accountName?: string;
    tier?: CorporateAccountTierValue;
    ownerUserId?: string | null;
    notes?: string | null;
  }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "accounts:manage")) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = corporateAccountUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const account = await prisma.corporateAccount.findUnique({ where: { id }, select: { id: true } });
  if (!account) return { success: false, error: "Account not found" };

  const data: Prisma.CorporateAccountUpdateInput = {};
  if (parsed.data.accountName !== undefined) data.accountName = parsed.data.accountName;
  if (parsed.data.tier !== undefined) data.tier = parsed.data.tier as CorporateAccountTier;
  if (parsed.data.ownerUserId !== undefined) data.ownerUserId = parsed.data.ownerUserId;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  await prisma.corporateAccount.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    action: "CORPORATE_ACCOUNT_UPDATE",
    entityType: "corporate_account",
    entityId: id,
    changes: parsed.data,
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Multi-event commitment offer (advisory locked-price snapshot)
// ------------------------------------------------------------
export async function setCommitmentOffer(
  id: string,
  input: {
    committedEventsPerYear: number;
    lockedPricePerPlate?: number | null;
    commitmentStart?: string | null;
    commitmentEnd?: string | null;
  }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "accounts:manage")) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = commitmentOfferSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const account = await prisma.corporateAccount.findUnique({ where: { id }, select: { id: true } });
  if (!account) return { success: false, error: "Account not found" };

  const { committedEventsPerYear, lockedPricePerPlate, commitmentStart, commitmentEnd } = parsed.data;

  await prisma.corporateAccount.update({
    where: { id },
    data: {
      committedEventsPerYear,
      // Money: store as Decimal(10,2); advisory snapshot only — never auto-applied to quotations.
      lockedPricePerPlate:
        lockedPricePerPlate == null ? null : new Prisma.Decimal(lockedPricePerPlate.toFixed(2)),
      commitmentStart: commitmentStart ? new Date(commitmentStart) : null,
      commitmentEnd: commitmentEnd ? new Date(commitmentEnd) : null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "CORPORATE_ACCOUNT_COMMITMENT",
    entityType: "corporate_account",
    entityId: id,
    changes: {
      committedEventsPerYear,
      lockedPricePerPlate: lockedPricePerPlate ?? null,
      commitmentStart: commitmentStart ?? null,
      commitmentEnd: commitmentEnd ?? null,
    },
  });

  revalidatePath(`/accounts/${id}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Manual re-engage enrollment (delegates to the unauthed cadence helper)
// ------------------------------------------------------------
export async function enrollAccountReengage(
  id: string
): Promise<Result<{ enrollmentId: string | null; alreadyEnrolled: boolean }>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "accounts:manage")) {
    return { success: false, error: "Unauthorized" };
  }

  const account = await prisma.corporateAccount.findUnique({
    where: { id },
    select: { id: true, contactId: true, ownerUserId: true, accountName: true },
  });
  if (!account) return { success: false, error: "Account not found" };

  // Resolve the ACTIVE entityType=CONTACT re-engage cadence by stable name.
  const cadence = await prisma.cadence.findFirst({
    where: {
      name: WINBACK_CADENCE_NAMES.CORPORATE_FARMING,
      status: "ACTIVE",
      entityType: "CONTACT",
    },
    include: { steps: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  if (!cadence) {
    return {
      success: false,
      error: "No active corporate re-engage cadence configured. Ask an admin to set one up.",
    };
  }

  const firstStep = cadence.steps[0];
  const firstStepDelayMs = firstStep
    ? (firstStep.delayDays ?? 0) * 24 * 60 * 60 * 1000 + (firstStep.delayHours ?? 0) * 60 * 60 * 1000
    : null;

  const { enrollmentId, alreadyEnrolled } = await enrollEntityIntoCadence(
    cadence.id,
    account.contactId,
    "CONTACT",
    firstStepDelayMs
  );

  if (!enrollmentId) {
    return { success: false, error: "Failed to enroll account into re-engage cadence" };
  }

  // Record the manual enrollment on the account (advance anchor a quarter).
  await prisma.corporateAccount.update({
    where: { id },
    data: {
      reengageCadenceId: cadence.id,
      nextReengageAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  // Upsert the WinbackTarget so the cron sweep treats this as already handled.
  const existing = await prisma.winbackTarget.findFirst({
    where: { kind: "CORPORATE_FARMING", contactId: account.contactId },
    select: { id: true },
  });
  if (existing) {
    await prisma.winbackTarget.update({
      where: { id: existing.id },
      data: {
        status: "ENROLLED",
        cadenceId: cadence.id,
        enrollmentId,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  } else {
    await prisma.winbackTarget.create({
      data: {
        kind: "CORPORATE_FARMING",
        status: "ENROLLED",
        contactId: account.contactId,
        cadenceId: cadence.id,
        enrollmentId,
        attempts: 1,
        lastAttemptAt: new Date(),
      },
    });
  }

  await logActivity({
    userId: user.id,
    action: "CORPORATE_REENGAGE_MANUAL",
    entityType: "corporate_account",
    entityId: id,
    changes: { contactId: account.contactId, cadenceId: cadence.id, alreadyEnrolled },
  });

  if (account.ownerUserId && account.ownerUserId !== user.id) {
    notify({
      userId: account.ownerUserId,
      title: "🏢 Account enrolled in re-engagement",
      message: `"${account.accountName}" was manually enrolled into the corporate re-engage cadence.`,
      type: "SYSTEM",
      actionUrl: `/accounts/${id}`,
    });
  }

  revalidatePath(`/accounts/${id}`);
  revalidatePath("/accounts");
  return { success: true, data: { enrollmentId, alreadyEnrolled } };
}

// ------------------------------------------------------------
// Cockpit stats
// ------------------------------------------------------------
export async function getCorporateFarmingStats(): Promise<
  Result<{
    total: number;
    byTier: Record<CorporateAccountTierValue, number>;
    dueThisQuarter: number;
    committed: number;
    churned: number;
    lifetimeRevenue: number;
  }>
> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "accounts:read")) {
    return { success: false, error: "Unauthorized" };
  }

  const now = new Date();
  const quarterEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [grouped, total, dueThisQuarter, committed, revenueAgg] = await Promise.all([
    prisma.corporateAccount.groupBy({ by: ["tier"], _count: { _all: true } }),
    prisma.corporateAccount.count(),
    prisma.corporateAccount.count({
      where: { tier: { not: "CHURNED" }, nextReengageAt: { not: null, lte: quarterEnd } },
    }),
    prisma.corporateAccount.count({ where: { committedEventsPerYear: { gt: 0 } } }),
    prisma.corporateAccount.aggregate({ _sum: { lifetimeRevenue: true } }),
  ]);

  const byTier: Record<CorporateAccountTierValue, number> = {
    PROSPECT: 0,
    ACTIVE: 0,
    KEY: 0,
    DORMANT: 0,
    CHURNED: 0,
  };
  for (const g of grouped) {
    byTier[g.tier as CorporateAccountTierValue] = g._count._all;
  }

  return {
    success: true,
    data: {
      total,
      byTier,
      dueThisQuarter,
      committed,
      churned: byTier.CHURNED,
      lifetimeRevenue: Number((revenueAgg._sum.lifetimeRevenue ?? new Prisma.Decimal(0)).toString()),
    },
  };
}
