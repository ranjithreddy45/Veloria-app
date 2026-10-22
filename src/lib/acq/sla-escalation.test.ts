import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// The BD SLA alerts must fire ONCE per breach. These tests run each sweep
// against an in-memory table whose updateMany honours the same guard Postgres
// would (only unstamped rows match), and prove that a second run — the next
// hour, a second scheduler, or the fast lane overlapping the hourly one —
// sends nothing.
// ============================================================

type Lead = {
  id: string;
  propertyName: string;
  locality: string;
  bdExecutiveId: string;
  status: string;
  slaEscalatedAt: Date | null;
  nextFollowupAt: Date | null;
  followupNotifiedFor: Date | null;
};
type Project = { id: string; slaEscalatedAt: Date | null; property: { id: string; propertyName: string; locality: string } };
type Deal = { id: string; name: string; bdExecutiveId: string; reengageAt: Date | null };

const db = vi.hoisted(() => ({
  leads: [] as Lead[],
  projects: [] as Project[],
  deals: [] as Deal[],
  users: [] as { id: string }[],
}));
const notifyAwait = vi.hoisted(() => vi.fn(async () => {}));

const sameTime = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

vi.mock("@/lib/notify", () => ({ notifyAwait }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn(async () => db.users) },
    acqLead: {
      findMany: vi.fn(async ({ where }: { where: { status: string; slaEscalatedAt?: null } }) =>
        db.leads.filter(
          (l) => l.status === where.status && (!("slaEscalatedAt" in where) || l.slaEscalatedAt === null),
        ),
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Lead> }) => {
        const row = db.leads.find((l) => l.id === where.id);
        if (!row) return { count: 0 };
        if ("slaEscalatedAt" in where && row.slaEscalatedAt !== null) return { count: 0 };
        if ("nextFollowupAt" in where) {
          if (!sameTime(row.nextFollowupAt, where.nextFollowupAt as Date)) return { count: 0 };
          if (sameTime(row.followupNotifiedFor, row.nextFollowupAt)) return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    acqOnboardingProject: {
      findMany: vi.fn(async () => db.projects.filter((p) => p.slaEscalatedAt === null)),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Project> }) => {
        const row = db.projects.find((p) => p.id === where.id);
        if (!row || row.slaEscalatedAt !== null) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    acqDeal: {
      findMany: vi.fn(async () => db.deals.filter((d) => d.reengageAt !== null)),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Deal> }) => {
        const row = db.deals.find((d) => d.id === where.id);
        if (!row || row.reengageAt === null) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
  },
}));

import {
  escalateAcqLeadSlaBreaches,
  notifyAcqFollowupsDue,
  escalateAcqOnboardingBreaches,
  notifyAcqReengagements,
} from "./sla-escalation";

function lead(id: string, over: Partial<Lead> = {}): Lead {
  return {
    id,
    propertyName: `Hall ${id}`,
    locality: "Kondapur",
    bdExecutiveId: "exec",
    status: "NEW",
    slaEscalatedAt: null,
    nextFollowupAt: null,
    followupNotifiedFor: null,
    ...over,
  };
}

beforeEach(() => {
  db.leads = [];
  db.projects = [];
  db.deals = [];
  db.users = [{ id: "head1" }, { id: "head2" }, { id: "exec" }];
  notifyAwait.mockClear();
});

describe("first-contact SLA breach", () => {
  it("alerts the owner + every other head once, then never again", async () => {
    db.leads = [lead("a"), lead("b")];
    const first = await escalateAcqLeadSlaBreaches();
    expect(first.escalated).toBe(2);
    // per lead: the exec + 2 heads (the exec is skipped as a head)
    expect(notifyAwait).toHaveBeenCalledTimes(6);

    notifyAwait.mockClear();
    const second = await escalateAcqLeadSlaBreaches();
    expect(second.escalated).toBe(0);
    expect(notifyAwait).not.toHaveBeenCalled();
  });

  it("two overlapping runs alert once (claim before send)", async () => {
    db.leads = [lead("a")];
    const [x, y] = await Promise.all([escalateAcqLeadSlaBreaches(), escalateAcqLeadSlaBreaches()]);
    expect(x.escalated + y.escalated).toBe(1);
    expect(notifyAwait).toHaveBeenCalledTimes(3);
  });

  it("a lead stamped by the other lane is not alerted again", async () => {
    db.leads = [lead("a", { slaEscalatedAt: new Date("2026-10-16T10:25:00Z") })];
    expect((await escalateAcqLeadSlaBreaches()).escalated).toBe(0);
    expect(notifyAwait).not.toHaveBeenCalled();
  });
});

describe("follow-up due", () => {
  const due = new Date("2026-10-19T09:00:00Z");
  const now = new Date("2026-10-20T06:00:00Z");

  it("alerts once per scheduled follow-up", async () => {
    db.leads = [lead("a", { status: "CONTACTED", nextFollowupAt: due })];
    expect(await notifyAcqFollowupsDue(now)).toBe(1);
    expect(await notifyAcqFollowupsDue(now)).toBe(0);
    expect(notifyAwait).toHaveBeenCalledTimes(1);
  });

  it("re-arms when the follow-up is rescheduled", async () => {
    db.leads = [lead("a", { status: "CONTACTED", nextFollowupAt: due })];
    await notifyAcqFollowupsDue(now);
    db.leads[0].nextFollowupAt = new Date("2026-10-20T05:00:00Z");
    expect(await notifyAcqFollowupsDue(now)).toBe(1);
    expect(notifyAwait).toHaveBeenCalledTimes(2);
  });
});

describe("onboarding SLA breach", () => {
  it("alerts ops once per project", async () => {
    db.projects = [{ id: "p1", slaEscalatedAt: null, property: { id: "pr1", propertyName: "Hall", locality: "Gachibowli" } }];
    expect(await escalateAcqOnboardingBreaches(30)).toBe(1);
    expect(notifyAwait).toHaveBeenCalledTimes(db.users.length);
    notifyAwait.mockClear();
    expect(await escalateAcqOnboardingBreaches(30)).toBe(0);
    expect(notifyAwait).not.toHaveBeenCalled();
  });
});

describe("re-engagement due", () => {
  it("clearing reengageAt is the claim — one alert, even with overlapping runs", async () => {
    db.deals = [{ id: "d1", name: "Lost Hall", bdExecutiveId: "exec", reengageAt: new Date("2026-10-01T00:00:00Z") }];
    const [x, y] = await Promise.all([notifyAcqReengagements(), notifyAcqReengagements()]);
    expect(x + y).toBe(1);
    expect(notifyAwait).toHaveBeenCalledTimes(1);
    expect(db.deals[0].reengageAt).toBeNull();
  });
});
