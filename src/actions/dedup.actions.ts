"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { normalizeEmail, phoneDigits } from "@/lib/dedup";

// ============================================================
// Duplicate finder — groups customer-facing records by their normalised
// natural keys (email / phone) so existing duplicates can be reviewed and
// cleaned BEFORE hard DB unique constraints are applied. Read-only, admin-only.
// ============================================================

export type DupMember = {
  id: string;
  label: string;
  href: string;
  // Shown in the merge picker so an admin can choose which record to keep.
  detail?: string;
};
export type DupGroup = {
  entity: string;
  keyType: "email" | "phone";
  key: string;
  members: DupMember[];
};

type Row = { id: string; label: string; href: string; email?: string | null; phone?: string | null };

function groupRows(rows: Row[], entity: string): DupGroup[] {
  const byEmail = new Map<string, DupMember[]>();
  const byPhone = new Map<string, DupMember[]>();
  for (const r of rows) {
    const detail = [r.phone, r.email].filter(Boolean).join(" · ") || undefined;
    const m: DupMember = { id: r.id, label: r.label || entity, href: r.href, detail };
    const e = normalizeEmail(r.email);
    if (e) {
      if (!byEmail.has(e)) byEmail.set(e, []);
      byEmail.get(e)!.push(m);
    }
    const p = phoneDigits(r.phone);
    if (p) {
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p)!.push(m);
    }
  }
  const out: DupGroup[] = [];
  const seen = new Set<string>();
  const emit = (map: Map<string, DupMember[]>, keyType: "email" | "phone") => {
    for (const [key, members] of map) {
      if (members.length < 2) continue;
      const sig = members.map((x) => x.id).sort().join(",");
      if (seen.has(sig)) continue; // same set already reported (e.g. via email)
      seen.add(sig);
      out.push({ entity, keyType, key, members });
    }
  };
  emit(byEmail, "email");
  emit(byPhone, "phone");
  return out;
}

export async function findDuplicates(): Promise<{ success: boolean; groups: DupGroup[]; error?: string }> {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!["SUPER_ADMIN", "ADMIN"].includes(role ?? "")) {
      return { success: false, groups: [], error: "Admins only" };
    }

    const [contacts, vendors, owners, acqLeads] = await Promise.all([
      prisma.contact.findMany({
        where: { deletedAt: null },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      }),
      prisma.vendor.findMany({ select: { id: true, name: true, email: true, phone: true } }),
      prisma.hallOwner.findMany({ select: { id: true, ownerName: true, email: true, phone: true } }),
      prisma.acqLead.findMany({
        where: { deletedAt: null },
        select: { id: true, ownerName: true, email: true, mobilePrimary: true },
      }),
    ]);

    const groups: DupGroup[] = [
      ...groupRows(
        contacts.map((c) => ({
          id: c.id,
          label: `${c.firstName} ${c.lastName ?? ""}`.trim(),
          href: `/contacts/${c.id}`,
          email: c.email,
          phone: c.phone,
        })),
        "Contacts"
      ),
      ...groupRows(
        vendors.map((v) => ({ id: v.id, label: v.name, href: `/vendors/${v.id}`, email: v.email, phone: v.phone })),
        "Vendors"
      ),
      ...groupRows(
        owners.map((o) => ({ id: o.id, label: o.ownerName, href: `/owners/${o.id}/edit`, email: o.email, phone: o.phone })),
        "Hall owners"
      ),
      ...groupRows(
        acqLeads.map((l) => ({ id: l.id, label: l.ownerName, href: `/bd/leads/${l.id}`, email: l.email, phone: l.mobilePrimary })),
        "BD leads"
      ),
    ];

    return { success: true, groups };
  } catch (error) {
    console.error("[FIND_DUPLICATES_ERROR]", error);
    return { success: false, groups: [], error: "Failed to scan for duplicates" };
  }
}

// ============================================================
// Merge duplicate CONTACTS (enquiries).
// ------------------------------------------------------------
// Reassigns every child record from the loser contacts to the kept "winner",
// fills in any blank fields on the winner from the losers, then SOFT-deletes the
// losers. Soft-delete (not hard) is deliberate: the loser rows remain, so any
// plain-ref pointer we don't explicitly move can never become a dangling FK —
// it just points at a hidden contact. All modeled + follow-up relations ARE
// moved, so nothing disappears from the pipeline. Admin-only, transactional.
// ============================================================

type MergeResult = { success: true; movedFrom: number } | { success: false; error: string };

// Pick the winner's value if present, else the first loser that has one.
function firstNonEmpty<T>(winner: T | null | undefined, losers: (T | null | undefined)[]): T | null {
  if (winner !== null && winner !== undefined && winner !== ("" as unknown as T)) return winner;
  for (const l of losers) {
    if (l !== null && l !== undefined && l !== ("" as unknown as T)) return l;
  }
  return (winner ?? null) as T | null;
}

export async function mergeContacts(winnerId: string, loserIds: string[]): Promise<MergeResult> {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;
    const userId = session?.user?.id;
    if (!["SUPER_ADMIN", "ADMIN"].includes(role ?? "")) {
      return { success: false, error: "Admins only" };
    }

    const losers = Array.from(new Set(loserIds.filter((id) => id && id !== winnerId)));
    if (!winnerId || losers.length === 0) {
      return { success: false, error: "Pick one record to keep and at least one to merge in." };
    }

    // All ids must be real, non-deleted contacts.
    const rows = await prisma.contact.findMany({
      where: { id: { in: [winnerId, ...losers] }, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true, alternatePhone: true,
        company: true, designation: true, address: true, city: true, state: true, pincode: true,
        notes: true, tags: true, vipCustomer: true, anniversary: true, enquiryVenueId: true,
        enquirySource: true, enquiryStatus: true, customerType: true, corporateAccountId: true,
      },
    });
    const winner = rows.find((r) => r.id === winnerId);
    const loserRows = rows.filter((r) => losers.includes(r.id));
    if (!winner) return { success: false, error: "The record to keep no longer exists." };
    if (loserRows.length === 0) return { success: false, error: "The records to merge no longer exist." };

    const where = { contactId: { in: loserRows.map((r) => r.id) } } as const;
    const data = { contactId: winnerId } as const;

    await prisma.$transaction(async (tx) => {
      // ── Reassign modeled list-relations (nothing is lost from the pipeline) ──
      await tx.lead.updateMany({ where, data });
      await tx.booking.updateMany({ where, data });
      await tx.invoice.updateMany({ where, data });
      await tx.quote.updateMany({ where, data });
      await tx.contract.updateMany({ where, data });
      await tx.communication.updateMany({ where, data });
      await tx.whatsAppMessage.updateMany({ where, data });
      // Referral references the contact as the REFERRER (referrerContactId).
      await tx.referral.updateMany({
        where: { referrerContactId: { in: loserRows.map((r) => r.id) } },
        data: { referrerContactId: winnerId },
      });
      await tx.review.updateMany({ where, data });
      await tx.callLog.updateMany({ where, data });
      await tx.salesQuotation.updateMany({ where, data });
      await tx.reviewRequest.updateMany({ where, data });
      // Enquiry follow-ups / reminders (Task carries a plain contactId).
      await tx.task.updateMany({ where, data });

      // ── One-to-one uniques: move only if the winner doesn't already have one ──
      const winnerLoyalty = await tx.loyaltyAccount.findUnique({ where: { contactId: winnerId }, select: { id: true } });
      if (!winnerLoyalty) {
        const l = await tx.loyaltyAccount.findFirst({ where, select: { id: true } });
        if (l) await tx.loyaltyAccount.update({ where: { id: l.id }, data });
      }
      const winnerCorp = await tx.corporateAccount.findUnique({ where: { contactId: winnerId }, select: { id: true } });
      if (!winnerCorp) {
        const c = await tx.corporateAccount.findFirst({ where, select: { id: true } });
        if (c) await tx.corporateAccount.update({ where: { id: c.id }, data });
      }

      // ── Fill blanks on the winner from the losers; union tags ──
      const mergedTags = Array.from(
        new Set([...(winner.tags ?? []), ...loserRows.flatMap((r) => r.tags ?? [])])
      );
      await tx.contact.update({
        where: { id: winnerId },
        data: {
          email: firstNonEmpty(winner.email, loserRows.map((r) => r.email)),
          phone: firstNonEmpty(winner.phone, loserRows.map((r) => r.phone)),
          alternatePhone: firstNonEmpty(winner.alternatePhone, loserRows.map((r) => r.alternatePhone)),
          company: firstNonEmpty(winner.company, loserRows.map((r) => r.company)),
          designation: firstNonEmpty(winner.designation, loserRows.map((r) => r.designation)),
          address: firstNonEmpty(winner.address, loserRows.map((r) => r.address)),
          city: firstNonEmpty(winner.city, loserRows.map((r) => r.city)),
          state: firstNonEmpty(winner.state, loserRows.map((r) => r.state)),
          pincode: firstNonEmpty(winner.pincode, loserRows.map((r) => r.pincode)),
          enquiryVenueId: firstNonEmpty(winner.enquiryVenueId, loserRows.map((r) => r.enquiryVenueId)),
          enquirySource: firstNonEmpty(winner.enquirySource, loserRows.map((r) => r.enquirySource)),
          customerType: firstNonEmpty(winner.customerType, loserRows.map((r) => r.customerType)),
          corporateAccountId: firstNonEmpty(winner.corporateAccountId, loserRows.map((r) => r.corporateAccountId)),
          anniversary: winner.anniversary ?? loserRows.find((r) => r.anniversary)?.anniversary ?? null,
          vipCustomer: winner.vipCustomer || loserRows.some((r) => r.vipCustomer),
        },
      });

      // ── Soft-delete the losers ──
      await tx.contact.updateMany({
        where: { id: { in: loserRows.map((r) => r.id) } },
        data: { deletedAt: new Date(), isActive: false },
      });
    });

    // Roll-up figures (lifetimeBookings/totalRevenue) are refreshed by the
    // customer-360 cron; the reassigned bookings will be counted on its next run.

    if (userId) {
      try {
        const { logActivity } = await import("@/lib/activity-logger");
        await logActivity({
          userId,
          action: "merged",
          entityType: "Contact",
          entityId: winnerId,
          changes: { mergedFrom: loserRows.map((r) => r.id) },
        });
      } catch {
        // non-critical
      }
    }

    revalidatePath("/settings/duplicates");
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${winnerId}`);
    return { success: true, movedFrom: loserRows.length };
  } catch (error) {
    console.error("[MERGE_CONTACTS_ERROR]", error);
    return { success: false, error: "Failed to merge contacts" };
  }
}
