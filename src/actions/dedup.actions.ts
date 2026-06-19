"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, phoneDigits } from "@/lib/dedup";

// ============================================================
// Duplicate finder — groups customer-facing records by their normalised
// natural keys (email / phone) so existing duplicates can be reviewed and
// cleaned BEFORE hard DB unique constraints are applied. Read-only, admin-only.
// ============================================================

export type DupMember = { id: string; label: string; href: string };
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
    const m: DupMember = { id: r.id, label: r.label || entity, href: r.href };
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
