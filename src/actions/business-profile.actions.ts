"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { getPublicContactDetails, type PublicContactDetails } from "@/lib/public/business-contact";
import {
  BUSINESS_PROFILE_FIELDS,
  diffFields,
  validateBusinessProfileInput,
  type BusinessProfileData,
  type BusinessProfileField,
  type BusinessProfileInput,
  type FieldErrors,
} from "@/app/(dashboard)/settings/business-contact/_lib/contact-rules";

// ============================================================
// Settings → Business contact. One BusinessProfile row, read by every
// customer screen through getPublicContact(). Gated exactly like
// Settings → Venues (createVenue / updateVenue): settings:venues.
// ============================================================

export interface BusinessContactSettings {
  /** The saved row, or null when nothing has been saved yet. */
  profile: (BusinessProfileData & { id: string; updatedAt: string; updatedByName: string | null }) | null;
  /** What customers see right now, including the env fallback. */
  live: PublicContactDetails;
}

type Gate = { ok: true; userId: string } | { ok: false; error: string };

async function requireVenueSettings(): Promise<Gate> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "settings:venues")) return { ok: false, error: "Insufficient permissions" };
  return { ok: true, userId: session.user.id };
}

function pickFields(row: Record<BusinessProfileField, string | null>): BusinessProfileData {
  return Object.fromEntries(BUSINESS_PROFILE_FIELDS.map((field) => [field, row[field] ?? null])) as BusinessProfileData;
}

export async function getBusinessContactSettings(): Promise<
  { success: true; data: BusinessContactSettings } | { success: false; error: string }
> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };
  try {
    const row = await prisma.businessProfile.findFirst({ orderBy: { updatedAt: "desc" } });
    const [editor, live] = await Promise.all([
      row?.updatedById ? prisma.user.findUnique({ where: { id: row.updatedById }, select: { name: true, email: true } }) : null,
      getPublicContactDetails(),
    ]);
    return {
      success: true,
      data: {
        profile: row
          ? { id: row.id, ...pickFields(row), updatedAt: row.updatedAt.toISOString(), updatedByName: editor?.name ?? editor?.email ?? null }
          : null,
        live,
      },
    };
  } catch (error) {
    console.error("[GET_BUSINESS_CONTACT_ERROR]", error);
    return { success: false, error: "Couldn't load the business contact details." };
  }
}

export async function saveBusinessProfile(
  input: BusinessProfileInput
): Promise<
  | { success: true; data: { changed: boolean; updatedAt: string | null } }
  | { success: false; error: string; fieldErrors?: FieldErrors<BusinessProfileField> }
> {
  const gate = await requireVenueSettings();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = validateBusinessProfileInput(input);
  if (!parsed.ok) return { success: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };

  try {
    const existing = await prisma.businessProfile.findFirst({ orderBy: { updatedAt: "desc" } });
    const changes = diffFields(existing, parsed.data);
    if (Object.keys(changes).length === 0) {
      return { success: true, data: { changed: false, updatedAt: existing?.updatedAt.toISOString() ?? null } };
    }

    const row = existing
      ? await prisma.businessProfile.update({ where: { id: existing.id }, data: { ...parsed.data, updatedById: gate.userId } })
      : await prisma.businessProfile.create({ data: { ...parsed.data, updatedById: gate.userId } });

    await logActivity({
      userId: gate.userId,
      action: existing ? "updated" : "created",
      entityType: "BusinessProfile",
      entityId: row.id,
      changes,
    });

    revalidatePath("/settings/business-contact");
    revalidatePath("/app", "layout"); // every customer screen that shows a contact button
    return { success: true, data: { changed: true, updatedAt: row.updatedAt.toISOString() } };
  } catch (error) {
    console.error("[SAVE_BUSINESS_CONTACT_ERROR]", error);
    return { success: false, error: "Couldn't save the business contact details." };
  }
}
