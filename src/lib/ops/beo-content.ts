// ============================================================
// BEO / function-sheet content composer — the single source of truth for what
// goes on a function sheet so it's never empty.
// ------------------------------------------------------------
// A function sheet needs: the customer's actual MENU (from their quotation),
// standard floor/AV/decor/staffing/instruction NOTES (from the matched SOP
// template's beoDefaults), and a slot-aware RUN OF SHOW. Used by the ops
// provisioning engine, the manual "create function sheet" action, and the
// one-time backfill that fills historical empty sheets. Never throws.
// ============================================================

import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface BookingMenu {
  items: { name: string; category: string; quantity: number; unit: string; estUnitCost: number }[];
  estFoodCost: number;
  menuNotes: string;
}

/**
 * Pull the customer's actual menu (Food / Cake / Drinks) from the booking's
 * frozen quotation snapshot → kitchen-plan items + a readable menu note.
 * Returns null when there's no quotation / no F&B. Never throws.
 */
export async function loadBookingMenu(bookingId: string, covers: number): Promise<BookingMenu | null> {
  try {
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
    return { items, estFoodCost, menuNotes };
  } catch {
    return null;
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

const SLOT_START: Record<string, number> = { MORNING: 9 * 60, AFTERNOON: 12 * 60, EVENING: 18 * 60, FULL_DAY: 10 * 60 };
const hhmm = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** A sensible default event-day timeline, anchored on the booking's slot. The
 *  coordinator can edit it — but it's never blank. */
export function buildDefaultRunOfShow(timeSlot?: string | null): RunOfShowEntry[] {
  const start = SLOT_START[(timeSlot || "EVENING").toUpperCase()] ?? SLOT_START.EVENING;
  const rows: [number, string, string][] = [
    [-240, "Team & vendor arrival; setup begins", "Operations"],
    [-180, "Decor & stage installation", "Event Coordinator / Decor"],
    [-120, "AV / sound & lighting check", "AV / Operations"],
    [-90, "Kitchen mise-en-place & F&B setup", "Catering"],
    [-30, "Final walkthrough & readiness check", "Event Coordinator"],
    [0, "Guest arrival & welcome", "Guest Relations"],
    [60, "Main program / ceremonies begin", "Entertainment"],
    [120, "Dinner / main service", "Catering"],
    [240, "Wind-down & guest departure", "Operations"],
    [270, "Teardown & equipment dispatch return", "Logistics"],
  ];
  return rows.map(([off, activity, owner]) => ({ time: hhmm(start + off), activity, owner }));
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
  const [menu, d] = await Promise.all([
    loadBookingMenu(bookingId, booking?.guestCount ?? 0),
    selectBeoDefaults(booking?.eventType),
  ]);
  return {
    menuNotes: menu?.menuNotes ?? d?.menuNotes ?? null,
    floorPlanNotes: d?.floorPlanNotes || FALLBACK_NOTES.floorPlanNotes,
    avNotes: d?.avNotes || FALLBACK_NOTES.avNotes,
    decorNotes: d?.decorNotes || FALLBACK_NOTES.decorNotes,
    staffingNotes: d?.staffingNotes || FALLBACK_NOTES.staffingNotes,
    specialInstructions: d?.specialInstructions || FALLBACK_NOTES.specialInstructions,
    runOfShow: buildDefaultRunOfShow(booking?.timeSlot),
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
