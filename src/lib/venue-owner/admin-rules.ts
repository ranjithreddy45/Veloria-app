// ============================================================
// Settings → Venue owners: shared types and pure rules.
// ------------------------------------------------------------
// No I/O and no "use server", so the admin screen (client), the actions
// (server) and the tests all read the same rules: what a valid invite looks
// like, the password floor, which status an owner is in, and how the invite
// link and its WhatsApp share are built.
// ============================================================

/** The longest list of venues one owner may be given in a single save. */
export const MAX_OWNER_VENUES = 200;
export const OWNER_PASSWORD_MIN = 8;
/** bcrypt reads only the first 72 bytes; a hard ceiling also caps hashing cost. */
export const OWNER_PASSWORD_MAX = 128;
const NAME_MAX = 120;
const EMAIL_MAX = 254;

/** How long an invite link works (invite.ts derives its TTL from this). */
export const OWNER_INVITE_DAYS = 14;

export const DEFAULT_APP_URL = "https://app.theveloriagrand.com";

// ------------------------------------------------------------
// Shapes the admin screen receives (dates as ISO strings).
// ------------------------------------------------------------

export interface VenueOwnerVenue {
  id: string;
  name: string;
}

export interface VenueOwnerVenueOption extends VenueOwnerVenue {
  isActive: boolean;
}

/** An outstanding invite: none on file, still usable, or past its expiry. */
export type OwnerInviteState = "none" | "live" | "expired";

export interface VenueOwnerRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  /** The phone as WhatsApp digits (country code first), or null when unusable. */
  whatsappPhone: string | null;
  isActive: boolean;
  /** The owner has set a password (opened their invite). */
  activated: boolean;
  createdAt: string;
  inviteState: OwnerInviteState;
  inviteExpiresAt: string | null;
  venues: VenueOwnerVenue[];
}

export interface VenueOwnersData {
  owners: VenueOwnerRow[];
  /** Every venue, active first, for the pickers. */
  venues: VenueOwnerVenueOption[];
}

export interface VenueOwnerInviteInput {
  name: string;
  email: string;
  phone?: string | null;
  venueIds: string[];
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------

// Deliberately plain: one @, no spaces, a dot in the domain. The sign-in form's
// zod .email() is stricter about odd characters, so reject anything it would.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOwnerEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function isValidOwnerEmail(email: string): boolean {
  return email.length > 0 && email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}

/**
 * Venue ids from the client: strings only, trimmed, de-duplicated, order kept.
 * Anything that is not an array of strings is refused rather than coerced.
 */
export function normalizeVenueIds(raw: unknown): Checked<string[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Choose the venues as a list." };
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return { ok: false, error: "Choose the venues as a list." };
    const id = item.trim();
    if (id && !out.includes(id)) out.push(id);
  }
  if (out.length > MAX_OWNER_VENUES) return { ok: false, error: `Choose at most ${MAX_OWNER_VENUES} venues.` };
  return { ok: true, value: out };
}

/**
 * The invite form. Name and email are required, at least one venue, and the
 * phone (optional) must look like a phone number. The server still normalises
 * the phone to WhatsApp digits and checks no other login holds it.
 */
export function validateOwnerInvite(
  input: Partial<VenueOwnerInviteInput> | null | undefined
): Checked<{ name: string; email: string; phone: string | null; venueIds: string[] }> {
  const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Enter the owner's name." };
  if (name.length > NAME_MAX) return { ok: false, error: `Keep the name under ${NAME_MAX} characters.` };

  const email = normalizeOwnerEmail(input?.email);
  if (!isValidOwnerEmail(email)) return { ok: false, error: "Enter a valid email address — it becomes the owner's sign-in." };

  const rawPhone = typeof input?.phone === "string" ? input.phone.trim() : "";
  let phone: string | null = null;
  if (rawPhone) {
    const digits = rawPhone.replace(/\D/g, "");
    if (!/^[+\d\s().-]+$/.test(rawPhone) || digits.length < 10 || digits.length > 15) {
      return { ok: false, error: "Enter a valid mobile number, or leave it blank." };
    }
    phone = rawPhone;
  }

  const venues = normalizeVenueIds(input?.venueIds ?? []);
  if (!venues.ok) return venues;
  if (venues.value.length === 0) return { ok: false, error: "Choose at least one venue the owner can see." };

  return { ok: true, value: { name, email, phone, venueIds: venues.value } };
}

/** The activation form's password rule. Null when it passes. */
export function ownerPasswordError(password: unknown, confirm: unknown): string | null {
  if (typeof password !== "string" || password.length < OWNER_PASSWORD_MIN) {
    return `Password must be at least ${OWNER_PASSWORD_MIN} characters.`;
  }
  if (password.length > OWNER_PASSWORD_MAX) return `Keep the password under ${OWNER_PASSWORD_MAX} characters.`;
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

// ------------------------------------------------------------
// Status
// ------------------------------------------------------------

export type OwnerStatus = "pending" | "active" | "deactivated";

/**
 * Until the owner sets a password the login is inactive and the invite is
 * pending; after that, isActive is the admin's on/off switch.
 */
export function ownerStatus(owner: { activated: boolean; isActive: boolean }): OwnerStatus {
  if (!owner.activated) return "pending";
  return owner.isActive ? "active" : "deactivated";
}

export const OWNER_STATUS_META: Record<OwnerStatus, { label: string; hue: "amber" | "emerald" | "slate" }> = {
  pending: { label: "Invite pending", hue: "amber" },
  active: { label: "Active", hue: "emerald" },
  deactivated: { label: "Deactivated", hue: "slate" },
};

/** "a sales exec", "an admin" — for the "email already taken" refusal. */
export function describeRole(role: string): string {
  const label = role.toLowerCase().replace(/_/g, " ").trim() || "team";
  return `${/^[aeiou]/.test(label) ? "an" : "a"} ${label}`;
}

// ------------------------------------------------------------
// Invite link + WhatsApp share
// ------------------------------------------------------------

export function appBaseUrl(raw: string | undefined | null = process.env.NEXT_PUBLIC_APP_URL): string {
  return (raw || DEFAULT_APP_URL).replace(/\/+$/, "");
}

export function buildVenueOwnerInviteUrl(userId: string, token: string, base?: string | null): string {
  const params = new URLSearchParams({ u: userId, token });
  return `${appBaseUrl(base)}/venue-owner-activate?${params.toString()}`;
}

/** The message an admin sends the owner. Names nobody but the owner. */
export function ownerInviteMessage(ownerName: string | null, inviteUrl: string): string {
  const first = ownerName?.trim().split(/\s+/)[0];
  return [
    `Hi${first ? ` ${first}` : ""}, here is your Veloria Grand venue-owner login.`,
    `Open this link to set your password (it works once and expires in ${OWNER_INVITE_DAYS} days):`,
    inviteUrl,
    "After that you can sign in any time to see lead and booking counts for your venue.",
  ].join("\n");
}

/**
 * wa.me link that opens WhatsApp with the message ready. With the owner's
 * number it opens their chat; without one WhatsApp asks who to send it to.
 */
export function whatsAppShareUrl(message: string, phoneDigits?: string | null): string {
  const to = phoneDigits && /^\d{8,15}$/.test(phoneDigits) ? phoneDigits : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}
