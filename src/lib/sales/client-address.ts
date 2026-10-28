// ============================================================
// The client's address for a quotation header, from the enquiry (Contact).
// ------------------------------------------------------------
// Contact keeps address, city, state and pincode as separate fields, filled in
// unevenly (Oct 2026: 61 of 2,593 enquiries have a street address, 366 a city).
// This joins whatever is there into one line, without repeating a city the
// street address already names. Pure.
// ============================================================

export interface ContactAddressParts {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim().replace(/[,\s]+$/, "");

/** "12 MG Road, Indiranagar, Bengaluru, Karnataka – 560038", or null when nothing is recorded. */
export function formatContactAddress(c: ContactAddressParts | null | undefined): string | null {
  if (!c) return null;
  const street = clean(c.address);
  const lowerStreet = street.toLowerCase();
  const parts: string[] = [];
  if (street) parts.push(street);
  for (const piece of [clean(c.city), clean(c.state)]) {
    if (piece && !lowerStreet.includes(piece.toLowerCase())) parts.push(piece);
  }
  const pin = clean(c.pincode);
  let line = parts.join(", ");
  if (pin && !lowerStreet.includes(pin)) line = line ? `${line} – ${pin}` : pin;
  return line || null;
}
