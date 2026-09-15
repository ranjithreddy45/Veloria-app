import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// The fast lane runs the lapsed-hold release as one more isolated step: a
// failure in it (or in any other job) must not stop the rest, and must surface
// as a 500 so the lane orchestrator alerts.
// ============================================================

const jobs = vi.hoisted(() => ({
  processDueCadenceSteps: vi.fn(),
  processCadenceExits: vi.fn(),
  escalateLeadSlaBreaches: vi.fn(),
  escalateOverdueTasks: vi.fn(),
  escalateAcqLeadSlaBreaches: vi.fn(),
  runSlaWarRoomEscalation: vi.fn(),
  sendEventDayTaskReminders: vi.fn(),
  releaseLapsedHolds: vi.fn(),
}));

vi.mock("@/lib/cadence-executor", () => ({ processDueCadenceSteps: jobs.processDueCadenceSteps }));
vi.mock("@/lib/lead-pipeline", () => ({
  processCadenceExits: jobs.processCadenceExits,
  escalateLeadSlaBreaches: jobs.escalateLeadSlaBreaches,
  escalateOverdueTasks: jobs.escalateOverdueTasks,
}));
vi.mock("@/lib/acq/sla-escalation", () => ({ escalateAcqLeadSlaBreaches: jobs.escalateAcqLeadSlaBreaches }));
vi.mock("@/lib/sla/war-room-escalation", () => ({ runSlaWarRoomEscalation: jobs.runSlaWarRoomEscalation }));
vi.mock("@/lib/ops/event-reminders", () => ({ sendEventDayTaskReminders: jobs.sendEventDayTaskReminders }));
vi.mock("@/lib/holds/release-lapsed-holds", () => ({ releaseLapsedHolds: jobs.releaseLapsedHolds }));
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}));

import { GET } from "./route";

const SECRET = "fast-lane-test-secret";
const sweep = { scanned: 2, released: 1, skippedWithMoney: 1, disagreements: 0, publicHoldsExpired: 1 };

type Res = { status: number; body: { success: boolean; results: Record<string, unknown> } };
async function run(authorization = `Bearer ${SECRET}`): Promise<Res> {
  const res = await GET(new Request("http://localhost/api/cron/fast", { headers: { authorization } }));
  return res as unknown as Res;
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  for (const fn of Object.values(jobs)) {
    fn.mockReset();
    fn.mockResolvedValue({ ok: true });
  }
  jobs.releaseLapsedHolds.mockResolvedValue(sweep);
});

describe("fast cron lane", () => {
  it("refuses a caller without the cron secret", async () => {
    const res = await run("Bearer nope");
    expect(res.status).toBe(401);
    expect(jobs.releaseLapsedHolds).not.toHaveBeenCalled();
  });

  it("releases lapsed holds alongside the other jobs", async () => {
    const res = await run();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(jobs.releaseLapsedHolds).toHaveBeenCalledTimes(1);
    expect(res.body.results.lapsedHoldRelease).toEqual(sweep);
  });

  it("a failing release is isolated: every other job still runs, and the lane sees a 500", async () => {
    jobs.releaseLapsedHolds.mockRejectedValueOnce(new Error("database unavailable"));

    const res = await run();

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.results.lapsedHoldRelease).toBe("error: database unavailable");
    for (const [name, fn] of Object.entries(jobs)) {
      expect(fn, name).toHaveBeenCalledTimes(1);
    }
    expect(res.body.results.eventTaskReminders).toEqual({ ok: true });
  });

  it("an earlier job failing does not stop the release", async () => {
    jobs.processDueCadenceSteps.mockRejectedValueOnce(new Error("cadence broke"));

    const res = await run();

    expect(res.status).toBe(500);
    expect(jobs.releaseLapsedHolds).toHaveBeenCalledTimes(1);
    expect(res.body.results.lapsedHoldRelease).toEqual(sweep);
  });
});
