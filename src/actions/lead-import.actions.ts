"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  type RawLeadRow,
  mapLeadStatus,
  normalizePhone,
  splitName,
  toNumber,
  parseFlexibleDate,
} from "@/lib/sales/lead-import";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface ImportSummary {
  imported: number;
  contactsCreated: number;
  contactsReused: number;
  replaced: number; // existing leads soft-deleted
  skipped: { row: number; reason: string }[];
}

// Map the sheet's "Event Details" shorthand to a friendly event type.
function mapEventType(raw?: string): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("bday") || s.includes("birth")) return "Birthday Party";
  if (s.startsWith("corp")) return "Corporate Event";
  if (s.includes("engage")) return "Engagement";
  if (s.includes("wed")) return "Wedding";
  if (s.includes("recep")) return "Reception";
  if (s.includes("anniv")) return "Anniversary";
  if (s.includes("sangeet")) return "Sangeet";
  if (s.includes("mehandi") || s.includes("mehendi")) return "Mehandi";
  if (s.includes("haldi")) return "Haldi";
  if (s.includes("baby")) return "Baby Shower";
  if (s.includes("naming")) return "Naming Ceremony";
  if (s.includes("conference")) return "Conference";
  if (s.includes("seminar")) return "Seminar";
  return raw!.trim();
}

function buildDescription(r: RawLeadRow): string {
  const parts: string[] = [];
  if (r.diningType) parts.push(`Dining: ${r.diningType}`);
  if (r.addOns) parts.push(`Add-ons: ${r.addOns}`);
  if (r.quoteValue) parts.push(`Quote: ₹${r.quoteValue}`);
  if (r.discount) parts.push(`Discount: ${r.discount}`);
  if (r.tokenPayment) parts.push(`Token paid: ₹${r.tokenPayment}`);
  if (r.remarks) parts.push(`Remarks: ${r.remarks}`);
  return parts.join("\n");
}

/**
 * Bulk-import sales leads from parsed spreadsheet rows. Backfill semantics:
 * creates Contacts (deduped by phone) + Leads WITHOUT firing capture
 * side-effects (no auto-welcome / cadences) since this is historical data.
 * `replaceExisting` soft-deletes all current leads first (reversible via Trash).
 */
export async function importSalesLeads(
  rows: RawLeadRow[],
  opts: { replaceExisting: boolean }
): Promise<Result<ImportSummary>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    const role = (session.user as { role?: string }).role;
    const userId = session.user.id as string;

    if (!hasPermission(role ?? "", "leads:create")) {
      return { success: false, error: "You don't have permission to import leads." };
    }
    if (opts.replaceExisting && !hasPermission(role ?? "", "leads:delete")) {
      return { success: false, error: "Replacing existing leads requires lead-delete permission." };
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, error: "No rows to import." };
    }
    if (rows.length > 5000) {
      return { success: false, error: "Too many rows (max 5000 per import)." };
    }

    // Pre-load venues + active users once for name resolution.
    const [venues, users] = await Promise.all([
      prisma.venue.findMany({ select: { id: true, name: true } }),
      prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);
    const resolveVenue = (hall?: string): string | null => {
      const h = (hall ?? "").trim().toLowerCase();
      if (!h) return null;
      const token = h.split(/\s+/)[0]; // "grand" from "grand hall"
      const hit =
        venues.find((v) => v.name.toLowerCase() === h) ??
        venues.find((v) => v.name.toLowerCase().includes(token));
      return hit?.id ?? null;
    };
    const resolveOwner = (owner?: string): string | null => {
      const o = (owner ?? "").trim().toLowerCase();
      if (!o) return null;
      const hit =
        users.find((u) => (u.name ?? "").toLowerCase() === o) ??
        users.find((u) => (u.name ?? "").toLowerCase().includes(o.split(/\s+/)[0]));
      return hit?.id ?? null;
    };

    const summary: ImportSummary = {
      imported: 0,
      contactsCreated: 0,
      contactsReused: 0,
      replaced: 0,
      skipped: [],
    };

    await prisma.$transaction(
      async (tx) => {
        if (opts.replaceExisting) {
          // Never soft-delete leads that are converted (own a Deal) or already
          // resolved (WON/LOST) — doing so orphans the linked Deal/Booking and
          // diverges pipeline KPIs. This mirrors the single-lead delete guard in
          // lead.actions.ts ("Cannot delete a lead that has been converted...").
          const del = await tx.lead.updateMany({
            where: {
              deletedAt: null,
              deal: { is: null },
              status: { notIn: ["WON", "LOST"] },
            },
            data: { deletedAt: new Date() },
          });
          summary.replaced = del.count;
        }

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const rowNo = i + 2; // +1 header, +1 to 1-index for the user
          const name = (r.leadName ?? "").trim();
          const phone = normalizePhone(r.phone);
          if (!name && !phone) {
            summary.skipped.push({ row: rowNo, reason: "No name or phone" });
            continue;
          }

          // Resolve / create the contact (dedupe by phone).
          let contactId: string | null = null;
          if (phone) {
            const existing = await tx.contact.findFirst({
              where: { phone, deletedAt: null },
              select: { id: true },
            });
            if (existing) {
              contactId = existing.id;
              summary.contactsReused++;
            }
          }
          if (!contactId) {
            const { firstName, lastName } = splitName(name || "Unknown");
            const contact = await tx.contact.create({
              data: {
                firstName,
                lastName,
                phone: phone ?? null,
                email: r.email?.trim() || null,
                company: r.company?.trim() || null,
                type: r.company?.trim() ? "CORPORATE" : "INDIVIDUAL",
                customerType: "New",
              },
              select: { id: true },
            });
            contactId = contact.id;
            summary.contactsCreated++;
          }

          const enquiry = parseFlexibleDate(r.enquiryDate);
          const eventType = mapEventType(r.eventDetails);
          const title = eventType ? `${name || "Lead"} — ${eventType}` : name || "Imported lead";

          await tx.lead.create({
            data: {
              title,
              contactId,
              createdById: userId,
              assignedToId: resolveOwner(r.owner),
              preferredVenueId: resolveVenue(r.hall),
              status: mapLeadStatus(r.status) as never,
              source: "WALK_IN" as never,
              eventType: eventType ?? null,
              eventDate: parseFlexibleDate(r.eventDate),
              guestCount: toNumber(r.attendees) ?? null,
              estimatedValue: toNumber(r.quoteValue) ?? null,
              slot: r.timeSlot?.trim() || null,
              description: buildDescription(r) || null,
              ...(enquiry ? { createdAt: enquiry } : {}),
            },
          });
          summary.imported++;
        }
      },
      { timeout: 30000 }
    );

    revalidatePath("/leads");
    revalidatePath("/contacts");
    return { success: true, data: summary };
  } catch (error) {
    console.error("[IMPORT_SALES_LEADS_ERROR]", error);
    return { success: false, error: "Import failed. No changes were saved." };
  }
}
