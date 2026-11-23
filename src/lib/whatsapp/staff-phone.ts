import { prisma } from "@/lib/prisma";

// ============================================================
// Is this WhatsApp number one of our own staff?
//
// The CRM now WhatsApps staff ("a lead has been assigned to you") from the
// same business number customers write to, and people reply ("ok", "calling
// now"). An inbound message from an unknown number becomes a new customer
// lead — so without this check a rep's reply would turn into a fake lead,
// trigger the customer welcome + first-response messages to the rep, alert the
// group, and get assigned to someone who is then WhatsApped too.
//
// Matched on the last 10 digits (Indian mobile numbers are stored in several
// spellings: +91…, 91…, 0…, bare). Active users only; a handful of rows.
// ============================================================

function last10(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/** The active staff member whose profile phone matches, or null. Never throws. */
export async function findStaffByPhone(phone: string): Promise<{ id: string; name: string | null } | null> {
  const key = last10(phone);
  if (!key) return null;
  try {
    const candidates = await prisma.user.findMany({
      where: { isActive: true, phone: { endsWith: key.slice(-7) } },
      select: { id: true, name: true, phone: true },
      take: 20,
    });
    const hit = candidates.find((u) => last10(u.phone) === key);
    return hit ? { id: hit.id, name: hit.name } : null;
  } catch {
    return null;
  }
}
