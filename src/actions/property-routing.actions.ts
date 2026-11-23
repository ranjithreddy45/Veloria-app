"use server";

// ============================================================
// Property routing settings (Google Ads brief, Nov 2026).
// Read: settings:read. Write: settings:update. The routing itself runs in
// src/lib/crm/property-routing.ts; these actions only edit its two tables.
// ============================================================

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { PROPERTY_KEYS } from "@/lib/crm/property-routing";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface PropertyRow {
  id: string;
  key: string;
  name: string;
  matchTerms: string[];
  corporateOnly: boolean;
  ownerId: string | null;
  venueId: string | null;
  isActive: boolean;
}

export interface CampaignRow {
  id: string;
  campaignId: string;
  campaignName: string | null;
  propertyKey: string | null;
  isActive: boolean;
}

export interface PropertyRoutingData {
  properties: PropertyRow[];
  campaigns: CampaignRow[];
  users: { id: string; name: string | null; role: string; isActive: boolean }[];
  venues: { id: string; name: string }[];
}

const ASSIGNABLE_ROLES = ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"];

async function gate(perm: "settings:read" | "settings:update") {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };
  if (!hasPermission(session.user.role, perm)) return { ok: false as const, error: "Insufficient permissions" };
  return { ok: true as const, userId: session.user.id };
}

export async function getPropertyRouting(): Promise<Result<PropertyRoutingData>> {
  const g = await gate("settings:read");
  if (!g.ok) return { success: false, error: g.error };
  try {
    const [properties, campaigns, users, venues] = await Promise.all([
      prisma.leadProperty.findMany({
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
        select: { id: true, key: true, name: true, matchTerms: true, corporateOnly: true, ownerId: true, venueId: true, isActive: true },
      }),
      prisma.leadCampaignRoute.findMany({
        orderBy: [{ campaignName: "asc" }],
        select: { id: true, campaignId: true, campaignName: true, propertyKey: true, isActive: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ASSIGNABLE_ROLES as never } },
        select: { id: true, name: true, role: true, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.venue.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      success: true,
      data: { properties, campaigns, users: users.map((u) => ({ ...u, role: String(u.role) })), venues },
    };
  } catch (e) {
    console.error("getPropertyRouting error:", e);
    return { success: false, error: "Failed to load property routing" };
  }
}

function cleanTerms(terms: unknown): string[] {
  const list = Array.isArray(terms) ? terms : String(terms ?? "").split(",");
  return Array.from(
    new Set(
      list
        .map((t) => String(t).toLowerCase().replace(/\s+/g, " ").trim())
        .filter((t) => t.length >= 3)
    )
  ).slice(0, 20);
}

export async function savePropertyRow(input: {
  key: string;
  name: string;
  matchTerms: string[] | string;
  corporateOnly: boolean;
  ownerId: string | null;
  venueId: string | null;
  isActive: boolean;
}): Promise<Result<PropertyRow>> {
  const g = await gate("settings:update");
  if (!g.ok) return { success: false, error: g.error };
  const key = String(input.key ?? "").trim();
  if (!(PROPERTY_KEYS as readonly string[]).includes(key)) {
    return { success: false, error: `Unknown property "${key}". Allowed: ${PROPERTY_KEYS.join(", ")}` };
  }
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { success: false, error: "Display name is required" };
  try {
    if (input.ownerId) {
      const u = await prisma.user.findUnique({ where: { id: input.ownerId }, select: { id: true } });
      if (!u) return { success: false, error: "Owner not found" };
    }
    if (input.venueId) {
      const v = await prisma.venue.findUnique({ where: { id: input.venueId }, select: { id: true } });
      if (!v) return { success: false, error: "Venue not found" };
    }
    const data = {
      name,
      matchTerms: cleanTerms(input.matchTerms),
      corporateOnly: !!input.corporateOnly,
      ownerId: input.ownerId || null,
      venueId: input.venueId || null,
      isActive: input.isActive !== false,
      sortOrder: PROPERTY_KEYS.indexOf(key as (typeof PROPERTY_KEYS)[number]),
    };
    const row = await prisma.leadProperty.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
      select: { id: true, key: true, name: true, matchTerms: true, corporateOnly: true, ownerId: true, venueId: true, isActive: true },
    });
    await logActivity({
      userId: g.userId,
      action: "property_routing_updated",
      entityType: "LeadProperty",
      entityId: row.id,
      changes: { key, ownerId: row.ownerId, corporateOnly: row.corporateOnly, isActive: row.isActive },
    }).catch(() => {});
    return { success: true, data: row };
  } catch (e) {
    console.error("savePropertyRow error:", e);
    return { success: false, error: "Failed to save property" };
  }
}

export async function saveCampaignRoute(input: {
  campaignId: string;
  campaignName: string | null;
  propertyKey: string | null;
  isActive: boolean;
}): Promise<Result<CampaignRow>> {
  const g = await gate("settings:update");
  if (!g.ok) return { success: false, error: g.error };
  const campaignId = String(input.campaignId ?? "").replace(/\D/g, "");
  if (campaignId.length < 6) {
    return { success: false, error: "Campaign ID must be the number from the Google Ads URL (campaignId=…)" };
  }
  const propertyKey = input.propertyKey ? String(input.propertyKey) : null;
  try {
    if (propertyKey) {
      const p = await prisma.leadProperty.findUnique({ where: { key: propertyKey }, select: { id: true } });
      if (!p) return { success: false, error: "Save that property first" };
    }
    const data = {
      campaignName: input.campaignName ? String(input.campaignName).trim().slice(0, 120) : null,
      propertyKey,
      isActive: input.isActive !== false,
    };
    const row = await prisma.leadCampaignRoute.upsert({
      where: { campaignId },
      create: { campaignId, ...data },
      update: data,
      select: { id: true, campaignId: true, campaignName: true, propertyKey: true, isActive: true },
    });
    await logActivity({
      userId: g.userId,
      action: "campaign_route_updated",
      entityType: "LeadCampaignRoute",
      entityId: row.id,
      changes: { campaignId, propertyKey },
    }).catch(() => {});
    return { success: true, data: row };
  } catch (e) {
    console.error("saveCampaignRoute error:", e);
    return { success: false, error: "Failed to save campaign" };
  }
}

export async function deleteCampaignRoute(id: string): Promise<Result<{ id: string }>> {
  const g = await gate("settings:update");
  if (!g.ok) return { success: false, error: g.error };
  try {
    await prisma.leadCampaignRoute.delete({ where: { id } });
    await logActivity({
      userId: g.userId,
      action: "campaign_route_deleted",
      entityType: "LeadCampaignRoute",
      entityId: id,
      changes: {},
    }).catch(() => {});
    return { success: true, data: { id } };
  } catch (e) {
    console.error("deleteCampaignRoute error:", e);
    return { success: false, error: "Failed to delete campaign" };
  }
}
