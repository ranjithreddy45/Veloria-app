// ============================================================
// Where the customer app sends people to plan an event:
//   /visit     — public scheduler (venue tour or menu tasting); reads venueId, kind, eventType
//   /configure — public instant-quote configurator; reads venue
// ============================================================

export type VisitKind = "SITE_VISIT" | "MENU_TASTING";

/** The /visit event-type field accepts up to 80 characters. */
const EVENT_TYPE_MAX = 80;

export function visitHref({ kind, venueId, eventType }: { kind: VisitKind; venueId?: string | null; eventType?: string | null }): string {
  const q = new URLSearchParams();
  if (venueId) q.set("venueId", venueId);
  q.set("kind", kind);
  const et = eventType?.trim().replace(/\s+/g, " ").slice(0, EVENT_TYPE_MAX).trim();
  if (et) q.set("eventType", et);
  return `/visit?${q.toString()}`;
}

export function quoteHref({ venueId }: { venueId?: string | null } = {}): string {
  return venueId ? `/configure?${new URLSearchParams({ venue: venueId }).toString()}` : "/configure";
}

export function compareHref(venueIds: readonly string[] = []): string {
  const q = new URLSearchParams();
  for (const id of venueIds) q.append("h", id);
  const s = q.toString();
  return s ? `/app/venues/compare?${s}` : "/app/venues/compare";
}
