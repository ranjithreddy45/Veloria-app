"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const BEO_STATUSES = ["DRAFT", "PUBLISHED", "LOCKED"] as const;
type BeoStatus = (typeof BEO_STATUSES)[number];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
type Severity = (typeof SEVERITIES)[number];

// A single timeline row in the run-of-show JSON column.
export interface RunOfShowItem {
  time: string;
  activity: string;
  owner: string;
  notes: string;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
const canRead = (r?: string) => !!r && hasPermission(r, "beo:read");
const canWrite = (r?: string) => !!r && hasPermission(r, "beo:write");

// ------------------------------------------------------------
// Serializers — Decimal→Number, Date→ISO at the client boundary
// ------------------------------------------------------------
function normalizeRunOfShow(raw: unknown): RunOfShowItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        time: typeof o.time === "string" ? o.time : "",
        activity: typeof o.activity === "string" ? o.activity : "",
        owner: typeof o.owner === "string" ? o.owner : "",
        notes: typeof o.notes === "string" ? o.notes : "",
      };
    });
}

type BeoRow = {
  id: string;
  beoNumber: string;
  bookingId: string;
  status: string;
  covers: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type IncidentRow = {
  id: string;
  beoId: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  photoUrl: string | null;
  reportedById: string;
  createdAt: Date;
};

interface EventInfo {
  eventName: string | null;
  eventType: string | null;
  date: string | null;
  venueName: string | null;
  guestCount: number | null;
}

function emptyEvent(): EventInfo {
  return { eventName: null, eventType: null, date: null, venueName: null, guestCount: null };
}

function serializeBeoRow(b: BeoRow, ev: EventInfo, openIncidents = 0) {
  return {
    id: b.id,
    beoNumber: b.beoNumber,
    bookingId: b.bookingId,
    status: b.status,
    covers: b.covers,
    openIncidents,
    publishedAt: b.publishedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    eventName: ev.eventName,
    eventType: ev.eventType,
    date: ev.date,
    venueName: ev.venueName,
    guestCount: ev.guestCount,
  };
}

function serializeIncident(i: IncidentRow, reporterName?: string | null) {
  return {
    id: i.id,
    beoId: i.beoId,
    title: i.title,
    description: i.description,
    severity: i.severity,
    status: i.status,
    photoUrl: i.photoUrl,
    reportedById: i.reportedById,
    reporterName: reporterName ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

export type BeoListItem = ReturnType<typeof serializeBeoRow>;
export type BeoIncidentDTO = ReturnType<typeof serializeIncident>;
export type BeoDetail = BeoListItem & {
  runOfShow: RunOfShowItem[];
  menuNotes: string | null;
  floorPlanNotes: string | null;
  avNotes: string | null;
  decorNotes: string | null;
  staffingNotes: string | null;
  specialInstructions: string | null;
  incidents: BeoIncidentDTO[];
};

// Resolve the event/venue/guestCount snapshot for a set of bookingIds.
// Beo has no FK relation to Booking, so we read bookings separately.
async function loadEvents(bookingIds: string[]): Promise<Map<string, EventInfo>> {
  const map = new Map<string, EventInfo>();
  if (bookingIds.length === 0) return map;
  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    select: {
      id: true,
      eventName: true,
      eventType: true,
      date: true,
      guestCount: true,
      venue: { select: { name: true } },
    },
  });
  for (const b of bookings) {
    map.set(b.id, {
      eventName: b.eventName,
      eventType: b.eventType,
      date: b.date ? b.date.toISOString() : null,
      venueName: b.venue?.name ?? null,
      guestCount: b.guestCount ?? null,
    });
  }
  return map;
}

async function userName(id: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return u?.name || u?.email || "User";
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------
export async function getBeos(): Promise<Result<BeoListItem[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const rows = await prisma.beo.findMany({ orderBy: { createdAt: "desc" } });
  const events = await loadEvents(rows.map((r) => r.bookingId));
  const openByBeo = new Map<string, number>();
  const grouped = await prisma.beoIncident.groupBy({
    by: ["beoId"],
    where: { beoId: { in: rows.map((r) => r.id) }, status: "OPEN" },
    _count: { _all: true },
  });
  for (const g of grouped) openByBeo.set(g.beoId, g._count._all);
  return {
    success: true,
    data: rows.map((r) => serializeBeoRow(r, events.get(r.bookingId) ?? emptyEvent(), openByBeo.get(r.id) ?? 0)),
  };
}

export async function getBeo(id: string): Promise<Result<BeoDetail>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const b = await prisma.beo.findUnique({ where: { id }, include: { incidents: { orderBy: { createdAt: "desc" } } } });
  if (!b) return { success: false, error: "Function sheet not found" };

  const events = await loadEvents([b.bookingId]);
  const base = serializeBeoRow(b, events.get(b.bookingId) ?? emptyEvent());

  const names = new Map<string, string>();
  for (const i of b.incidents) if (!names.has(i.reportedById)) names.set(i.reportedById, await userName(i.reportedById));

  return {
    success: true,
    data: {
      ...base,
      runOfShow: normalizeRunOfShow(b.runOfShow),
      menuNotes: b.menuNotes,
      floorPlanNotes: b.floorPlanNotes,
      avNotes: b.avNotes,
      decorNotes: b.decorNotes,
      staffingNotes: b.staffingNotes,
      specialInstructions: b.specialInstructions,
      incidents: b.incidents.map((i) => serializeIncident(i, names.get(i.reportedById))),
    },
  };
}

export interface BookableEvent {
  id: string;
  label: string;
  date: string | null;
  guestCount: number | null;
  hasBeo: boolean;
}

// Confirmed/in-progress bookings for the "create BEO from booking" picker.
export async function getBookableEvents(): Promise<Result<BookableEvent[]>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canRead(u.role)) return { success: false, error: "Not authorized" };

  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
    select: { id: true, eventName: true, date: true, guestCount: true, venue: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  const existing = await prisma.beo.findMany({
    where: { bookingId: { in: bookings.map((b) => b.id) } },
    select: { bookingId: true },
  });
  const withBeo = new Set(existing.map((e) => e.bookingId));

  return {
    success: true,
    data: bookings.map((b) => {
      const d = b.date ? b.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;
      const venue = b.venue?.name ? ` · ${b.venue.name}` : "";
      return {
        id: b.id,
        label: `${b.eventName}${d ? ` — ${d}` : ""}${venue}`,
        date: b.date ? b.date.toISOString() : null,
        guestCount: b.guestCount ?? null,
        hasBeo: withBeo.has(b.id),
      };
    }),
  };
}

// ------------------------------------------------------------
// Create — allocate beoNumber BEO-YYYY-NNN via count()+P2002 retry
// ------------------------------------------------------------
export async function createBeo(input: { bookingId: string; covers?: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };
  if (!input.bookingId) return { success: false, error: "A booking is required" };

  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId }, select: { id: true, guestCount: true } });
  if (!booking) return { success: false, error: "Booking not found" };

  // Idempotent: one Function Sheet per booking. If one already exists (e.g.
  // auto-created when the booking was confirmed), return it rather than
  // creating a duplicate.
  const existingBeo = await prisma.beo.findFirst({ where: { bookingId: input.bookingId }, select: { id: true } });
  if (existingBeo) return { success: true, data: { id: existingBeo.id } };

  const year = new Date().getFullYear();
  const covers = input.covers != null && Number.isFinite(input.covers) ? input.covers : booking.guestCount ?? null;

  // beoNumber is @unique. Allocate sequentially via count() and retry on the
  // unique-constraint collision (P2002) that a concurrent create would cause.
  for (let attempt = 0; attempt < 8; attempt++) {
    const countThisYear = await prisma.beo.count({ where: { beoNumber: { startsWith: `BEO-${year}-` } } });
    const beoNumber = `BEO-${year}-${String(countThisYear + 1 + attempt).padStart(3, "0")}`;
    try {
      const created = await prisma.beo.create({
        data: {
          beoNumber,
          bookingId: input.bookingId,
          status: "DRAFT",
          covers,
          createdById: u.id,
        },
        select: { id: true },
      });
      revalidatePath("/beo");
      return { success: true, data: { id: created.id } };
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") continue; // number raced — retry with next index
      throw e;
    }
  }
  return { success: false, error: "Couldn't allocate a BEO number — please retry." };
}

// ------------------------------------------------------------
// Update — sections, covers, run-of-show
// ------------------------------------------------------------
export interface BeoPatch {
  covers?: number | null;
  runOfShow?: RunOfShowItem[];
  menuNotes?: string | null;
  floorPlanNotes?: string | null;
  avNotes?: string | null;
  decorNotes?: string | null;
  staffingNotes?: string | null;
  specialInstructions?: string | null;
}

export async function updateBeo(id: string, patch: BeoPatch): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const b = await prisma.beo.findUnique({ where: { id }, select: { status: true } });
  if (!b) return { success: false, error: "Function sheet not found" };
  if (b.status === "LOCKED") return { success: false, error: "This function sheet is locked and read-only." };

  const data: Record<string, unknown> = {};
  if (patch.covers !== undefined) data.covers = patch.covers == null ? null : Number(patch.covers);
  if (patch.runOfShow !== undefined) data.runOfShow = normalizeRunOfShow(patch.runOfShow);
  for (const k of ["menuNotes", "floorPlanNotes", "avNotes", "decorNotes", "staffingNotes", "specialInstructions"] as const) {
    if (patch[k] !== undefined) data[k] = patch[k] === "" ? null : patch[k];
  }
  if (Object.keys(data).length === 0) return { success: true, data: { id } };

  await prisma.beo.update({ where: { id }, data });
  revalidatePath(`/beo/${id}`);
  revalidatePath("/beo");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Lifecycle: DRAFT → PUBLISHED → LOCKED (no illegal jumps)
// ------------------------------------------------------------
const ALLOWED_TRANSITIONS: Record<BeoStatus, BeoStatus[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["LOCKED", "DRAFT"], // allow un-publish back to draft for edits
  LOCKED: [],
};

export async function setBeoStatus(id: string, status: BeoStatus): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };
  if (!BEO_STATUSES.includes(status)) return { success: false, error: "Invalid status" };

  const b = await prisma.beo.findUnique({ where: { id }, select: { status: true } });
  if (!b) return { success: false, error: "Function sheet not found" };
  const from = b.status as BeoStatus;
  if (from === status) return { success: true, data: { id } };
  if (!ALLOWED_TRANSITIONS[from]?.includes(status)) {
    return { success: false, error: `Can't move from ${from} to ${status}.` };
  }

  await prisma.beo.update({
    where: { id },
    data: {
      status,
      // Stamp publishedAt the first time it's published; keep it on later transitions.
      ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
    },
  });
  revalidatePath(`/beo/${id}`);
  revalidatePath("/beo");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Incidents (day-of log)
// ------------------------------------------------------------
export async function addBeoIncident(
  beoId: string,
  input: { title: string; description?: string; severity: Severity; photoUrl?: string }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const title = input.title?.trim();
  if (!title) return { success: false, error: "A title is required" };
  const severity = SEVERITIES.includes(input.severity) ? input.severity : "LOW";

  const b = await prisma.beo.findUnique({ where: { id: beoId }, select: { id: true } });
  if (!b) return { success: false, error: "Function sheet not found" };

  const created = await prisma.beoIncident.create({
    data: {
      beoId,
      title,
      description: input.description?.trim() || null,
      severity,
      status: "OPEN",
      photoUrl: input.photoUrl?.trim() || null,
      reportedById: u.id,
    },
    select: { id: true },
  });
  revalidatePath(`/beo/${beoId}`);
  return { success: true, data: { id: created.id } };
}

export async function resolveBeoIncident(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const i = await prisma.beoIncident.findUnique({ where: { id }, select: { beoId: true, status: true } });
  if (!i) return { success: false, error: "Incident not found" };
  if (i.status === "RESOLVED") return { success: true, data: { id } };

  await prisma.beoIncident.update({ where: { id }, data: { status: "RESOLVED" } });
  revalidatePath(`/beo/${i.beoId}`);
  return { success: true, data: { id } };
}
