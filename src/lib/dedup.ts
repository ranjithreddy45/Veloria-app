// ============================================================
// Duplicate-prevention helpers — normalise the natural keys (phone, email) so
// that "+91 98765 43210", "9876543210" and "098765 43210" all compare equal,
// and "A@B.com" == "a@b.com". Used by create guards and the duplicate finder.
// ============================================================

/** Lowercased, trimmed email, or null. */
export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const t = email.trim().toLowerCase();
  return t.length ? t : null;
}

/** Digits only, reduced to the last 10 (drops +91 / leading 0 / spaces). */
export function phoneDigits(phone?: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (!d) return null;
  return d.length > 10 ? d.slice(-10) : d;
}

/**
 * Given a candidate set of records (already fetched cheaply), return those that
 * match the target's normalized email or phone — the exact, format-insensitive
 * comparison the DB `contains`/`equals` can't do alone.
 */
export function matchesContactKey<T extends { email?: string | null; phone?: string | null }>(
  candidates: T[],
  email?: string | null,
  phone?: string | null,
  excludeId?: (c: T) => boolean
): T[] {
  const e = normalizeEmail(email);
  const p = phoneDigits(phone);
  if (!e && !p) return [];
  return candidates.filter((c) => {
    if (excludeId?.(c)) return false;
    const ce = normalizeEmail(c.email);
    const cp = phoneDigits(c.phone);
    return (!!e && ce === e) || (!!p && cp === p);
  });
}

/** A coarse Prisma OR filter to NARROW the candidate set before exact JS match.
 *  Matches email case-insensitively + phone by its last 4 digits (cheap index-ish
 *  scan), then `matchesContactKey` does the precise comparison. */
export function coarseContactWhere(
  email?: string | null,
  phone?: string | null
): { OR: Record<string, unknown>[] } | null {
  const e = normalizeEmail(email);
  const p = phoneDigits(phone);
  const or: Record<string, unknown>[] = [];
  if (e) or.push({ email: { equals: e, mode: "insensitive" } });
  if (p) or.push({ phone: { contains: p.slice(-4) } });
  return or.length ? { OR: or } : null;
}
