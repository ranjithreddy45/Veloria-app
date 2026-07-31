"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createReferralSchema,
  updateReferralSchema,
  type CreateReferralInput,
  type UpdateReferralInput,
} from "@/schemas/referral.schema";
import type { ReferralStatus } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { generateUniqueCode, buildReferralLink } from "@/lib/referral-code";

// ============================================================
// Get Referrer Contact Options (for the new-referral form)
// ============================================================

export async function getReferrerContactOptions() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Creating a referral requires both the ability to create referrals
    // and to read the contact directory used to pick a referrer.
    if (
      !hasPermission(session.user.role, "referrals:create") ||
      !hasPermission(session.user.role, "contacts:read")
    ) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contacts = await prisma.contact.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
      orderBy: { firstName: "asc" },
    });

    return { success: true as const, data: serialize(contacts) };
  } catch (error) {
    console.error("[GET_REFERRER_CONTACT_OPTIONS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch contacts" };
  }
}

// ============================================================
// Get Referrals (List with filters)
// ============================================================

export async function getReferrals(params?: {
  status?: ReferralStatus;
  referrerContactId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }
    if (params?.referrerContactId) {
      where.referrerContactId = params.referrerContactId;
    }

    const referrals = await prisma.referral.findMany({
      where,
      include: {
        referrerContact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        referrerUser: {
          select: { id: true, name: true },
        },
        referrerVendor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(referrals) };
  } catch (error) {
    console.error("[GET_REFERRALS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referrals" };
  }
}

// ============================================================
// Get Referral By ID
// ============================================================

export async function getReferralById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const referral = await prisma.referral.findUnique({
      where: { id },
      include: {
        referrerContact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true,
          },
        },
      },
    });

    if (!referral) {
      return { success: false as const, error: "Referral not found" };
    }

    return { success: true as const, data: serialize(referral) };
  } catch (error) {
    console.error("[GET_REFERRAL_BY_ID_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referral" };
  }
}

// ============================================================
// Create Referral
// ============================================================

export async function createReferral(data: CreateReferralInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createReferralSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const referralData = parsed.data;

    // Verify the referrer contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: referralData.referrerContactId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!contact) {
      return { success: false as const, error: "Referrer contact not found" };
    }

    const referralCode = await generateUniqueCode();
    const referralLink = buildReferralLink(referralCode);

    const referral = await prisma.referral.create({
      data: {
        referrerContactId: referralData.referrerContactId,
        referredName: referralData.referredName,
        referredEmail: referralData.referredEmail || null,
        referredPhone: referralData.referredPhone || null,
        notes: referralData.notes || null,
        status: "PENDING",
        referralCode,
        referralLink,
      },
      include: {
        referrerContact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Referral",
      entityId: referral.id,
      changes: {
        referredName: referralData.referredName,
        referrerName: `${contact.firstName} ${contact.lastName}`,
      },
    });

    revalidatePath("/referrals");
    return { success: true as const, data: serialize(referral) };
  } catch (error) {
    console.error("[CREATE_REFERRAL_ERROR]", error);
    return { success: false as const, error: "Failed to create referral" };
  }
}

// ============================================================
// Update Referral
// ============================================================

export async function updateReferral(id: string, data: UpdateReferralInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = updateReferralSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.referral.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Referral not found" };
    }

    const updateData = parsed.data;

    const referral = await prisma.referral.update({
      where: { id },
      data: {
        ...(updateData.referredName !== undefined && {
          referredName: updateData.referredName,
        }),
        ...(updateData.referredEmail !== undefined && {
          referredEmail: updateData.referredEmail || null,
        }),
        ...(updateData.referredPhone !== undefined && {
          referredPhone: updateData.referredPhone || null,
        }),
        ...(updateData.status !== undefined && {
          status: updateData.status,
        }),
        ...(updateData.notes !== undefined && {
          notes: updateData.notes || null,
        }),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Referral",
      entityId: id,
    });

    revalidatePath("/referrals");
    revalidatePath(`/referrals/${id}`);
    return { success: true as const, data: serialize(referral) };
  } catch (error) {
    console.error("[UPDATE_REFERRAL_ERROR]", error);
    return { success: false as const, error: "Failed to update referral" };
  }
}

// ============================================================
// Process Referral — Creates a new Lead from referral data
// ============================================================

export async function processReferral(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const referral = await prisma.referral.findUnique({
      where: { id },
      include: {
        referrerContact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!referral) {
      return { success: false as const, error: "Referral not found" };
    }

    if (referral.status !== "PENDING") {
      return {
        success: false as const,
        error: "Only pending referrals can be processed",
      };
    }

    // Create a new Contact for the referred person
    const nameParts = referral.referredName.trim().split(/\s+/);
    const firstName = nameParts[0] || referral.referredName;
    const lastName = nameParts.slice(1).join(" ") || "";

    const newContact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email: referral.referredEmail || null,
        phone: referral.referredPhone || null,
        notes: `Referred by ${referral.referrerContact.firstName} ${referral.referrerContact.lastName}`,
        enquirySource: "DIRECT", // word of mouth, not a bought channel
      },
    });

    // Create a Lead from the referral
    const lead = await prisma.lead.create({
      data: {
        title: `Referral: ${referral.referredName}`,
        contactId: newContact.id,
        source: "REFERRAL",
        description: referral.notes || `Referred by ${referral.referrerContact.firstName} ${referral.referrerContact.lastName}`,
        score: 0,
        createdById: session.user.id,
      },
    });

    // Update referral status and store the converted lead ID
    const updatedReferral = await prisma.referral.update({
      where: { id },
      data: {
        status: "CONTACTED",
        convertedLeadId: lead.id,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "Referral",
      entityId: id,
      changes: {
        from: "PENDING",
        to: "CONTACTED",
        leadId: lead.id,
        contactId: newContact.id,
      },
    });

    notify({
      userId: session.user.id,
      type: "SYSTEM",
      title: "Referral Processed",
      message: `Referral from ${referral.referrerContact.firstName} ${referral.referrerContact.lastName} has been processed. A new lead has been created.`,
      actionUrl: `/leads/${lead.id}`,
    });

    revalidatePath("/referrals");
    revalidatePath(`/referrals/${id}`);
    revalidatePath("/leads");
    revalidatePath("/contacts");
    return { success: true as const, data: serialize(updatedReferral) };
  } catch (error) {
    console.error("[PROCESS_REFERRAL_ERROR]", error);
    return { success: false as const, error: "Failed to process referral" };
  }
}

// ============================================================
// Mark Referral as Converted — Awards reward points
// ============================================================

export async function markConverted(id: string, leadId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const referral = await prisma.referral.findUnique({
      where: { id },
      include: {
        referrerContact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!referral) {
      return { success: false as const, error: "Referral not found" };
    }

    if (referral.status === "CONVERTED") {
      return {
        success: false as const,
        error: "Referral is already converted",
      };
    }

    if (referral.status === "EXPIRED") {
      return {
        success: false as const,
        error: "Cannot convert an expired referral",
      };
    }

    const DEFAULT_REWARD_POINTS = 100;

    const updatedReferral = await prisma.referral.update({
      where: { id },
      data: {
        status: "CONVERTED",
        rewardPoints: DEFAULT_REWARD_POINTS,
        ...(leadId && { convertedLeadId: leadId }),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "Referral",
      entityId: id,
      changes: {
        from: referral.status,
        to: "CONVERTED",
        rewardPoints: DEFAULT_REWARD_POINTS,
      },
    });

    notify({
      userId: session.user.id,
      type: "SYSTEM",
      title: "Referral Converted",
      message: `Referral for ${referral.referredName} has been marked as converted. ${DEFAULT_REWARD_POINTS} reward points awarded.`,
      actionUrl: `/referrals/${id}`,
    });

    revalidatePath("/referrals");
    revalidatePath(`/referrals/${id}`);
    return { success: true as const, data: serialize(updatedReferral) };
  } catch (error) {
    console.error("[MARK_CONVERTED_ERROR]", error);
    return { success: false as const, error: "Failed to mark referral as converted" };
  }
}

// ============================================================
// Get Referral Stats
// ============================================================

export async function getReferralStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "referrals:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [total, pending, contacted, converted, expired] = await Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: "PENDING" } }),
      prisma.referral.count({ where: { status: "CONTACTED" } }),
      prisma.referral.count({ where: { status: "CONVERTED" } }),
      prisma.referral.count({ where: { status: "EXPIRED" } }),
    ]);

    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

    return {
      success: true as const,
      data: {
        total,
        pending,
        contacted,
        converted,
        expired,
        conversionRate,
      },
    };
  } catch (error) {
    console.error("[GET_REFERRAL_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch referral stats" };
  }
}
