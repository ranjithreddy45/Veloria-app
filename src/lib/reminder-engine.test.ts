import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Guest journey reminders. Stages are scheduled for 10:00 (DAY_OF_WELCOME
// 08:00) but the daily lane runs at 02:00; picking up only what was due by
// "now" sent every stage a day late (the tomorrow reminder on the event day,
// the day-of welcome the day after). Pinned here: each stage goes out on its
// own calendar day, and a reminder for a cancelled/inactive booking or a guest
// who declined is SKIPPED with a reason, never sent or FAILED. All times are
// server-local, like the engine's; Prisma and the providers are mocked.
// ============================================================

const db = vi.hoisted(() => ({
  guestReminder: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  reminderTemplate: { findUnique: vi.fn() },
}));
const sendWhatsApp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp }));
vi.mock("@/lib/integrations/sms", () => ({ sendSms: vi.fn(), isSmsConfigured: () => false }));

import { processDueReminders, reminderSkipReason, scheduleReminders } from "./reminder-engine";

const EVENT_DAY = new Date(2026, 9, 20); // 20 Oct 2026, local midnight
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min);

/** The upper bound the daily run (02:00 local) uses on `day`. */
async function dueBoundOn(day: Date): Promise<Date> {
  vi.setSystemTime(at(day.getFullYear(), day.getMonth(), day.getDate(), 2, 0));
  db.guestReminder.findMany.mockResolvedValue([]);
  await processDueReminders();
  return db.guestReminder.findMany.mock.lastCall![0].where.scheduledFor.lte;
}

function dueReminder(over: { stage?: string; bookingStatus?: string; rsvpStatus?: string; date?: Date } = {}) {
  return {
    id: "r1",
    stage: over.stage ?? "TOMORROW_REMINDER",
    status: "REMINDER_PENDING",
    bookingId: "b1",
    guestId: "g1",
    guest: { id: "g1", name: "Asha", phone: "+91 98450 12345", rsvpStatus: over.rsvpStatus ?? "ACCEPTED" },
    booking: {
      id: "b1",
      status: over.bookingStatus ?? "CONFIRMED",
      date: over.date ?? EVENT_DAY,
      eventName: "Reception",
      startTime: null,
      venue: { name: "Veloria Grand" },
      contact: { firstName: "Priya", lastName: "Rao" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  db.guestReminder.upsert.mockResolvedValue({});
  db.guestReminder.update.mockResolvedValue({});
  db.reminderTemplate.findUnique.mockResolvedValue(null);
  sendWhatsApp.mockResolvedValue({ success: true, messageId: "wamid.1" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("guest journey timing", () => {
  it("sends every stage on its own calendar day, not the day after", async () => {
    vi.setSystemTime(at(2026, 8, 1, 12));
    await scheduleReminders("g1", "b1", EVENT_DAY);
    const scheduledFor = Object.fromEntries(
      db.guestReminder.upsert.mock.calls.map(([args]) => [args.create.stage, args.create.scheduledFor as Date])
    );

    const intendedDay: Record<string, Date> = {
      SAVE_THE_DATE: at(2026, 8, 20),
      EXCITEMENT_BUILDER: at(2026, 9, 13),
      FINAL_COUNTDOWN: at(2026, 9, 17),
      TOMORROW_REMINDER: at(2026, 9, 19),
      DAY_OF_WELCOME: at(2026, 9, 20),
    };
    for (const [stage, day] of Object.entries(intendedDay)) {
      const dayBefore = at(day.getFullYear(), day.getMonth(), day.getDate() - 1);
      expect(scheduledFor[stage] <= (await dueBoundOn(day)), `${stage} due on its day`).toBe(true);
      expect(scheduledFor[stage] > (await dueBoundOn(dayBefore)), `${stage} not the day before`).toBe(true);
    }
  });

  it("sends the tomorrow reminder from the 02:00 run on the day before the event", async () => {
    vi.setSystemTime(at(2026, 9, 19, 2, 0));
    db.guestReminder.findMany.mockResolvedValue([{ id: "r1" }]);
    db.guestReminder.findUnique.mockResolvedValue(dueReminder());

    await expect(processDueReminders()).resolves.toEqual({ processed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ template: "tomorrow_reminder" }));
    expect(db.guestReminder.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({ status: "REMINDER_SENT", failReason: null }),
    });
  });

  it("counts days to go in calendar days, whatever the hour of the run or of the stored date", async () => {
    // A @db.Date read on an IST server is 05:30 local; the run is at 02:00.
    vi.setSystemTime(at(2026, 9, 13, 2, 0));
    db.guestReminder.findMany.mockResolvedValue([{ id: "r1" }]);
    db.guestReminder.findUnique.mockResolvedValue(dueReminder({ stage: "EXCITEMENT_BUILDER", date: at(2026, 9, 20, 5, 30) }));

    await processDueReminders();
    expect(sendWhatsApp.mock.calls[0][0].message).toContain("Just 7 days to go!");
  });
});

describe("reminders that must not go out", () => {
  it.each([
    { bookingStatus: "CANCELLED", rsvpStatus: "ACCEPTED", reason: "Booking cancelled" },
    { bookingStatus: "COMPLETED", rsvpStatus: "ACCEPTED", reason: "Booking not active (COMPLETED)" },
    { bookingStatus: "HOLD", rsvpStatus: "PENDING", reason: "Booking not active (HOLD)" },
    { bookingStatus: "CONFIRMED", rsvpStatus: "DECLINED", reason: "Guest declined the invitation" },
  ])("marks $bookingStatus / $rsvpStatus as SKIPPED: $reason", async ({ bookingStatus, rsvpStatus, reason }) => {
    vi.setSystemTime(at(2026, 9, 19, 2, 0));
    db.guestReminder.findMany.mockResolvedValue([{ id: "r1" }]);
    db.guestReminder.findUnique.mockResolvedValue(dueReminder({ bookingStatus, rsvpStatus }));

    await expect(processDueReminders()).resolves.toEqual({ processed: 1, sent: 0, failed: 0, skipped: 1 });
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(db.guestReminder.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "REMINDER_SKIPPED", failReason: reason },
    });
  });

  it("still sends for a tentative booking and a guest who has not answered yet", () => {
    expect(reminderSkipReason("TENTATIVE", "PENDING")).toBeNull();
    expect(reminderSkipReason("IN_PROGRESS", "ACCEPTED")).toBeNull();
  });
});
