// ============================================================
// BEO / function-sheet content composer — the single source of truth for what
// goes on a function sheet so it's never empty.
// ------------------------------------------------------------
// A function sheet needs: the customer's actual MENU (the booking's saved menu,
// else their quotation), standard floor/AV/decor/staffing/instruction NOTES
// (from the matched SOP template's beoDefaults), and a RUN OF SHOW anchored on
// the team's slot hours. Used by the ops provisioning engine, the manual
// "create function sheet" action, and the one-time backfill that fills
// historical empty sheets. Never throws.
// ============================================================

import { prisma } from "@/lib/prisma";
import { slotScheduleStartMin } from "@/lib/sales/slot";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A stored number (number, numeric string or Prisma Decimal) as a finite number; 0 when unreadable. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface BookingMenu {
  items: { name: string; category: string; quantity: number; unit: string; estUnitCost: number }[];
  estFoodCost: number;
  menuNotes: string;
  /**
   * booking_menu: the booking's saved menu (the team's Menu Builder, and what
   * accepting a customer's menu request writes). quotation: the latest
   * quotation's Food / Cake / Drinks plan lines.
   */
  source: "booking_menu" | "quotation";
}

/** Number, numeric string or Prisma Decimal, as money columns arrive. */
type StoredNumber = number | string | { toString(): string };

/** A booking's saved menu (BookingMenu and its selections), as loadBookingMenu reads it. */
export interface SavedBookingMenu {
  guestCount: number;
  specialInstructions: string | null;
  selections: {
    /** Servings per guest: the menu builder multiplies the dish's per-head price by it. */
    quantity: number;
    customPrice: StoredNumber | null;
    menuItem: { name: string; category: string; pricePerHead: StoredNumber };
  }[];
}

/**
 * The booking's saved menu → the kitchen's menu, in the menu builder's order.
 * Each dish is one line per guest plate (quantity = guests, unit "plate"),
 * costed at the menu builder's own price: the dish's stored per-head price
 * (customPrice ?? its pricePerHead) × its servings per guest. So estFoodCost is
 * guests × the menu's price per head, and a dish served more than once per
 * guest says so in its name ("Gulab Jamun (×2 per guest)").
 * Guests: the booking's guest count when set, else the menu's saved count (the
 * same precedence as the quotation menu); the note flags a menu that was priced
 * for a different count. Returns null for a menu without dishes.
 */
export function kitchenMenuFromBookingMenu(saved: SavedBookingMenu, covers: number): BookingMenu | null {
  if (saved.selections.length === 0) return null;
  const guests = Math.max(1, covers || saved.guestCount || 1);

  const items: BookingMenu["items"] = saved.selections.map((s) => {
    const perGuest = Math.max(1, Math.floor(num(s.quantity)));
    const perHeadPrice = s.customPrice != null ? num(s.customPrice) : num(s.menuItem.pricePerHead);
    return {
      name: perGuest > 1 ? `${s.menuItem.name} (×${perGuest} per guest)` : s.menuItem.name,
      category: s.menuItem.category,
      quantity: guests,
      unit: "plate",
      estUnitCost: round2(perHeadPrice * perGuest),
    };
  });

  const estFoodCost = round2(items.reduce((sum, it) => sum + it.quantity * it.estUnitCost, 0));
  const lines = [
    `Menu for ${guests} guests (from the booking's menu):`,
    ...items.map((it) => `• ${it.category}: ${it.name} — ${it.quantity} ${it.unit}`),
  ];
  if (covers > 0 && saved.guestCount > 0 && covers !== saved.guestCount) {
    lines.push(`Note: the saved menu was priced for ${saved.guestCount} guests; the booking now has ${covers}.`);
  }
  const instructions = saved.specialInstructions?.trim();
  if (instructions) lines.push("", "Menu instructions:", instructions);
  return { items, estFoodCost, menuNotes: lines.join("\n"), source: "booking_menu" };
}

/** The latest quotation's Food / Cake / Drinks plan lines → kitchen-plan items + a readable menu note. */
async function quotationMenu(bookingId: string, covers: number): Promise<BookingMenu | null> {
  const q = await prisma.salesQuotation.findFirst({
    where: { bookingId },
    orderBy: { updatedAt: "desc" },
    select: { outputsJson: true, inputsJson: true, guestCount: true },
  });
  const out = q?.outputsJson as unknown as { lines?: { particulars: string; plan: string; amount: number }[] } | null;
  const lines = Array.isArray(out?.lines) ? out!.lines : [];
  if (lines.length === 0) return null;

  const input = (q?.inputsJson ?? {}) as { cakeKg?: number };
  const guests = Math.max(1, covers || q?.guestCount || 1);
  const FNB: Record<string, string> = { "Food Plan": "Food", "Cake Plan": "Cake", "Drinks Plan": "Drinks" };

  const items: BookingMenu["items"] = [];
  for (const l of lines) {
    const cat = FNB[l.particulars];
    if (!cat || !(Number(l.amount) > 0)) continue;
    let quantity = guests;
    let unit = "plate";
    if (cat === "Cake") { quantity = Math.max(1, Number(input.cakeKg) || 1); unit = "kg"; }
    const estUnitCost = round2(Number(l.amount) / quantity);
    const name = l.plan && l.plan !== "—" ? `${cat}: ${l.plan}` : cat;
    items.push({ name, category: cat, quantity, unit, estUnitCost });
  }
  if (items.length === 0) return null;

  const estFoodCost = round2(items.reduce((s, it) => s + it.quantity * it.estUnitCost, 0));
  const menuNotes =
    `Menu for ${guests} guests (from the customer's quotation):\n` +
    items.map((it) => `• ${it.name} — ${it.quantity} ${it.unit}`).join("\n");
  return { items, estFoodCost, menuNotes, source: "quotation" };
}

/**
 * The menu the kitchen prepares, for the kitchen plan and the function sheet:
 *   1. the booking's saved menu (BookingMenu with at least one dish): what the
 *      team builds in the Menu Builder and what accepting a customer's menu
 *      request writes, so the kitchen cooks the menu the team and the customer
 *      agreed;
 *   2. otherwise the booking's latest quotation's Food / Cake / Drinks lines.
 * Returns null when neither has a menu. Never throws.
 */
export async function loadBookingMenu(bookingId: string, covers: number): Promise<BookingMenu | null> {
  try {
    const saved = await prisma.bookingMenu.findUnique({
      where: { bookingId },
      select: {
        guestCount: true,
        specialInstructions: true,
        selections: {
          orderBy: { order: "asc" },
          select: {
            quantity: true,
            customPrice: true,
            menuItem: { select: { name: true, category: true, pricePerHead: true } },
          },
        },
      },
    });
    if (saved && saved.selections.length > 0) return kitchenMenuFromBookingMenu(saved, covers);
    return await quotationMenu(bookingId, covers);
  } catch {
    return null;
  }
}

export interface BookingServices {
  decor: string | null;
  activities: string[];
  cake: string | null;
  photography: string | null;
  accommodation: boolean;
}

/** What the customer actually booked (decor / activities / cake / photography),
 *  read from the frozen quotation, so the plan is event-specific not generic. */
export async function loadBookingServices(bookingId: string): Promise<BookingServices> {
  const empty: BookingServices = { decor: null, activities: [], cake: null, photography: null, accommodation: false };
  try {
    const q = await prisma.salesQuotation.findFirst({
      where: { bookingId }, orderBy: { updatedAt: "desc" }, select: { outputsJson: true },
    });
    const out = q?.outputsJson as unknown as { lines?: { particulars: string; plan: string; amount: number }[] } | null;
    const lines = Array.isArray(out?.lines) ? out!.lines : [];
    const pick = (p: string) => lines.find((l) => l.particulars === p && Number(l.amount) > 0);
    const clean = (s?: string) => (s && s !== "—" ? s.trim() : null);
    return {
      decor: clean(pick("Decor Plan")?.plan),
      activities: lines.filter((l) => l.particulars === "Activity Plan" && Number(l.amount) > 0).map((l) => l.plan).filter((p) => p && p !== "—"),
      cake: clean(pick("Cake Plan")?.plan),
      photography: clean(pick("Photography / Videography")?.plan),
      accommodation: !!pick("Accommodation (Hotel Rooms)"),
    };
  } catch {
    return empty;
  }
}

interface BeoDefaults {
  menuNotes?: string; floorPlanNotes?: string; avNotes?: string;
  decorNotes?: string; staffingNotes?: string; specialInstructions?: string;
}

// Last-resort standard notes so a function sheet is NEVER blank, even if no SOP
// template has beoDefaults configured. The template's own beoDefaults take
// precedence; this only fills gaps.
const FALLBACK_NOTES: Required<Omit<BeoDefaults, "menuNotes">> = {
  floorPlanNotes: "Confirm the final floor plan & guest count with the client; mark stage, buffet, dance floor, and entry/exit.",
  avNotes: "Sound & lighting check 2h before guest arrival; confirm mic count, playlist, and any AV cues with the client.",
  decorNotes: "Theme & colour per the client brief; complete install and photo-proof before guest arrival.",
  staffingNotes: "Assign a captain + service staff (~1 per 25 guests); brief every team from this function sheet on arrival.",
  specialInstructions: "Review the customer's menu (see Menu) and confirm any dietary / allergy notes before service.",
};

// The matched template's standard notes (event-type → default → any active).
async function selectBeoDefaults(eventType?: string | null): Promise<BeoDefaults | null> {
  const evt = eventType || undefined;
  const t =
    (evt
      ? await prisma.sOPTemplate.findFirst({
          where: { isActive: true, eventType: { equals: evt, mode: "insensitive" } },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: { beoDefaults: true },
        })
      : null) ??
    (await prisma.sOPTemplate.findFirst({ where: { isActive: true, isDefault: true }, select: { beoDefaults: true } })) ??
    (await prisma.sOPTemplate.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { beoDefaults: true } }));
  return (t?.beoDefaults ?? null) as BeoDefaults | null;
}

export interface RunOfShowEntry { time: string; activity: string; owner: string; notes?: string }

const hhmm = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** An event-day timeline anchored on the booking's slot start (the team's slot
 *  hours, src/lib/sales/slot.ts), tailored with the customer's ACTUAL booked
 *  services (decor / activities / cake / photography) when provided. The
 *  coordinator can edit it — but it's never blank or generic. */
export function buildDefaultRunOfShow(timeSlot?: string | null, services?: BookingServices): RunOfShowEntry[] {
  const start = slotScheduleStartMin(timeSlot);
  const s = services;
  const rows: [number, string, string][] = [
    [-240, "Team & vendor arrival; setup begins", "Operations"],
    [-180, s?.decor ? `Decor & stage installation: ${s.decor}` : "Decor & stage installation", "Event Coordinator / Decor"],
    [-120, "AV / sound & lighting check", "AV / Operations"],
    [-90, "Kitchen mise-en-place & F&B setup", "Catering"],
    ...(s?.photography ? [[-60, `Photography / videography team briefing: ${s.photography}`, "Coordinator"] as [number, string, string]] : []),
    [-30, "Final walkthrough & readiness check", "Event Coordinator"],
    [0, "Guest arrival & welcome", "Guest Relations"],
    ...((s?.activities && s.activities.length > 0)
      ? s.activities.map((a, i) => [45 + i * 30, `Programme: ${a}`, "Entertainment"] as [number, string, string])
      : [[60, "Main program / ceremonies begin", "Entertainment"] as [number, string, string]]),
    ...(s?.cake ? [[110, `Cake-cutting ceremony: ${s.cake}`, "Coordinator / Catering"] as [number, string, string]] : []),
    [120, "Dinner / main service", "Catering"],
    [240, "Wind-down & guest departure", "Operations"],
    [270, "Teardown & equipment dispatch return", "Logistics"],
  ];
  return rows.sort((a, b) => a[0] - b[0]).map(([off, activity, owner]) => ({ time: hhmm(start + off), activity, owner }));
}

export interface BeoContent {
  menuNotes: string | null;
  floorPlanNotes: string | null;
  avNotes: string | null;
  decorNotes: string | null;
  staffingNotes: string | null;
  specialInstructions: string | null;
  runOfShow: RunOfShowEntry[];
}

/**
 * Compose everything a function sheet should show for a booking: the customer's
 * menu, the template's standard notes, and a slot-aware run of show. Best-effort
 * — any piece that can't be resolved is simply omitted (null / generic).
 */
export async function composeBeoContent(bookingId: string): Promise<BeoContent> {
  const booking = await prisma.booking
    .findUnique({ where: { id: bookingId }, select: { eventType: true, timeSlot: true, guestCount: true } })
    .catch(() => null);
  const [menu, services, d] = await Promise.all([
    loadBookingMenu(bookingId, booking?.guestCount ?? 0),
    loadBookingServices(bookingId),
    selectBeoDefaults(booking?.eventType),
  ]);

  // Event-specific special instructions: call out the actual booked services +
  // guest count so each team knows what THIS event needs, not a generic note.
  const booked: string[] = [];
  if (services.decor) booked.push(`decor "${services.decor}"`);
  if (services.activities.length) booked.push(`programme (${services.activities.join(", ")})`);
  if (services.cake) booked.push(`cake (${services.cake})`);
  if (services.photography) booked.push(`photography (${services.photography})`);
  if (services.accommodation) booked.push("guest accommodation");
  const eventSpecific = booked.length
    ? `This ${booking?.eventType || "event"} for ${booking?.guestCount ?? "—"} guests includes: ${booked.join("; ")}. Coordinate each with its vendor/team per the run of show. ` +
      (d?.specialInstructions || FALLBACK_NOTES.specialInstructions)
    : (d?.specialInstructions || FALLBACK_NOTES.specialInstructions);

  return {
    menuNotes: menu?.menuNotes ?? d?.menuNotes ?? null,
    floorPlanNotes: d?.floorPlanNotes || FALLBACK_NOTES.floorPlanNotes,
    avNotes: d?.avNotes || FALLBACK_NOTES.avNotes,
    decorNotes: (services.decor ? `Booked: ${services.decor}. ` : "") + (d?.decorNotes || FALLBACK_NOTES.decorNotes),
    staffingNotes: d?.staffingNotes || FALLBACK_NOTES.staffingNotes,
    specialInstructions: eventSpecific,
    runOfShow: buildDefaultRunOfShow(booking?.timeSlot, services),
  };
}

/**
 * One-time / idempotent backfill: fill function sheets that are still blank
 * (every notes field empty) with composed content. NEVER overwrites a sheet a
 * coordinator has already edited — only touches truly-empty ones. Runs in
 * bootstrap on each deploy, so historical empty sheets get populated.
 */
export async function backfillEmptyBeos(limit = 1000): Promise<{ scanned: number; filled: number }> {
  const empties = await prisma.beo.findMany({
    where: {
      AND: [
        { OR: [{ menuNotes: null }, { menuNotes: "" }] },
        { OR: [{ floorPlanNotes: null }, { floorPlanNotes: "" }] },
        { OR: [{ avNotes: null }, { avNotes: "" }] },
        { OR: [{ decorNotes: null }, { decorNotes: "" }] },
        { OR: [{ staffingNotes: null }, { staffingNotes: "" }] },
        { OR: [{ specialInstructions: null }, { specialInstructions: "" }] },
      ],
    },
    select: { id: true, bookingId: true },
    take: limit,
  });

  let filled = 0;
  for (const b of empties) {
    try {
      const content = await composeBeoContent(b.bookingId);
      const hasNotes = [content.menuNotes, content.floorPlanNotes, content.avNotes, content.decorNotes, content.staffingNotes, content.specialInstructions]
        .some((v) => v && String(v).trim() !== "");
      // Always at least give it a run of show; add notes when we have them.
      await prisma.beo.update({
        where: { id: b.id },
        data: {
          menuNotes: content.menuNotes ?? undefined,
          floorPlanNotes: content.floorPlanNotes ?? undefined,
          avNotes: content.avNotes ?? undefined,
          decorNotes: content.decorNotes ?? undefined,
          staffingNotes: content.staffingNotes ?? undefined,
          specialInstructions: content.specialInstructions ?? undefined,
          runOfShow: content.runOfShow as unknown as object,
        },
      });
      if (hasNotes) filled++;
    } catch {
      /* skip a row that won't compose; never fail the sweep */
    }
  }
  return { scanned: empties.length, filled };
}
