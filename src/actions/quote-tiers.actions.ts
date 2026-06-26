"use server";

// ============================================================
// Quote Tiers (Good-Better-Best) — INTERNAL rep builder actions.
// ------------------------------------------------------------
// A rep clones an APPROVED/SENT base quotation into 2-3 priced sibling variants
// sharing a quoteGroupId, then bundles them under one QuoteShareLink with a
// QuoteTier row per APPROVED sibling and shares /q/<token>.
//
// REUSE, don't fork: cloning + pricing go through the existing
// createSalesQuotation / submitSalesQuotation / approveSalesQuotation engine
// (single source of truth for VG-Q numbering, snapshot freeze, segregation of
// duties). This file only adds the group glue + the share-link publish.
//
// RBAC: build actions gate quotes:create / quotes:update; publish gates
// publicquotes:manage. Segregation of duties on approve still applies — a rep
// who is not an approver leaves siblings PENDING_APPROVAL and the publish step
// reports a clear "tiers pending approval" state.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma, type QuoteTierLabel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { serialize } from "@/lib/utils";
import {
  createSalesQuotation,
  submitSalesQuotation,
  approveSalesQuotation,
} from "@/actions/sales-quotation.actions";
import { type QuotationInput, type QuotationResult } from "@/lib/sales/quotation-calc";
import {
  genQuoteToken,
  TIER_PRESETS,
  resolveTierLabel,
  buildTierComparison,
  buildTierShareCaption,
  type TierWithOutputs,
} from "@/lib/sales/quote-tiers";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

function can(role: string | undefined, perm: string): boolean {
  return !!role && hasPermission(role, perm);
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";
}

export interface TierSpec {
  /** "SILVER" | "GOLD" | "PLATINUM" | "CUSTOM" (free displayName allowed). */
  label?: string;
  displayName?: string;
  /** The calculator inputs for this tier (priced via computeQuotation). */
  input: QuotationInput;
  isRecommended?: boolean;
}

// ============================================================
// createTierGroup — clone the base into N DRAFT siblings under one quoteGroupId.
// ============================================================
export async function createTierGroup(
  baseQuotationId: string,
  tiers: TierSpec[]
): Promise<Result<{ quoteGroupId: string; quotationIds: string[] }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:create"))
    return { success: false, error: "You don't have permission to build quote tiers." };
  if (!tiers || tiers.length < 1) return { success: false, error: "Add at least one tier." };
  if (tiers.length > 4) return { success: false, error: "A tier group can have at most 4 tiers." };

  const base = await prisma.salesQuotation.findUnique({
    where: { id: baseQuotationId },
    select: {
      id: true,
      status: true,
      quoteGroupId: true,
      clientName: true,
      clientPhone: true,
      clientEmail: true,
      occasion: true,
      eventDate: true,
      timeSlot: true,
      leadId: true,
      contactId: true,
      venueId: true,
      notes: true,
    },
  });
  if (!base) return { success: false, error: "Base quotation not found." };
  if (base.status !== "APPROVED" && base.status !== "SENT")
    return { success: false, error: "Only an approved or sent quotation can seed a tier group." };

  // Reuse the base's group if it already has one (so re-runs extend, not fork).
  const quoteGroupId = base.quoteGroupId || `qg_${genQuoteToken().slice(0, 18)}`;
  const quotationIds: string[] = [];

  try {
    // Loop SEQUENTIALLY (not Promise.all) — each createSalesQuotation allocates a
    // VG-Q number inside its own Serializable txn; concurrency would thrash retries.
    for (const t of tiers) {
      const meta = {
        clientName: base.clientName ?? undefined,
        clientPhone: base.clientPhone ?? undefined,
        clientEmail: base.clientEmail ?? undefined,
        occasion: base.occasion ?? undefined,
        eventDate: base.eventDate ?? undefined,
        timeSlot: base.timeSlot ?? undefined,
        notes: base.notes ?? undefined,
        leadId: base.leadId ?? undefined,
        contactId: base.contactId ?? undefined,
        venueId: base.venueId ?? undefined,
      };
      const created = await createSalesQuotation(t.input, meta);
      if (!created.success) return { success: false, error: created.error };
      const newId = created.data.id;
      // Stamp the shared group + tier label (additive string columns).
      const label = resolveTierLabel(t.label ?? t.displayName);
      await prisma.salesQuotation.update({
        where: { id: newId },
        data: { quoteGroupId, tierLabel: t.displayName?.trim() || label },
      });
      quotationIds.push(newId);
    }

    after(() =>
      logActivity({
        userId: user.id,
        action: "QUOTE_TIER_GROUP_CREATED",
        entityType: "SalesQuotation",
        entityId: baseQuotationId,
        changes: { quoteGroupId, tierCount: quotationIds.length },
      })
    );

    revalidatePath(`/quotations/${baseQuotationId}`);
    revalidatePath(`/quotations/${baseQuotationId}/tiers`);
    return { success: true, data: { quoteGroupId, quotationIds } };
  } catch (e) {
    console.error("[CREATE_TIER_GROUP_ERROR]", e);
    return { success: false, error: "Could not build the tier group. Please try again." };
  }
}

// ============================================================
// submitAndApproveTier — drive ONE sibling through submit → approve so its
// outputsJson freezes. Segregation of duties: a non-approver gets a clear
// "pending approval" error rather than a silent skip.
// ============================================================
export async function submitAndApproveTier(
  quotationId: string
): Promise<Result<{ status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:create"))
    return { success: false, error: "Unauthorized" };

  const q = await prisma.salesQuotation.findUnique({
    where: { id: quotationId },
    select: { status: true },
  });
  if (!q) return { success: false, error: "Tier quotation not found." };

  if (q.status === "DRAFT") {
    const submitted = await submitSalesQuotation(quotationId);
    if (!submitted.success) return { success: false, error: submitted.error };
  }
  // Only an approver (and not the submitter, unless SUPER_ADMIN) can freeze it.
  if (can(user.role, "quotes:approve")) {
    const approved = await approveSalesQuotation(quotationId);
    if (!approved.success) return { success: false, error: approved.error };
    return { success: true, data: { status: "APPROVED" } };
  }
  return {
    success: false,
    error: "Tier submitted — a sales manager must approve it before it can be published.",
  };
}

// ============================================================
// setRecommendedTier — flag one published tier as the anchor (presentational).
// ============================================================
export async function setRecommendedTier(
  shareLinkId: string,
  quotationId: string
): Promise<Result<{ updated: boolean }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "publicquotes:manage"))
    return { success: false, error: "Unauthorized" };
  try {
    await prisma.$transaction([
      prisma.quoteTier.updateMany({ where: { shareLinkId }, data: { isRecommended: false } }),
      prisma.quoteTier.updateMany({ where: { shareLinkId, quotationId }, data: { isRecommended: true } }),
    ]);
    return { success: true, data: { updated: true } };
  } catch (e) {
    console.error("[SET_RECOMMENDED_TIER_ERROR]", e);
    return { success: false, error: "Could not update the recommended tier." };
  }
}

// ============================================================
// removeTier — drop a tier row from a published link (does not delete the quote).
// ============================================================
export async function removeTier(
  shareLinkId: string,
  quotationId: string
): Promise<Result<{ removed: boolean }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "publicquotes:manage"))
    return { success: false, error: "Unauthorized" };
  try {
    await prisma.quoteTier.deleteMany({ where: { shareLinkId, quotationId } });
    return { success: true, data: { removed: true } };
  } catch (e) {
    console.error("[REMOVE_TIER_ERROR]", e);
    return { success: false, error: "Could not remove the tier." };
  }
}

// ============================================================
// publishTierShareLink — mint a QuoteShareLink for the group + one QuoteTier per
// APPROVED sibling. Requires every included sibling to be APPROVED/SENT (frozen
// outputsJson) so the public page + selectTier price from the snapshot, never a
// recompute.
// ============================================================
export interface PublishTierOptions {
  /** override the auto preset display names / order / recommended flag. */
  tierMeta?: { quotationId: string; displayName?: string; order?: number; isRecommended?: boolean }[];
  showSocialProof?: boolean;
  expiresAt?: string | null;
}

export async function publishTierShareLink(
  quoteGroupId: string,
  opts?: PublishTierOptions
): Promise<Result<{ shareLinkId: string; token: string; url: string; caption: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "publicquotes:manage"))
    return { success: false, error: "You don't have permission to publish a tier link." };

  const siblings = await prisma.salesQuotation.findMany({
    where: { quoteGroupId },
    select: {
      id: true,
      status: true,
      tierLabel: true,
      grandTotal: true,
      outputsJson: true,
      clientName: true,
      clientPhone: true,
      occasion: true,
      eventDate: true,
      timeSlot: true,
      leadId: true,
      contactId: true,
      venueId: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (siblings.length === 0) return { success: false, error: "No tiers found for this group." };

  const notReady = siblings.filter((s) => s.status !== "APPROVED" && s.status !== "SENT");
  if (notReady.length > 0)
    return {
      success: false,
      error: `${notReady.length} tier(s) still need approval before publishing.`,
    };

  const headline = siblings[0];
  const presetByOrder = ["SILVER", "GOLD", "PLATINUM"] as const;

  try {
    const token = genQuoteToken();
    const result = await prisma.$transaction(async (tx) => {
      const link = await tx.quoteShareLink.create({
        data: {
          token,
          status: "ACTIVE",
          quoteGroupId,
          primaryQuotationId: headline.id,
          leadId: headline.leadId || null,
          contactId: headline.contactId || null,
          venueId: headline.venueId || null,
          clientName: headline.clientName || null,
          clientPhone: headline.clientPhone || null,
          occasion: headline.occasion || null,
          eventDate: headline.eventDate || null,
          timeSlot: headline.timeSlot || null,
          grandTotal: headline.grandTotal ?? new Prisma.Decimal(0),
          showSocialProof: opts?.showSocialProof ?? true,
          expiresAt: opts?.expiresAt ? new Date(opts.expiresAt) : null,
          createdById: user.id,
        },
        select: { id: true },
      });

      for (let i = 0; i < siblings.length; i++) {
        const s = siblings[i];
        const override = opts?.tierMeta?.find((m) => m.quotationId === s.id);
        const preset = TIER_PRESETS[presetByOrder[Math.min(i, 2)]];
        const label: QuoteTierLabel = resolveTierLabel(s.tierLabel ?? preset.label);
        await tx.quoteTier.create({
          data: {
            shareLinkId: link.id,
            label,
            displayName: override?.displayName?.trim() || s.tierLabel || preset.displayName,
            order: override?.order ?? i,
            quotationId: s.id,
            grandTotal: s.grandTotal ?? new Prisma.Decimal(0),
            isRecommended: override?.isRecommended ?? preset.isRecommended,
          },
        });
      }
      return link;
    });

    // Stamp the headline quotation so the rep UI shows "shared".
    await prisma.salesQuotation
      .update({ where: { id: headline.id }, data: { shareLinkToken: token } })
      .catch(() => {});

    // Build the WhatsApp caption from the published comparison (best-effort).
    const url = `${appUrl()}/q/${token}`;
    const comparison = buildTierComparison(
      siblings.map((s, i) => ({
        quotationId: s.id,
        label: resolveTierLabel(s.tierLabel ?? presetByOrder[Math.min(i, 2)]),
        displayName: s.tierLabel || TIER_PRESETS[presetByOrder[Math.min(i, 2)]].displayName,
        order: i,
        isRecommended: TIER_PRESETS[presetByOrder[Math.min(i, 2)]].isRecommended,
        isSelected: false,
        outputs: (s.outputsJson as unknown as QuotationResult) ?? null,
      }) as TierWithOutputs)
    );
    const caption = buildTierShareCaption(
      { clientName: headline.clientName, occasion: headline.occasion, eventDate: headline.eventDate, url },
      comparison
    );

    after(() =>
      logActivity({
        userId: user.id,
        action: "QUOTE_TIER_LINK_PUBLISHED",
        entityType: "QuoteShareLink",
        entityId: result.id,
        changes: { quoteGroupId, token, tierCount: siblings.length },
      })
    );

    revalidatePath(`/quotations/${headline.id}/tiers`);
    return { success: true, data: { shareLinkId: result.id, token, url, caption } };
  } catch (e) {
    console.error("[PUBLISH_TIER_SHARE_LINK_ERROR]", e);
    return { success: false, error: "Could not publish the tier link. Please try again." };
  }
}

// ============================================================
// getTierGroup — rep builder data (siblings + any published link).
// ============================================================
export async function getTierGroup(quoteGroupId: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:read")) return { success: false, error: "Unauthorized" };
  try {
    const [siblings, link] = await Promise.all([
      prisma.salesQuotation.findMany({
        where: { quoteGroupId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          tierLabel: true,
          grandTotal: true,
          guestCount: true,
          outputsJson: true,
        },
      }),
      prisma.quoteShareLink.findFirst({
        where: { quoteGroupId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          token: true,
          status: true,
          viewCount: true,
          firstViewedAt: true,
          lastViewedAt: true,
          tiers: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              quotationId: true,
              displayName: true,
              order: true,
              grandTotal: true,
              isRecommended: true,
              isSelected: true,
            },
          },
        },
      }),
    ]);
    return {
      success: true,
      data: serialize({
        quoteGroupId,
        siblings,
        link: link ? { ...link, url: `${appUrl()}/q/${link.token}` } : null,
      }),
    };
  } catch (e) {
    console.error("[GET_TIER_GROUP_ERROR]", e);
    return { success: false, error: "Could not load the tier group." };
  }
}

// ============================================================
// revokeTierShareLink — REVOKE a published tier link.
// ============================================================
export async function revokeTierShareLink(shareLinkId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "publicquotes:manage"))
    return { success: false, error: "Unauthorized" };
  try {
    const link = await prisma.quoteShareLink.findUnique({
      where: { id: shareLinkId },
      select: { id: true, status: true, primaryQuotationId: true, token: true },
    });
    if (!link) return { success: false, error: "Share link not found." };
    if (link.status !== "REVOKED")
      await prisma.quoteShareLink.update({ where: { id: shareLinkId }, data: { status: "REVOKED" } });
    if (link.primaryQuotationId)
      await prisma.salesQuotation
        .updateMany({
          where: { id: link.primaryQuotationId, shareLinkToken: link.token },
          data: { shareLinkToken: null },
        })
        .catch(() => {});
    return { success: true, data: { id: shareLinkId } };
  } catch (e) {
    console.error("[REVOKE_TIER_SHARE_LINK_ERROR]", e);
    return { success: false, error: "Could not revoke the tier link." };
  }
}
