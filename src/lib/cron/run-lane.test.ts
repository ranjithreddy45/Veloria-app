import { describe, it, expect, vi, beforeEach } from "vitest";

// The lane talks to the database only for its heartbeat, and to the network for
// the jobs. Both are stubbed so this tests the SCHEDULING, which is the part
// that was wrong.
const created: unknown[] = [];
const updated: unknown[] = [];
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cronRunLog: {
      create: vi.fn(async (args: { data: unknown }) => {
        created.push(args.data);
        return { id: "run_1" };
      }),
      update: vi.fn(async (args: { data: unknown }) => {
        updated.push(args.data);
        return {};
      }),
    },
  },
}));
vi.mock("@/lib/ops-alert", () => ({ reportSystemFailure: vi.fn(async () => {}) }));

import { runCronLane } from "./run-lane";

let order: string[] = [];
let inFlight = 0;
let peak = 0;

beforeEach(() => {
  order = [];
  inFlight = 0;
  peak = 0;
  created.length = 0;
  updated.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const job = String(url).split("/api/cron/")[1];
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      order.push(job);
      inFlight--;
      return { ok: true } as Response;
    })
  );
});

describe("runCronLane", () => {
  it("runs every job exactly once", async () => {
    const jobs = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const res = await runCronLane("daily", jobs, "Bearer x");
    expect(order.sort()).toEqual(jobs);
    expect(res.total).toBe(8);
    expect(res.status).toBe("SUCCESS");
  });

  it("runs concurrently — this is the whole fix", async () => {
    // The old lane was strictly sequential: 41 jobs x ~7s blew the 300s
    // maxDuration, the function was killed, and the lane reported NEVER_RUN
    // for the life of the deployment.
    await runCronLane("daily", Array.from({ length: 20 }, (_, i) => `j${i}`), "Bearer x");
    expect(peak).toBeGreaterThan(1);
  });

  it("keeps a declared chain in order", async () => {
    // public-hold-expiry documents that it must run AFTER hold-expiry.
    await runCronLane(
      "daily",
      [["hold-expiry", "public-hold-expiry"], "other-1", "other-2"],
      "Bearer x"
    );
    expect(order.indexOf("hold-expiry")).toBeLessThan(order.indexOf("public-hold-expiry"));
  });

  it("writes the heartbeat BEFORE running, then resolves it", async () => {
    // The old code wrote the row only at the very end, so a killed invocation
    // left no trace at all — which is exactly how a lane that never ran looked
    // identical to a lane that was never scheduled.
    await runCronLane("daily", ["a", "b"], "Bearer x");
    expect(created).toHaveLength(1);
    expect((created[0] as { status: string }).status).toBe("RUNNING");
    expect(updated).toHaveLength(1);
    expect((updated[0] as { status: string }).status).toBe("SUCCESS");
  });

  it("one failing job does not stop the rest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const job = String(url).split("/api/cron/")[1];
        order.push(job);
        return { ok: job !== "bad" } as Response;
      })
    );
    const res = await runCronLane("daily", ["a", "bad", "c"], "Bearer x");
    expect(order.sort()).toEqual(["a", "bad", "c"]);
    expect(res.status).toBe("PARTIAL");
    expect(res.failed).toBe(1);
  });
});
