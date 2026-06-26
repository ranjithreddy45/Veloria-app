// Unit tests for the event-ops state machine — the central transition contract
// every sub-module now routes through. Pure function, no DB.
import { describe, it, expect } from "vitest";
import { assertTransition, OPS_TRANSITIONS } from "./state-machine";

describe("assertTransition", () => {
  it("allows legal forward transitions", () => {
    expect(assertTransition("kitchen", "PLANNED", "IN_PROGRESS").ok).toBe(true);
    expect(assertTransition("procurement", "PENDING", "APPROVED").ok).toBe(true);
    expect(assertTransition("procurement", "APPROVED", "ORDERED").ok).toBe(true);
    expect(assertTransition("operation", "PLANNING", "READY").ok).toBe(true);
    expect(assertTransition("vendorAssignment", "NOTIFIED", "CONFIRMED").ok).toBe(true);
    expect(assertTransition("beo", "DRAFT", "PUBLISHED").ok).toBe(true);
    expect(assertTransition("dispatch", "PLANNED", "DISPATCHED").ok).toBe(true);
  });

  it("rejects illegal jumps and reports allowed targets", () => {
    // The bug this whole machine exists to prevent: COMPLETED back to PLANNED.
    const k = assertTransition("kitchen", "COMPLETED", "PLANNED");
    expect(k.ok).toBe(false);
    expect(k.error).toContain("terminal");

    const p = assertTransition("procurement", "PENDING", "RECEIVED"); // skips APPROVED/ORDERED
    expect(p.ok).toBe(false);
    expect(p.error).toContain("APPROVED");

    expect(assertTransition("operation", "PLANNING", "LIVE").ok).toBe(false); // must pass READY
    expect(assertTransition("dispatch", "DELIVERED", "PLANNED").ok).toBe(false);
  });

  it("treats same-state as a no-op success (idempotent re-writes)", () => {
    expect(assertTransition("support", "OPEN", "OPEN").ok).toBe(true);
    expect(assertTransition("vendorAssignment", "CONFIRMED", "CONFIRMED").ok).toBe(true);
  });

  it("rejects an unknown source state", () => {
    const r = assertTransition("beo", "BOGUS", "PUBLISHED");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Unknown");
  });

  it("allows support tickets to reopen (superset of the prior local table)", () => {
    expect(assertTransition("support", "RESOLVED", "OPEN").ok).toBe(true);
    expect(assertTransition("support", "CLOSED", "IN_PROGRESS").ok).toBe(true);
    expect(assertTransition("support", "IN_PROGRESS", "OPEN").ok).toBe(true);
  });

  it("every declared target is itself a known state (no dangling transitions)", () => {
    for (const [entity, map] of Object.entries(OPS_TRANSITIONS)) {
      const states = new Set(Object.keys(map));
      for (const [from, targets] of Object.entries(map)) {
        for (const to of targets) {
          expect(states.has(to), `${entity}: ${from}->${to} targets an undeclared state`).toBe(true);
        }
      }
    }
  });
});
