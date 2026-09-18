import type { PublicVisitVenue, VisitKindOption } from "@/actions/public-site-visit.actions";

// ============================================================
// /visit prefill. Links from the customer app (and brochures) open the
// scheduler with the hall, visit kind, event type and guest count chosen:
//   ?venueId= (or venue=)  ?kind=SITE_VISIT|MENU_TASTING  ?eventType= (or occasion=)  ?guests= (or guestCount=)
// Untrusted input: only a bookable hall and an offered kind are taken, and
// text is cleaned and capped to what the booking schema accepts.
// ============================================================

export interface VisitPrefill {
  venueId?: string;
  kind?: VisitKindOption["kind"];
  eventType?: string;
  guestCount?: number;
}

/** submitVisitBookingSchema: eventType max 80, guestCount 1..100000. */
const EVENT_TYPE_MAX = 80;
const GUESTS_MAX = 100000;

const KIND_ALIASES: Record<string, VisitKindOption["kind"]> = {
  SITE_VISIT: "SITE_VISIT",
  VISIT: "SITE_VISIT",
  TOUR: "SITE_VISIT",
  VENUE_TOUR: "SITE_VISIT",
  MENU_TASTING: "MENU_TASTING",
  TASTING: "MENU_TASTING",
  FOOD_TASTING: "MENU_TASTING",
};

function cleanText(raw: string | null, max: number): string | undefined {
  if (!raw) return undefined;
  let s = "";
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    s += code < 32 || code === 127 ? " " : ch;
  }
  const out = s.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return out || undefined;
}

export function readVisitPrefill(
  get: (key: string) => string | null,
  venues: readonly PublicVisitVenue[],
  kinds: readonly VisitKindOption[]
): VisitPrefill {
  const out: VisitPrefill = {};

  const venueId = (get("venueId") ?? get("venue"))?.trim();
  if (venueId && venues.some((v) => v.id === venueId)) out.venueId = venueId;

  const kindKey = get("kind")?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const kind = kindKey ? KIND_ALIASES[kindKey] : undefined;
  if (kind && kinds.some((k) => k.kind === kind)) out.kind = kind;

  const eventType = cleanText(get("eventType") ?? get("occasion"), EVENT_TYPE_MAX);
  if (eventType) out.eventType = eventType;

  const guests = (get("guests") ?? get("guestCount"))?.trim();
  if (guests && /^\d{1,6}$/.test(guests)) {
    const n = Number(guests);
    if (n >= 1 && n <= GUESTS_MAX) out.guestCount = n;
  }

  return out;
}
