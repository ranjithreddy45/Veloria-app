import {
  BOOKING_STATUS_LABEL,
  EXECUTION_TASK_STATUS_LABEL,
  TASK_STATUS_LABEL,
  TIMELINE_ITEM_STATUS_LABEL,
  customerLabel,
} from "@/lib/customer-app/status-labels";

// ============================================================
// The customer's event screens: pure shaping of the TEAM's own records.
//
// No database and no server-only imports. guest-host.actions.ts loads the
// same rows the team's screens load and passes them through these functions,
// so each rule below restates a team-side rule (named in its comment) and is
// pinned by event-view.test.ts. Change a rule here only together with its
// team twin, or the customer and the team will disagree about one record.
// ============================================================

export const IST_TIME_ZONE = "Asia/Kolkata";
/** India Standard Time is UTC+05:30 all year (no daylight saving). */
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

// ------------------------------------------------------------ dates

/** "YYYY-MM-DD" of a @db.Date column. Prisma returns it at UTC midnight, so the UTC day is the stored day. */
export function dbDateKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" of the calendar day in India at `now`. The server itself runs on UTC. */
export function istDateKey(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole days from today (in India) to the event day: 0 on the day, negative once it has passed. */
export function daysUntilEvent(date: Date | string, now: Date = new Date()): number {
  return Math.round((Date.parse(dbDateKey(date)) - Date.parse(istDateKey(now))) / DAY_MS);
}

/** Every date a customer reads is written in India time, whatever time zone the server runs in. */
export function formatIstDate(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }
): string {
  return new Date(date).toLocaleDateString("en-IN", { ...opts, timeZone: IST_TIME_ZONE });
}

// ------------------------------------------------------------ booking

export interface GuestBooking {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  /** Booking.date (@db.Date) as an ISO string at UTC midnight. Format it with formatIstDate. */
  date: string;
  timeSlot: string;
  status: string;
  /** Customer wording for `status`, from status-labels.ts. */
  statusLabel: string;
  guestCount: number;
  venueId: string;
  venueName: string;
  /** Booking.hallBooked: the hall inside the venue, when the team has recorded one. */
  hallName: string | null;
}

export interface BookingInput {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: Date;
  timeSlot: string;
  status: string;
  guestCount: number;
  venueId: string;
  hallBooked?: string | null;
  venue: { name: string };
}

/** The facts the team's booking page leads with: status, date, slot, venue and hall, expected guests. */
export function shapeBooking(b: BookingInput): GuestBooking {
  const hall = b.hallBooked?.trim();
  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    eventName: b.eventName,
    eventType: b.eventType,
    date: b.date.toISOString(),
    timeSlot: b.timeSlot,
    status: b.status,
    statusLabel: customerLabel(BOOKING_STATUS_LABEL, b.status),
    guestCount: b.guestCount,
    venueId: b.venueId,
    venueName: b.venue.name,
    hallName: hall ? hall : null,
  };
}

// ------------------------------------------------------------ readiness

export interface CustomerReadiness {
  pct: number;
  passing: number;
  total: number;
}

/**
 * The operations page's "Operations Readiness" (computeOperationReadiness in
 * lib/ops/state-machine.ts) reduced to its headline: the same %, the same
 * "N of M checks passing". Gate names and details stay with the team.
 */
export function toCustomerReadiness(
  r: { readyPct: number; readyCount: number; totalCount: number } | null | undefined
): CustomerReadiness | null {
  if (!r || !(r.totalCount > 0)) return null;
  return { pct: r.readyPct, passing: r.readyCount, total: r.totalCount };
}

// ------------------------------------------------------------ execution plan (checklist)

export interface PlanTaskInput {
  id: string;
  title: string;
  status: string;
  order?: number | null;
  slaFinishBy?: Date | null;
  assignee?: { name: string | null } | null;
  vendor?: { name: string } | null;
}

export interface PlanPhaseInput {
  name: string;
  order?: number | null;
  plannedEnd?: Date | null;
  tasks: readonly PlanTaskInput[];
}

/** Stable sort by `order`: the team's plan view orders phases and tasks by `order asc`. */
function byOrder<T extends { order?: number | null }>(rows: readonly T[]): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => (a.row.order ?? 0) - (b.row.order ?? 0) || a.i - b.i)
    .map((x) => x.row);
}

export interface PlanProgress {
  total: number;
  done: number;
  open: number;
  /** null when the plan has no tasks: "no plan yet" is not "0% done". */
  pct: number | null;
}

/** The team's Execution Plan view count: COMPLETED tasks over every task in every phase. */
export function planProgress(phases: readonly PlanPhaseInput[]): PlanProgress {
  let total = 0;
  let done = 0;
  for (const p of phases) {
    for (const t of p.tasks) {
      total++;
      if (t.status === "COMPLETED") done++;
    }
  }
  return { total, done, open: total - done, pct: total > 0 ? Math.round((done / total) * 100) : null };
}

/** The first unfinished plan task in run order. Due is the task's SLA finish, else its phase's planned end. */
export function nextPlanTask(phases: readonly PlanPhaseInput[]): { title: string; dueDate: string | null } | null {
  for (const p of byOrder(phases)) {
    for (const t of byOrder(p.tasks)) {
      if (t.status === "COMPLETED") continue;
      const due = t.slaFinishBy ?? p.plannedEnd ?? null;
      return { title: t.title, dueDate: due ? due.toISOString() : null };
    }
  }
  return null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  owner: string;
  done: boolean;
  status: string;
  statusLabel: string;
}

export interface ChecklistGroup {
  title: string;
  due: string | null;
  items: ChecklistItem[];
}

/**
 * Who is doing a plan task. A vendor shows as "Partner" (vendor identities stay
 * internal, as on the team's client event-plan page); a task assigned to a team
 * member shows their name; anything else belongs to the team.
 */
export function taskOwner(t: Pick<PlanTaskInput, "assignee" | "vendor">): string {
  if (t.vendor) return "Partner";
  const name = t.assignee?.name?.trim();
  return name ? name : "Veloria team";
}

/** The execution plan as the customer's checklist: phases that have tasks, in the team's order, with the team's statuses. */
export function checklistGroups(phases: readonly PlanPhaseInput[]): ChecklistGroup[] {
  return byOrder(phases)
    .filter((p) => p.tasks.length > 0)
    .map((p) => ({
      title: p.name,
      due: p.plannedEnd ? p.plannedEnd.toISOString() : null,
      items: byOrder(p.tasks).map((t) => ({
        id: t.id,
        label: t.title,
        owner: taskOwner(t),
        done: t.status === "COMPLETED",
        status: t.status,
        statusLabel: customerLabel(EXECUTION_TASK_STATUS_LABEL, t.status),
      })),
    }));
}

export interface GuestTodo {
  id: string;
  label: string;
  done: boolean;
  status: string;
  statusLabel: string;
}

/** A host's own to-do is a Task (taskType CLIENT_TODO) on the booking: DONE on the team's board is done here. */
export function shapeTodo(t: { id: string; title: string; status: string }): GuestTodo {
  return {
    id: t.id,
    label: t.title,
    done: t.status === "DONE",
    status: t.status,
    statusLabel: customerLabel(TASK_STATUS_LABEL, t.status),
  };
}

// ------------------------------------------------------------ run of show

export type RunOfShowStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "PLANNED";
/** Which team record the rows came from. */
export type RunOfShowSource = "DAY_OF_TIMELINE" | "OPERATIONS" | "FUNCTION_SHEET";

export interface RunOfShowRow {
  time: string;
  activity: string;
  status: RunOfShowStatus;
  statusLabel: string;
}

export interface RunOfShow {
  source: RunOfShowSource | null;
  rows: RunOfShowRow[];
}

const TIMELINE_ITEM_STATUSES = new Set<string>(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]);
/** Beo.status of a function sheet the team has signed off (the readiness gate "Function sheet published"). */
const PUBLISHED_SHEET = new Set<string>(["PUBLISHED", "LOCKED"]);

/** "18:00" becomes "6:00 PM", the way the team's day-of timeline displays it. Anything else stays as the team typed it. */
export function formatRunTime(time: string): string {
  const t = time.trim();
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return t;
  return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** Rows of a stored JSON run of show ([{ time, activity, owner | assignee, notes }]). Only time and activity cross over. */
function jsonRunOfShow(raw: unknown): { time: string; activity: string }[] {
  if (!Array.isArray(raw)) return [];
  const rows: { time: string; activity: string }[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const activity = typeof o.activity === "string" ? o.activity.trim() : "";
    if (!activity) continue;
    rows.push({ time: typeof o.time === "string" ? o.time : "", activity });
  }
  return rows;
}

function plannedRow(r: { time: string; activity: string }): RunOfShowRow {
  return {
    time: formatRunTime(r.time),
    activity: r.activity,
    status: "PLANNED",
    statusLabel: customerLabel(TIMELINE_ITEM_STATUS_LABEL, "PLANNED"),
  };
}

export interface RunOfShowInput {
  /** EventTimeline.items: the team's day-of timeline. */
  timelineItems?: readonly { time: string; activity: string; status: string; order?: number | null }[] | null;
  /** EventOperation.runOfShow: the operations page's run of show. */
  operationRunOfShow?: unknown;
  /** The booking's latest function sheet (Beo), picked the way the booking page picks it. */
  functionSheet?: { status: string; runOfShow: unknown } | null;
}

/**
 * The run of show the team has actually written. The first source with rows wins:
 *  1. the day-of timeline, in the team's order, with its live statuses;
 *  2. the operations run of show (it starts empty and only the team fills it);
 *  3. the function sheet, once PUBLISHED or LOCKED. Provisioning pre-fills every
 *     new DRAFT sheet from a generic slot template, so a draft is not the
 *     customer's plan.
 * Nothing written yet gives no rows, and the screen says the coordinator will
 * share it. Owners, assignees and crew notes never cross over.
 */
export function pickRunOfShow(input: RunOfShowInput): RunOfShow {
  const items = byOrder((input.timelineItems ?? []).filter((i) => i.activity.trim() !== ""));
  if (items.length > 0) {
    return {
      source: "DAY_OF_TIMELINE",
      rows: items.map((i) => {
        const status = (TIMELINE_ITEM_STATUSES.has(i.status) ? i.status : "PENDING") as RunOfShowStatus;
        return {
          time: formatRunTime(i.time),
          activity: i.activity.trim(),
          status,
          statusLabel: customerLabel(TIMELINE_ITEM_STATUS_LABEL, status),
        };
      }),
    };
  }
  const ops = jsonRunOfShow(input.operationRunOfShow);
  if (ops.length > 0) return { source: "OPERATIONS", rows: ops.map(plannedRow) };
  const sheet = input.functionSheet;
  if (sheet && PUBLISHED_SHEET.has(sheet.status)) {
    const rows = jsonRunOfShow(sheet.runOfShow);
    if (rows.length > 0) return { source: "FUNCTION_SHEET", rows: rows.map(plannedRow) };
  }
  return { source: null, rows: [] };
}

/**
 * For the live screen: the item the team has marked in progress, else the next
 * one still pending. Only the day-of timeline carries live statuses, so the
 * other sources have no "now".
 */
export function currentOrNext(rs: RunOfShow): { time: string; activity: string; live: boolean } | null {
  if (rs.source !== "DAY_OF_TIMELINE") return null;
  const cur = rs.rows.find((r) => r.status === "IN_PROGRESS") ?? rs.rows.find((r) => r.status === "PENDING");
  return cur ? { time: cur.time, activity: cur.activity, live: cur.status === "IN_PROGRESS" } : null;
}

// ------------------------------------------------------------ guests

export interface GuestCounts {
  /** Guest records on the list. */
  onList: number;
  /** Records plus their plus-ones: the team's "Total Invited". */
  invitedHeads: number;
  /** Records that accepted: the team's "RSVPs Accepted". */
  attending: number;
  declined: number;
  notReplied: number;
  /** Records checked in at the door: the team's "Checked In". */
  checkedIn: number;
}

/** The numbers on the team's Guest Manager (bookings/[id]/guests), counted the same way. */
export function guestCounts(
  guests: readonly { rsvpStatus: string; plusOnes: number | null; isCheckedIn: boolean }[]
): GuestCounts {
  const c: GuestCounts = { onList: guests.length, invitedHeads: 0, attending: 0, declined: 0, notReplied: 0, checkedIn: 0 };
  for (const g of guests) {
    c.invitedHeads += 1 + (g.plusOnes ?? 0);
    if (g.rsvpStatus === "ACCEPTED") c.attending++;
    else if (g.rsvpStatus === "DECLINED") c.declined++;
    else c.notReplied++;
    if (g.isCheckedIn) c.checkedIn++;
  }
  return c;
}

// ------------------------------------------------------------ team

export interface TeamMember {
  initials: string;
  name: string;
  role: string;
}

export interface StaffInput {
  role: string;
  shiftStart: Date;
  status?: string;
  user: { id: string; name: string | null; isActive: boolean };
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "V"
  );
}

/** Rostered roles are typed by the team ("Event Manager"); an enum-style value reads as words. */
export function staffRoleLabel(role: string): string {
  const r = role.trim();
  if (!r) return "Event team";
  return /^[A-Z0-9_]+$/.test(r) ? r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, " ") : r;
}

/**
 * The people a customer sees as their team:
 *  - the booking's owner (Booking.createdBy): customer requests are routed to
 *    them, and the team's client event-plan page names them point of contact;
 *  - then the staff rostered on the event (StaffAssignment), by shift start as
 *    on the operations page.
 * Deactivated accounts, unnamed users and repeat shifts of one person are skipped.
 */
export function shapeTeam(
  owner: { id: string; name: string | null; isActive: boolean } | null,
  staff: readonly StaffInput[],
  limit = 3
): TeamMember[] {
  const seen = new Set<string>();
  const team: TeamMember[] = [];
  const add = (id: string, name: string | null, active: boolean, role: string) => {
    const n = name?.trim();
    if (!n || !active || seen.has(id)) return;
    seen.add(id);
    team.push({ initials: initialsOf(n), name: n, role });
  };
  if (owner) add(owner.id, owner.name, owner.isActive, "Point of contact");
  const rostered = staff
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.shiftStart.getTime() - b.s.shiftStart.getTime() || a.i - b.i);
  for (const { s } of rostered) add(s.user.id, s.user.name, s.user.isActive, staffRoleLabel(s.role));
  return team.slice(0, limit);
}

/** Distinct active people rostered, and how many of them have checked in (StaffAssignment status CHECKED_IN). */
export function staffCounts(staff: readonly StaffInput[]): { assigned: number; checkedIn: number } {
  const assigned = new Set<string>();
  const checkedIn = new Set<string>();
  for (const s of staff) {
    if (!s.user.isActive) continue;
    assigned.add(s.user.id);
    if (s.status === "CHECKED_IN") checkedIn.add(s.user.id);
  }
  return { assigned: assigned.size, checkedIn: checkedIn.size };
}

// ------------------------------------------------------------ partners

/**
 * Partners are the booking's BookingVendor rows. A partner counts as confirmed
 * by the record the team's booking page ("N/M vendors confirmed") and readiness
 * gate read: its operations vendor assignment (NOTIFIED, then CONFIRMED or
 * DECLINED), newest first. A partner never sent through operations falls back
 * to BookingVendor.status, which the vendor page sets.
 */
export function partnerCounts(
  rows: readonly { status: string; assignmentStatuses: readonly string[] }[]
): { total: number; confirmed: number } {
  let confirmed = 0;
  for (const r of rows) {
    const latest = r.assignmentStatuses[0];
    const ok = latest !== undefined ? latest === "CONFIRMED" : r.status === "CONFIRMED" || r.status === "COMPLETED";
    if (ok) confirmed++;
  }
  return { total: rows.length, confirmed };
}

// ------------------------------------------------------------ money

// Balance due uses finance's shared OWED rule (src/lib/finance/issued-invoices.ts): the sum of
// balanceDue over SENT, PARTIALLY_PAID and OVERDUE invoices, so a paid, cancelled or fully
// refunded invoice adds nothing (`issued` still counts every billed invoice). It is the same
// code the team booking page uses, so both sides always show the same figure.
export { bookingBalance } from "@/lib/finance/issued-invoices";
