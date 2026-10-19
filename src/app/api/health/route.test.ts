import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { cronRunLog: { findFirst: vi.fn(async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:5432 user=veloria"); }) } },
}));

import { GET } from "./route";

describe("health endpoint (R1-7)", () => {
  it("returns a generic message, never the raw error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(503);
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|veloria/);
    expect(body).toContain("Service unavailable");
    expect(spy).toHaveBeenCalled(); // detail kept in the server log
    spy.mockRestore();
  });
});
