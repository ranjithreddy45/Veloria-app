import { describe, expect, it } from "vitest";
import {
  bookingBalance,
  checklistGroups,
  currentOrNext,
  daysUntilEvent,
  dbDateKey,
  formatIstDate,
  formatRunTime,
  guestCounts,
  istDateKey,
  nextPlanTask,
  partnerCounts,
  pickRunOfShow,
  planProgress,
  shapeBooking,
  shapeTeam,
  shapeTodo,
  staffCounts,
  staffRoleLabel,
  toCustomerReadiness,
  type PlanPhaseInput,
  type StaffInput,
} from "./event-view";

const dbDate = (key: string) => new Date(`${key}T00:00:00.000Z`);

describe("dates in India time", () => {
  it("reads a @db.Date as its stored UTC day", () => {
    expect(dbDateKey(dbDate("2026-10-01"))).toBe("2026-10-01");
    expect(dbDateKey("2026-10-01T00:00:00.000Z")).toBe("2026-10-01");
  });

  it("takes today's date in India, not the UTC server's", () => {
    // 20:00 UTC on 30 Sep is 01:30 on 1 Oct in India.
    expect(istDateKey(new Date("2026-09-30T20:00:00Z"))).toBe("2026-10-01");
    expect(istDateKey(new Date("2026-09-30T18:29:00Z"))).toBe("2026-09-30");
  });

  it("counts days to the event from the Indian calendar day", () => {
    const event = dbDate("2026-10-01");
    expect(daysUntilEvent(event, new Date("2026-09-30T20:00:00Z"))).toBe(0);
    expect(daysUntilEvent(event, new Date("2026-09-30T12:00:00Z"))).toBe(1);
    expect(daysUntilEvent(event, new Date("2026-10-03T06:00:00Z"))).toBe(-2);
    expect(daysUntilEvent(dbDate("2027-03-01"), new Date("2026-03-01T06:00:00Z"))).toBe(365);
  });

  it("formats dates in India time", () => {
    expect(formatIstDate(dbDate("2026-10-01"), { day: "numeric", month: "short", year: "numeric" })).toBe("1 Oct 2026");
    expect(formatIstDate(new Date("2026-09-30T20:00:00Z"), { day: "numeric", month: "short" })).toBe("1 Oct");
  });
});

describe("shapeBooking", () => {
  const base = {
    id: "b1",
    bookingNumber: "VG-1",
    eventName: "Asha weds Rohan",
    eventType: "WEDDING",
    date: dbDate("2026-12-12"),
    timeSlot: "EVENING",
    status: "TENTATIVE",
    guestCount: 350,
    venueId: "v1",
    venue: { name: "Veloria Grand" },
  };

  it("carries the booking page's facts with customer status wording", () => {
    expect(shapeBooking({ ...base, hallBooked: "  Crystal Hall " })).toEqual({
      id: "b1",
      bookingNumber: "VG-1",
      eventName: "Asha weds Rohan",
      eventType: "WEDDING",
      date: "2026-12-12T00:00:00.000Z",
      timeSlot: "EVENING",
      status: "TENTATIVE",
      statusLabel: "Awaiting confirmation",
      guestCount: 350,
      venueId: "v1",
      venueName: "Veloria Grand",
      hallName: "Crystal Hall",
    });
  });

  it("hides a blank hall and never shows a raw status", () => {
    const s = shapeBooking({ ...base, hallBooked: "   ", status: "ON_ICE" });
    expect(s.hallName).toBeNull();
    expect(s.statusLabel).toBe("On ice");
    expect(shapeBooking(base).hallName).toBeNull();
  });
});

describe("toCustomerReadiness", () => {
  it("keeps the team's % and check counts, and nothing else", () => {
    const team = {
      operationId: "op1",
      gates: [{ key: "beo", label: "Function sheet published", ready: false, required: true, detail: "BEO DRAFT" }],
      readyCount: 6,
      totalCount: 7,
      readyPct: 86,
      canGoLive: false,
    };
    expect(toCustomerReadiness(team)).toEqual({ pct: 86, passing: 6, total: 7 });
  });

  it("is absent when there is no operation to measure", () => {
    expect(toCustomerReadiness(null)).toBeNull();
    expect(toCustomerReadiness(undefined)).toBeNull();
    expect(toCustomerReadiness({ readyPct: 0, readyCount: 0, totalCount: 0 })).toBeNull();
  });
});

describe("execution plan as the checklist", () => {
  const phases: PlanPhaseInput[] = [
    {
      name: "Event day",
      order: 2,
      plannedEnd: new Date("2026-12-12T18:30:00Z"),
      tasks: [{ id: "t4", title: "Guest welcome", status: "NOT_STARTED", order: 1, assignee: { name: "Priya Nair" } }],
    },
    {
      name: "Pre-event",
      order: 1,
      plannedEnd: new Date("2026-12-10T12:30:00Z"),
      tasks: [
        { id: "t2", title: "Decor mock-up", status: "BLOCKED", order: 2, vendor: { name: "Petals & Co" }, assignee: { name: "Priya Nair" } },
        { id: "t1", title: "Menu tasting", status: "COMPLETED", order: 1, assignee: { name: "  " } },
        { id: "t3", title: "Sound check", status: "IN_PROGRESS", order: 3, slaFinishBy: new Date("2026-12-11T09:00:00Z") },
      ],
    },
    { name: "Setup", order: 3, tasks: [] },
  ];

  it("counts progress like the team's plan view", () => {
    expect(planProgress(phases)).toEqual({ total: 4, done: 1, open: 3, pct: 25 });
    expect(planProgress([])).toEqual({ total: 0, done: 0, open: 0, pct: null });
  });

  it("finds the next task in phase order, then task order", () => {
    // t1 is done; t2 is next and has no SLA, so its phase's planned end is the due date.
    expect(nextPlanTask(phases)).toEqual({ title: "Decor mock-up", dueDate: "2026-12-10T12:30:00.000Z" });
    expect(
      nextPlanTask([
        { name: "p", plannedEnd: new Date("2026-12-10T00:00:00Z"), tasks: [{ id: "x", title: "Sound check", status: "IN_PROGRESS", slaFinishBy: new Date("2026-12-11T09:00:00Z") }] },
      ])
    ).toEqual({ title: "Sound check", dueDate: "2026-12-11T09:00:00.000Z" });
    expect(nextPlanTask([{ name: "p", tasks: [{ id: "x", title: "Done", status: "COMPLETED" }] }])).toBeNull();
    expect(nextPlanTask([{ name: "p", tasks: [{ id: "x", title: "Open", status: "DELAYED" }] }])).toEqual({ title: "Open", dueDate: null });
  });

  it("groups tasks by phase with the team's statuses, hiding vendor names", () => {
    const groups = checklistGroups(phases);
    expect(groups.map((g) => g.title)).toEqual(["Pre-event", "Event day"]);
    expect(groups[0].due).toBe("2026-12-10T12:30:00.000Z");
    expect(groups[0].items.map((i) => [i.id, i.owner, i.done, i.statusLabel])).toEqual([
      ["t1", "Veloria team", true, "Done"],
      ["t2", "Partner", false, "On hold"],
      ["t3", "Veloria team", false, "In progress"],
    ]);
    expect(groups[1].items).toEqual([
      { id: "t4", label: "Guest welcome", owner: "Priya Nair", done: false, status: "NOT_STARTED", statusLabel: "Not started" },
    ]);
  });

  it("reads a host to-do's status off the team's task board", () => {
    expect(shapeTodo({ id: "a", title: "Book mehendi artist", status: "DONE" })).toEqual({
      id: "a",
      label: "Book mehendi artist",
      done: true,
      status: "DONE",
      statusLabel: "Done",
    });
    expect(shapeTodo({ id: "b", title: "Send invites", status: "IN_REVIEW" })).toMatchObject({ done: false, statusLabel: "In review" });
    expect(shapeTodo({ id: "c", title: "Shortlist songs", status: "TODO" })).toMatchObject({ done: false, statusLabel: "To do" });
  });
});

describe("run of show", () => {
  const sheet = {
    status: "PUBLISHED",
    runOfShow: [{ time: "17:00", activity: "Baraat arrival", owner: "Coordinator", notes: "Dhol at gate 2" }],
  };

  it("writes 24-hour times the way the day-of timeline does, and leaves other text alone", () => {
    expect(formatRunTime("18:00")).toBe("6:00 PM");
    expect(formatRunTime("00:05")).toBe("12:05 AM");
    expect(formatRunTime("12:30")).toBe("12:30 PM");
    expect(formatRunTime(" 6 pm ")).toBe("6 pm");
    expect(formatRunTime("25:00")).toBe("25:00");
    expect(formatRunTime("")).toBe("");
  });

  it("prefers the day-of timeline, in the team's order, with live statuses", () => {
    const rs = pickRunOfShow({
      timelineItems: [
        { time: "19:00", activity: "Dinner", status: "PENDING", order: 2 },
        { time: "18:00", activity: " Varmala ", status: "IN_PROGRESS", order: 1 },
        { time: "20:30", activity: "  ", status: "PENDING", order: 3 },
        { time: "21:00", activity: "Send-off", status: "SOMETHING_NEW", order: 4 },
      ],
      operationRunOfShow: [{ time: "10:00", activity: "Not used" }],
      functionSheet: sheet,
    });
    expect(rs.source).toBe("DAY_OF_TIMELINE");
    expect(rs.rows).toEqual([
      { time: "6:00 PM", activity: "Varmala", status: "IN_PROGRESS", statusLabel: "Now" },
      { time: "7:00 PM", activity: "Dinner", status: "PENDING", statusLabel: "Planned" },
      { time: "9:00 PM", activity: "Send-off", status: "PENDING", statusLabel: "Planned" },
    ]);
  });

  it("falls back to the operations run of show, dropping assignees and notes", () => {
    const rs = pickRunOfShow({
      timelineItems: [],
      operationRunOfShow: [{ time: "18:30", activity: "Cake cutting", assignee: "Ravi", notes: "internal" }, { activity: "   " }, null, "junk"],
      functionSheet: sheet,
    });
    expect(rs).toEqual({ source: "OPERATIONS", rows: [{ time: "6:30 PM", activity: "Cake cutting", status: "PLANNED", statusLabel: "Planned" }] });
  });

  it("uses the function sheet only once it is published or locked", () => {
    expect(pickRunOfShow({ functionSheet: sheet })).toEqual({
      source: "FUNCTION_SHEET",
      rows: [{ time: "5:00 PM", activity: "Baraat arrival", status: "PLANNED", statusLabel: "Planned" }],
    });
    expect(pickRunOfShow({ functionSheet: { ...sheet, status: "LOCKED" } }).source).toBe("FUNCTION_SHEET");
    expect(pickRunOfShow({ functionSheet: { ...sheet, status: "DRAFT" } })).toEqual({ source: null, rows: [] });
  });

  it("returns nothing when the team hasn't written one, never a template", () => {
    expect(pickRunOfShow({ timelineItems: null, operationRunOfShow: [], functionSheet: null })).toEqual({ source: null, rows: [] });
    expect(pickRunOfShow({})).toEqual({ source: null, rows: [] });
  });

  it("puts the in-progress item first on the live screen, else the next pending one", () => {
    const live = pickRunOfShow({
      timelineItems: [
        { time: "18:00", activity: "Varmala", status: "DONE", order: 1 },
        { time: "19:00", activity: "Dinner", status: "IN_PROGRESS", order: 2 },
        { time: "21:00", activity: "Send-off", status: "PENDING", order: 3 },
      ],
    });
    expect(currentOrNext(live)).toEqual({ time: "7:00 PM", activity: "Dinner", live: true });
    const later = pickRunOfShow({
      timelineItems: [
        { time: "18:00", activity: "Varmala", status: "DONE", order: 1 },
        { time: "19:00", activity: "Dinner", status: "SKIPPED", order: 2 },
        { time: "21:00", activity: "Send-off", status: "PENDING", order: 3 },
      ],
    });
    expect(currentOrNext(later)).toEqual({ time: "9:00 PM", activity: "Send-off", live: false });
    expect(currentOrNext(pickRunOfShow({ timelineItems: [{ time: "18:00", activity: "Varmala", status: "DONE" }] }))).toBeNull();
    expect(currentOrNext(pickRunOfShow({ functionSheet: sheet }))).toBeNull();
  });
});

describe("guestCounts", () => {
  it("counts like the team's Guest Manager", () => {
    expect(
      guestCounts([
        { rsvpStatus: "ACCEPTED", plusOnes: 3, isCheckedIn: true },
        { rsvpStatus: "ACCEPTED", plusOnes: 0, isCheckedIn: false },
        { rsvpStatus: "DECLINED", plusOnes: 1, isCheckedIn: false },
        { rsvpStatus: "PENDING", plusOnes: null, isCheckedIn: false },
      ])
    ).toEqual({ onList: 4, invitedHeads: 8, attending: 2, declined: 1, notReplied: 1, checkedIn: 1 });
    expect(guestCounts([])).toEqual({ onList: 0, invitedHeads: 0, attending: 0, declined: 0, notReplied: 0, checkedIn: 0 });
  });
});

describe("team", () => {
  const staff: StaffInput[] = [
    { role: "Captain", shiftStart: new Date("2026-12-12T12:00:00Z"), status: "CONFIRMED", user: { id: "u3", name: "Imran Khan", isActive: true } },
    { role: "EVENT_MANAGER", shiftStart: new Date("2026-12-12T10:00:00Z"), status: "CHECKED_IN", user: { id: "u2", name: "Priya Nair", isActive: true } },
    { role: "Server", shiftStart: new Date("2026-12-12T09:00:00Z"), status: "ASSIGNED", user: { id: "u4", name: "Left Company", isActive: false } },
    { role: "Coordinator", shiftStart: new Date("2026-12-12T11:00:00Z"), status: "CHECKED_IN", user: { id: "u1", name: "Sana Rao", isActive: true } },
    { role: "Captain", shiftStart: new Date("2026-12-12T15:00:00Z"), status: "ASSIGNED", user: { id: "u3", name: "Imran Khan", isActive: true } },
  ];

  it("puts the booking owner first, then rostered staff by shift start", () => {
    expect(shapeTeam({ id: "u1", name: "Sana Rao", isActive: true }, staff, 5)).toEqual([
      { initials: "SR", name: "Sana Rao", role: "Point of contact" },
      { initials: "PN", name: "Priya Nair", role: "Event manager" },
      { initials: "IK", name: "Imran Khan", role: "Captain" },
    ]);
  });

  it("skips deactivated people and caps the list", () => {
    expect(shapeTeam({ id: "u9", name: "Gone", isActive: false }, staff).map((m) => m.name)).toEqual(["Priya Nair", "Sana Rao", "Imran Khan"]);
    expect(shapeTeam(null, staff, 1)).toHaveLength(1);
    expect(shapeTeam({ id: "u5", name: "   ", isActive: true }, [])).toEqual([]);
  });

  it("counts people rostered, not shifts", () => {
    expect(staffCounts(staff)).toEqual({ assigned: 3, checkedIn: 2 });
    expect(staffCounts([])).toEqual({ assigned: 0, checkedIn: 0 });
  });

  it("reads rostered roles as words", () => {
    expect(staffRoleLabel("BANQUET_CAPTAIN")).toBe("Banquet captain");
    expect(staffRoleLabel(" Head Chef ")).toBe("Head Chef");
    expect(staffRoleLabel("  ")).toBe("Event team");
  });
});

describe("partnerCounts", () => {
  it("reads confirmation from the operations assignment the team's booking page counts", () => {
    expect(
      partnerCounts([
        { status: "PENDING", assignmentStatuses: ["CONFIRMED"] },
        { status: "CONFIRMED", assignmentStatuses: ["DECLINED", "CONFIRMED"] },
        { status: "PENDING", assignmentStatuses: ["NOTIFIED"] },
        { status: "CONFIRMED", assignmentStatuses: [] },
        { status: "COMPLETED", assignmentStatuses: [] },
        { status: "PENDING", assignmentStatuses: [] },
      ])
    ).toEqual({ total: 6, confirmed: 3 });
    expect(partnerCounts([])).toEqual({ total: 0, confirmed: 0 });
  });
});

describe("bookingBalance", () => {
  it("adds balanceDue over the booking's owed invoices only, and counts the billed ones", () => {
    expect(
      bookingBalance([
        { status: "PARTIALLY_PAID", balanceDue: 120000.5 },
        { status: "OVERDUE", balanceDue: 30000.25 },
        { status: "PAID", balanceDue: 0 },
        { status: "SENT", balanceDue: 0.1 },
        { status: "DRAFT", balanceDue: 99999 },
        { status: "CANCELLED", balanceDue: 5000 },
      ])
    ).toEqual({ balanceDue: 150000.85, issued: 4 });
  });

  it("is zero with nothing billed", () => {
    expect(bookingBalance([])).toEqual({ balanceDue: 0, issued: 0 });
    expect(bookingBalance([{ status: "DRAFT", balanceDue: 250000 }])).toEqual({ balanceDue: 0, issued: 0 });
  });
});
