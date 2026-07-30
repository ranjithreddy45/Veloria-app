"use server";

// ============================================================
// BD / Acquisition — contacts on a lead (AcqLeadContact).
//
// A lead carries ONE owner (ownerName / mobilePrimary / email), but the team
// actually works a property through several people: a co-owner who signs, a
// manager who opens the gate, an accountant who chases the invoice, a broker who
// introduced it. This is the CRUD for those people, each tagged with the role
// they play. Reads follow the module convention (acqHasAnyAccess, same as
// getAcqLead); writes require acqCan(role, "lead:write").
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { acqCan, acqHasAnyAccess } from "@/lib/acq/rbac";
import { normalizeMobile, isValidMobile } from "@/lib/acq/domain";
import { ACQ_CONTACT_DESIGNATION } from "@/lib/acq/constants";
import { z } from "zod";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  designation: z.enum(ACQ_CONTACT_DESIGNATION),
  designationOther: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type AcqLeadContactInput = z.infer<typeof contactSchema>;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

/**
 * Shared validation for both create and update. Returns the columns to write, or
 * an error message. `designationOther` is mandatory when the role is OTHER —
 * otherwise the panel would render a nameless "Other" pill that tells nobody
 * anything — and is cleared when it is not, so a role change can't leave stale
 * free text behind.
 */
interface ContactWriteData {
  name: string;
  designation: string;
  designationOther: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

function toWriteData(
  d: AcqLeadContactInput
): { ok: true; data: ContactWriteData } | { ok: false; error: string } {
  if (d.designation === "OTHER" && !d.designationOther) {
    return { ok: false, error: "Describe the role when the designation is Other." };
  }
  // Phones are normalised exactly like AcqLead.mobilePrimary (E.164-ish) so the
  // same number typed two ways still dials and still matches.
  let phone: string | null = null;
  if (d.phone) {
    if (!isValidMobile(d.phone)) {
      return { ok: false, error: "Enter a valid phone number (10–15 digits)." };
    }
    phone = normalizeMobile(d.phone);
  }
  return {
    ok: true,
    data: {
      name: d.name,
      designation: d.designation,
      designationOther: d.designation === "OTHER" ? d.designationOther || null : null,
      phone,
      email: d.email || null,
      notes: d.notes || null,
    },
  };
}

function revalidateLead(leadId: string) {
  revalidatePath(`/bd/leads/${leadId}`);
  revalidatePath("/bd/leads");
}

// ------------------------------------------------------------
// List
// ------------------------------------------------------------
export async function getAcqLeadContacts(leadId: string): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };

  const lead = await prisma.acqLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
  if (!lead) return { success: false, error: "Lead not found" };

  const contacts = await prisma.acqLeadContact.findMany({
    where: { leadId },
    // Primary first, then oldest-first so the list order is stable as people are added.
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return { success: true, data: serialize(contacts) as unknown[] };
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------
export async function addAcqLeadContact(
  leadId: string,
  input: AcqLeadContactInput
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const built = toWriteData(parsed.data);
  if (!built.ok) return { success: false, error: built.error };

  const lead = await prisma.acqLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
  if (!lead) return { success: false, error: "Lead not found" };

  const wantsPrimary = parsed.data.isPrimary === true;

  const created = await prisma.$transaction(async (tx) => {
    // At most ONE primary per lead: demote the others in the same transaction so
    // a concurrent add can't leave two people flagged as the main contact.
    if (wantsPrimary) {
      await tx.acqLeadContact.updateMany({ where: { leadId, isPrimary: true }, data: { isPrimary: false } });
    }
    // The first person captured is the one to call, whether or not it was ticked.
    const existing = await tx.acqLeadContact.count({ where: { leadId } });
    return tx.acqLeadContact.create({
      data: {
        ...built.data,
        leadId,
        isPrimary: wantsPrimary || existing === 0,
        createdById: user.id,
      },
      select: { id: true },
    });
  });

  revalidateLead(leadId);
  return { success: true, data: { id: created.id } };
}

// ------------------------------------------------------------
// Update
// ------------------------------------------------------------
export async function updateAcqLeadContact(
  id: string,
  input: AcqLeadContactInput
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  const built = toWriteData(parsed.data);
  if (!built.ok) return { success: false, error: built.error };

  const existing = await prisma.acqLeadContact.findUnique({
    where: { id },
    select: { id: true, leadId: true, isPrimary: true, lead: { select: { deletedAt: true } } },
  });
  if (!existing || existing.lead.deletedAt) return { success: false, error: "Contact not found" };

  const wantsPrimary = parsed.data.isPrimary === true;

  await prisma.$transaction(async (tx) => {
    if (wantsPrimary) {
      await tx.acqLeadContact.updateMany({
        where: { leadId: existing.leadId, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }
    await tx.acqLeadContact.update({
      where: { id },
      data: {
        ...built.data,
        // Un-ticking the only primary would leave the lead with no main contact,
        // so the flag can be moved to someone else but never simply switched off.
        isPrimary: wantsPrimary ? true : existing.isPrimary,
      },
    });
  });

  revalidateLead(existing.leadId);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Delete
// ------------------------------------------------------------
export async function deleteAcqLeadContact(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const existing = await prisma.acqLeadContact.findUnique({
    where: { id },
    select: { id: true, leadId: true, isPrimary: true, lead: { select: { deletedAt: true } } },
  });
  if (!existing || existing.lead.deletedAt) return { success: false, error: "Contact not found" };

  await prisma.$transaction(async (tx) => {
    await tx.acqLeadContact.delete({ where: { id } });
    // Removing the primary promotes the next-oldest person, so the lead is never
    // left with contacts but no one marked as the one to call.
    if (existing.isPrimary) {
      const next = await tx.acqLeadContact.findFirst({
        where: { leadId: existing.leadId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) await tx.acqLeadContact.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });

  revalidateLead(existing.leadId);
  return { success: true, data: { id } };
}
