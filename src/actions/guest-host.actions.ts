"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { computeOperationReadiness } from "@/lib/ops/state-machine";
import { getHostScope, getHostUser, isStaffUser, staffCan, type HostUser, type CollaboratorRole } from "@/lib/guest/host-scope";
import { REQUEST_PREVIEW_PERMISSIONS } from "@/app/(guest)/app/concierge/_lib/concierge-rules";
import {
  bookingBalance,
  checklistGroups,
  currentOrNext,
  daysUntilEvent,
  guestCounts,
  nextPlanTask,
  partnerCounts,
  pickRunOfShow,
  planProgress,
  shapeBooking,
  shapeTeam,
  shapeTodo,
  staffCounts,
  toCustomerReadiness,
  type ChecklistGroup,
  type CustomerReadiness,
  type GuestBooking as EventBooking,
  type GuestCounts,
  type GuestTodo as EventTodo,
  type RunOfShow,
  type RunOfShowRow,
  type RunOfShowSource,
  type StaffInput,
  type TeamMember,
} from "@/app/(guest)/app/event/_components/event-view";

// ============================================================
// Guest app: SIGNED-IN reads and writes for a host's own event.
//
// ONE SOURCE OF TRUTH. Each read is the record the team's own screen reads
// for the same fact, shaped by the pure, tested rules in
// app/(guest)/app/event/_components/event-view.ts:
//   booking facts  Booking (the booking page)
//   readiness      computeOperationReadiness (the operations page's panel)
//   checklist      ExecutionPlan tasks (the Execution Plan view) and the host's
//                  own CLIENT_TODO Tasks (the booking's Tasks tab)
//   run of show    the day-of EventTimeline, else EventOperation.runOfShow, else a
//                  published function sheet (Beo). Never a template.
//   team           Booking.createdBy and StaffAssignment (the operations page)
//   live           Guest check-ins (Guest Manager), BookingVendor and its ops
//                  vendor assignment (booking page), the same run of show
//   balance due    Invoice.balanceDue on the booking's issued invoices (the
//                  booking page's Payment summary)
//
// Identity resolves only through getHostScope() in lib/guest/host-scope.ts, the
// verified-contact choke-point every guest-app action shares, so a stranger who
// mints an account with a customer's email sees nothing.
//
// Writes never touch operations directly. A host's request becomes a Task in the
// booking owner's real work queue plus a notification, so it lands where the
// team already looks. In staff preview every write refuses.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

const PREVIEW_WRITE_ERROR =
  "Staff preview — this would change a real customer's booking. Sign in as that host (or the demo guest) to try it.";
const VIEWER_WRITE_ERROR = "You can view this event, but only the host or a co-host can make changes.";
const HOST_ONLY_ERROR = "Only the booking's own customer can do this.";

const BOOKING_SELECT = {
  id: true,
  bookingNumber: true,
  eventName: true,
  eventType: true,
  date: true,
  timeSlot: true,
  status: true,
  guestCount: true,
  venueId: true,
  createdById: true,
  contactId: true,
  hallBooked: true,
  venue: { select: { name: true } },
  contact: { select: { firstName: true, lastName: true } },
} satisfies Prisma.BookingSelect;

type BookingRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;

export type GuestBooking = EventBooking;
export type GuestTodo = EventTodo;

interface Scope {
  u: HostUser;
  contactIds: string[];
  /** Every booking in scope, upcoming first: the Switch list. */
  all: { id: string; eventName: string; date: Date }[];
  /** The requested booking when it is in scope, else the next upcoming one. */
  b: BookingRow | null;
  /** A team member previewing the host view: read-only. */
  preview: boolean;
  /** Co-host role for `b` when the login reaches it only as an invited collaborator; null for the customer's own booking. */
  collabRole: CollaboratorRole | null;
  /** Co-host roles for every collaborator booking in `all`. */
  collabRoles: Record<string, CollaboratorRole>;
}

/**
 * Who is this request acting for? getHostScope() decides:
 *  - a verified customer: their own bookings;
 *  - a team member (isStaffUser: not CLIENT or VENDOR, and holds bookings:read by the
 *    session's effective permissions) with no customer contact: a read-only PREVIEW of
 *    live bookings, with contactIds narrowed to that booking's host so account-level
 *    reads show what the host would see.
 * null when nobody is signed in.
 */
async function scope(bookingId?: string): Promise<Scope | null> {
  const s = await getHostScope(bookingId);
  if (!s) return null;
  // Preview is a team member's read-only look. host-scope grants it only to
  // isStaffUser users; fail closed if that ever stops being true.
  if (s.preview && !isStaffUser(s.user)) return { u: s.user, contactIds: [], all: [], b: null, preview: true, collabRole: null, collabRoles: {} };
  const b = s.booking ? await prisma.booking.findUnique({ where: { id: s.booking.id }, select: BOOKING_SELECT }) : null;
  const collabRoles = s.collaboratorRoles ?? {};
  return { u: s.user, contactIds: s.contactIds, all: s.bookings, b, preview: s.preview, collabRole: b ? collabRoles[b.id] ?? null : null, collabRoles };
}

/**
 * Staff preview never shows a team member more than their own role already opens
 * in the ERP; customers always see their own booking. Each gate is the permission
 * the team-side screen or action for that data checks:
 *   operations:read  Operations Readiness      execution:read   Execution Plan
 *   beo:read         function sheets           esign:read       signature requests
 *   invoices:read    invoices across an account payments:read  instalments
 *   contracts:read   contracts                 loyalty:read, referrals:read  rewards
 * Booking basics, the booking's own invoice balance and tasks, its guest list,
 * day-of timeline, rostered staff and partner counts all sit on /bookings/[id]
 * pages open to bookings:read, which every previewing role holds.
 * Every gate reads the viewer's effective permissions (staffCan), so a
 * permission revoked in Settings → Roles hides the section here as in the ERP.
 */
function canSee(s: Scope, permission: string): boolean {
  return !s.preview || staffCan(s.u, permission);
}

/** Run a read only when the viewer may see it; otherwise return the fallback without touching the database. */
function readIf<T>(allowed: boolean, read: () => Promise<T>, fallback: T): Promise<T> {
  return allowed ? read() : Promise.resolve(fallback);
}

// ------------------------------------------------------------ loaders (the team's records)

/** Operations Readiness, loaded the way getOperationReadinessForBooking loads it for the operations page. */
async function loadReadiness(bookingId: string): Promise<CustomerReadiness | null> {
  try {
    const op = await prisma.eventOperation.findUnique({ where: { bookingId }, select: { id: true } });
    return op ? toCustomerReadiness(await computeOperationReadiness(op.id)) : null;
  } catch (error) {
    // Best-effort, as on the operations page: readiness never breaks the screen.
    console.error("[GUEST_READINESS_ERROR]", error);
    return null;
  }
}

/** The booking's execution plan, phases then tasks ordered as the Execution Plan view orders them. null when there is no plan. */
async function loadPlanPhases(bookingId: string) {
  const plan = await prisma.executionPlan.findUnique({
    where: { bookingId },
    select: {
      phases: {
        orderBy: { order: "asc" },
        select: {
          name: true,
          order: true,
          plannedEnd: true,
          tasks: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              status: true,
              order: true,
              slaFinishBy: true,
              assignee: { select: { name: true } },
              vendor: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  return plan ? plan.phases : null;
}

async function loadGuestCounts(bookingId: string): Promise<GuestCounts> {
  const guests = await prisma.guest.findMany({
    where: { guestList: { bookingId } },
    select: { rsvpStatus: true, plusOnes: true, isCheckedIn: true },
  });
  return guestCounts(guests);
}

/** Every invoice on the booking, as the booking page loads them; bookingBalance applies finance's issued rule. */
async function loadBookingBalance(bookingId: string): Promise<{ balanceDue: number; issued: number }> {
  const invoices = await prisma.invoice.findMany({ where: { bookingId }, select: { status: true, balanceDue: true } });
  return bookingBalance(invoices.map((i) => ({ status: i.status, balanceDue: Number(i.balanceDue) })));
}

/** The run of show and the rostered staff, from the records the day-of, operations and function-sheet screens edit. */
async function loadEventOps(s: Scope, bookingId: string): Promise<{ runOfShow: RunOfShow; staff: StaffInput[] }> {
  const [timeline, operation, sheet] = await Promise.all([
    prisma.eventTimeline.findUnique({
      where: { bookingId },
      select: { items: { orderBy: { order: "asc" }, select: { time: true, activity: true, status: true, order: true } } },
    }),
    prisma.eventOperation.findUnique({
      where: { bookingId },
      select: {
        runOfShow: true,
        staffAssignments: {
          orderBy: { shiftStart: "asc" },
          select: { role: true, shiftStart: true, status: true, user: { select: { id: true, name: true, isActive: true } } },
        },
      },
    }),
    // The latest sheet, as the booking page picks it.
    readIf(
      canSee(s, "beo:read"),
      () => prisma.beo.findFirst({ where: { bookingId }, orderBy: { createdAt: "desc" }, select: { status: true, runOfShow: true } }),
      null
    ),
  ]);
  return {
    runOfShow: pickRunOfShow({
      timelineItems: timeline?.items ?? null,
      operationRunOfShow: operation?.runOfShow ?? null,
      functionSheet: sheet,
    }),
    staff: operation?.staffAssignments ?? [],
  };
}

// ------------------------------------------------------------ overview (Home)
export interface GuestOverview {
  user: { id: string; name: string | null };
  verified: boolean;
  /** Staff looking at a host's view, not their own booking. */
  preview: boolean;
  unread: number;
  booking: GuestBooking | null;
  /** The team's Operations Readiness %; null with no operation yet, or when preview hides it. */
  readiness: number | null;
  /** Unfinished tasks in the team's execution plan. */
  openTasks: number;
  /** Guest records attending / on the list, as the team's Guest Manager counts them. */
  guests: { confirmed: number; total: number };
  /** Balance due on this booking's issued invoices: the booking page's "Pending". */
  balanceDue: number;
  /** Issued invoices on this booking. 0 means nothing is billed yet, so a zero balance is not "settled". */
  invoicesIssued: number;
  /** Co-host role on this booking, or null for the customer's own booking. When set, hide money and documents. */
  collaboratorRole: CollaboratorRole | null;
  /** The next unfinished task in the team's execution plan. */
  nextTask: { title: string; dueDate: string | null } | null;
  loyalty: { points: number; tier: string } | null;
}

export async function getGuestOverview(): Promise<GuestOverview | null> {
  const s = await scope();
  if (!s) return null;
  const { u, b, preview } = s;
  const user = { id: u.id, name: u.name };
  const unread = await prisma.notification.count({ where: { userId: u.id, isRead: false } });
  if (s.contactIds.length === 0) {
    return {
      user, verified: false, preview, unread, booking: null, readiness: null, openTasks: 0,
      guests: { confirmed: 0, total: 0 }, balanceDue: 0, invoicesIssued: 0, collaboratorRole: null, nextTask: null, loyalty: null,
    };
  }
  const loyaltyRead = readIf(
    canSee(s, "loyalty:read"),
    () => prisma.loyaltyAccount.findFirst({ where: { contactId: { in: s.contactIds } }, select: { points: true, tier: true } }),
    null
  );
  const [readiness, phases, guests, balance] = b
    ? await Promise.all([
        readIf(canSee(s, "operations:read"), () => loadReadiness(b.id), null),
        readIf(canSee(s, "execution:read"), () => loadPlanPhases(b.id), null),
        loadGuestCounts(b.id),
        s.collabRole ? Promise.resolve(null) : loadBookingBalance(b.id),
      ])
    : [null, null, null, null];
  const loyalty = await loyaltyRead;
  const plan = phases ? planProgress(phases) : null;
  return {
    user,
    verified: true,
    preview,
    unread,
    booking: b ? shapeBooking(b) : null,
    readiness: readiness?.pct ?? null,
    openTasks: plan?.open ?? 0,
    guests: { confirmed: guests?.attending ?? 0, total: guests?.onList ?? 0 },
    balanceDue: balance?.balanceDue ?? 0,
    invoicesIssued: balance?.issued ?? 0,
    collaboratorRole: s.collabRole,
    nextTask: phases ? nextPlanTask(phases) : null,
    loyalty: loyalty ? { points: loyalty.points, tier: String(loyalty.tier) } : null,
  };
}

// ------------------------------------------------------------ my event hub
export interface GuestEvent {
  booking: GuestBooking;
  preview: boolean;
  hostName: string;
  bookings: { id: string; eventName: string; date: string }[];
  /** The team's Operations Readiness %; null with no operation yet, or when preview hides it. */
  readiness: number | null;
  /** The same panel's "N of M checks passing". */
  readinessChecks: { passing: number; total: number } | null;
  /** Unfinished tasks in the team's execution plan (0 without a plan: see planTasks). */
  openTasks: number;
  /** Execution-plan task counts; null when the team has no plan with tasks, or preview hides it. */
  planTasks: { total: number; done: number; open: number } | null;
  /** Signature requests waiting on the host; null when preview hides them. */
  docsToSign: number | null;
  /** Guest records attending / on the list (Guest Manager). */
  guests: { confirmed: number; total: number };
  guestCounts: GuestCounts;
  /** Balance due on this booking's issued invoices: the booking page's "Pending". */
  balanceDue: number;
  /** Issued invoices on this booking; 0 means nothing is billed yet. */
  invoicesIssued: number;
  /** Co-host role on this booking, or null for the customer's own booking. When set, hide money and documents. */
  collaboratorRole: CollaboratorRole | null;
  /**
   * Open package requests the host sent (CLIENT_REQUEST tasks of kind PACKAGES). The booking's own
   * customer's: 0 for co-hosts and viewers, and for a preview without the team access they need.
   */
  requests: number;
  team: TeamMember[];
  runOfShow: RunOfShowRow[];
  /** Which team record the run of show came from; null when the team hasn't written one. */
  runOfShowSource: RunOfShowSource | null;
  /** Sections hidden in staff preview because the viewer's role can't open them in the ERP. */
  previewHidden: { readiness: boolean; plan: boolean; documents: boolean };
}

export async function getGuestEvent(bookingId?: string): Promise<GuestEvent | null> {
  const s = await scope(bookingId);
  if (!s?.b) return null;
  const b = s.b;
  const seeReadiness = canSee(s, "operations:read");
  const seePlan = canSee(s, "execution:read");
  const seeSignatures = canSee(s, "esign:read");
  // Package requests belong to the booking's own customer (concierge-rules REQUEST_PREVIEW_PERMISSIONS).
  const seeRequests = !s.collabRole && REQUEST_PREVIEW_PERMISSIONS.PACKAGES.every((p) => canSee(s, p));
  const [readiness, phases, guests, balance, docsToSign, requests, ops, owner] = await Promise.all([
    readIf(seeReadiness, () => loadReadiness(b.id), null),
    readIf(seePlan, () => loadPlanPhases(b.id), null),
    loadGuestCounts(b.id),
    s.collabRole ? Promise.resolve({ balanceDue: 0, issued: 0 }) : loadBookingBalance(b.id),
    readIf(
      seeSignatures && !s.collabRole,
      () => prisma.signatureRequest.count({ where: { bookingId: b.id, status: { in: ["SENT", "VIEWED"] } } }),
      null
    ),
    readIf(
      seeRequests,
      () =>
        prisma.task.count({
          where: { bookingId: b.id, taskType: "CLIENT_REQUEST", status: { not: "DONE" }, metadata: { path: ["kind"], equals: "PACKAGES" } },
        }),
      0
    ),
    loadEventOps(s, b.id),
    prisma.user.findUnique({ where: { id: b.createdById }, select: { id: true, name: true, isActive: true } }),
  ]);
  const plan = phases ? planProgress(phases) : null;
  return {
    booking: shapeBooking(b),
    preview: s.preview,
    hostName: `${b.contact.firstName} ${b.contact.lastName ?? ""}`.trim(),
    bookings: s.all.map((x) => ({ id: x.id, eventName: x.eventName, date: x.date.toISOString() })),
    readiness: readiness?.pct ?? null,
    readinessChecks: readiness ? { passing: readiness.passing, total: readiness.total } : null,
    openTasks: plan?.open ?? 0,
    planTasks: plan && plan.total > 0 ? { total: plan.total, done: plan.done, open: plan.open } : null,
    docsToSign,
    guests: { confirmed: guests.attending, total: guests.onList },
    guestCounts: guests,
    balanceDue: balance.balanceDue,
    invoicesIssued: balance.issued,
    collaboratorRole: s.collabRole,
    requests,
    team: shapeTeam(owner, ops.staff),
    runOfShow: ops.runOfShow.rows,
    runOfShowSource: ops.runOfShow.source,
    previewHidden: { readiness: !seeReadiness, plan: !seePlan, documents: !seeSignatures },
  };
}

// ------------------------------------------------------------ checklist (the team's plan + the host's own to-dos)
export interface GuestChecklist {
  bookingId: string;
  preview: boolean;
  /** False in staff preview when the viewer's role can't open the Execution Plan. */
  planVisible: boolean;
  /** Execution-plan tasks, counted as the team's Execution Plan view counts them. */
  done: number;
  total: number;
  pct: number | null;
  groups: ChecklistGroup[];
  /** The host's own to-dos: real Task rows (CLIENT_TODO) on the booking's Tasks tab. */
  todos: GuestTodo[];
}

export async function getGuestChecklist(bookingId?: string): Promise<GuestChecklist | null> {
  const s = await scope(bookingId);
  if (!s?.b) return null;
  const b = s.b;
  const planVisible = canSee(s, "execution:read");
  const [phases, todoRows] = await Promise.all([
    readIf(planVisible, () => loadPlanPhases(b.id), null),
    prisma.task.findMany({
      where: { bookingId: b.id, taskType: "CLIENT_TODO" },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, status: true },
    }),
  ]);
  const progress = planProgress(phases ?? []);
  return {
    bookingId: b.id,
    preview: s.preview,
    planVisible,
    done: progress.done,
    total: progress.total,
    pct: progress.pct,
    groups: checklistGroups(phases ?? []),
    todos: todoRows.map((t) => shapeTodo(t)),
  };
}

export async function addGuestTodo(bookingId: string, title: string): Promise<Result<GuestTodo>> {
  const s = await scope(bookingId);
  if (!s) return { success: false, error: "Please sign in." };
  if (!s.b) return { success: false, error: "Not authorized." };
  if (s.preview) return { success: false, error: PREVIEW_WRITE_ERROR };
  if (s.collabRole === "VIEWER") return { success: false, error: VIEWER_WRITE_ERROR };
  const clean = title.trim().slice(0, 160);
  if (clean.length < 2) return { success: false, error: "Type a to-do first." };
  const t = await prisma.task.create({
    data: { title: clean, status: "TODO", priority: "MEDIUM", taskType: "CLIENT_TODO", bookingId: s.b.id, creatorId: s.u.id },
    select: { id: true, title: true, status: true },
  });
  return { success: true, data: shapeTodo(t) };
}

export async function toggleGuestTodo(taskId: string): Promise<Result<{ done: boolean; status: string; statusLabel: string }>> {
  const s = await scope();
  if (!s) return { success: false, error: "Please sign in." };
  if (s.preview) return { success: false, error: PREVIEW_WRITE_ERROR };
  const t = await prisma.task.findFirst({
    where: { id: taskId, taskType: "CLIENT_TODO", bookingId: { in: s.all.map((x) => x.id).filter((id) => s.collabRoles[id] !== "VIEWER") } },
    select: { id: true, status: true },
  });
  if (!t) return { success: false, error: "Not found." };
  const next = t.status === "DONE" ? "TODO" : "DONE";
  const updated = await prisma.task.update({
    where: { id: t.id },
    data: { status: next, completedAt: next === "DONE" ? new Date() : null },
    select: { id: true, title: true, status: true },
  });
  const todo = shapeTodo(updated);
  return { success: true, data: { done: todo.done, status: todo.status, statusLabel: todo.statusLabel } };
}

// ------------------------------------------------------------ event-day live
export interface GuestLive {
  booking: GuestBooking;
  /** Today is the event day in India. */
  isEventDay: boolean;
  /** Days from today (India) to the event; negative once it has passed. */
  daysToGo: number;
  /** The team's Guest Manager numbers; `checkedIn` is its "Checked In". */
  guests: GuestCounts;
  /** People rostered on the event (StaffAssignment), and how many have checked in. */
  staff: { assigned: number; checkedIn: number };
  /** Partners (BookingVendor), confirmed as the booking page counts them. */
  partners: { total: number; confirmed: number };
  runOfShow: RunOfShowRow[];
  runOfShowSource: RunOfShowSource | null;
  /** The item in progress, else the next pending one (day-of timeline only). */
  now: { time: string; activity: string; live: boolean } | null;
}

export async function getGuestLive(bookingId?: string): Promise<GuestLive | null> {
  const s = await scope(bookingId);
  if (!s?.b) return null;
  const b = s.b;
  const [guests, ops, vendors] = await Promise.all([
    loadGuestCounts(b.id),
    loadEventOps(s, b.id),
    prisma.bookingVendor.findMany({
      where: { bookingId: b.id },
      select: { status: true, operationAssignments: { orderBy: { createdAt: "desc" }, select: { status: true } } },
    }),
  ]);
  const daysToGo = daysUntilEvent(b.date);
  return {
    booking: shapeBooking(b),
    isEventDay: daysToGo === 0,
    daysToGo,
    guests,
    staff: staffCounts(ops.staff),
    partners: partnerCounts(vendors.map((v) => ({ status: v.status, assignmentStatuses: v.operationAssignments.map((a) => a.status) }))),
    runOfShow: ops.runOfShow.rows,
    runOfShowSource: ops.runOfShow.source,
    now: currentOrNext(ops.runOfShow),
  };
}

// ------------------------------------------------------------ packages & partners
export interface GuestPackage { id: string; name: string; category: string; vendorName: string; price: number; priceUnit: string; description: string | null; imageUrl: string | null }
export async function getGuestPackages(venueId?: string): Promise<GuestPackage[]> {
  const u = await getHostUser();
  if (!u) return [];
  try {
    const rows = await prisma.vendorPackage.findMany({
      where: { status: "ACTIVE", vendor: { status: "ACTIVE" }, ...(venueId ? { OR: [{ allVenues: true }, { venueIds: { has: venueId } }] } : {}) },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 60,
      select: { id: true, name: true, category: true, price: true, customerPrice: true, priceUnit: true, description: true, coverImageId: true, vendor: { select: { name: true } }, images: { orderBy: { sortOrder: "asc" }, take: 3, select: { id: true, url: true } } },
    });
    return rows.map((p) => {
      const cover = p.images.find((i) => i.id === p.coverImageId) ?? p.images[0];
      return { id: p.id, name: p.name, category: p.category, vendorName: p.vendor.name, price: Number(p.customerPrice ?? p.price), priceUnit: String(p.priceUnit), description: p.description, imageUrl: cover && cover.url.length < 400_000 ? cover.url : null };
    });
  } catch { return []; }
}

// ------------------------------------------------------------ requests → the team's queue
/** Requests that change the booking (packages, points). Messages go through the concierge conversation in guest-concierge.actions.ts. */
export type RequestKind = "PACKAGES" | "REDEEM";
export async function requestFromConcierge(bookingId: string, text: string, kind: RequestKind): Promise<Result<{ id: string }>> {
  const s = await scope(bookingId);
  if (!s) return { success: false, error: "Please sign in." };
  if (!s.b) return { success: false, error: "Not authorized." };
  if (s.preview) return { success: false, error: PREVIEW_WRITE_ERROR };
  // Packages and points change what the customer pays, so only the booking's own customer can ask.
  if (s.collabRole) return { success: false, error: HOST_ONLY_ERROR };
  const b = s.b;
  const clean = text.trim().slice(0, 1000);
  if (!clean) return { success: false, error: "Type a message first." };
  const prefix = kind === "PACKAGES" ? "Packages requested" : kind === "REDEEM" ? "Reward redemption" : "Message from host";
  const t = await prisma.task.create({
    data: {
      title: `${prefix} · ${b.eventName}`.slice(0, 200), description: clean, status: "TODO", priority: "MEDIUM",
      taskType: "CLIENT_REQUEST", bookingId: b.id, creatorId: s.u.id, assigneeId: b.createdById,
      metadata: { kind, fromUserId: s.u.id, via: "guest-app" },
    },
    select: { id: true },
  });
  notify({ userId: b.createdById, type: "TASK_ASSIGNED", title: `${prefix} — ${b.eventName}`, message: clean.slice(0, 180), actionUrl: `/bookings/${b.id}` });
  return { success: true, data: { id: t.id } };
}
