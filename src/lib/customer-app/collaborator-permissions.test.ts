import { describe, it, expect } from "vitest";
import {
  BOOKING_ACTIONS,
  COLLABORATOR_ROLES,
  COLLABORATOR_VIEW_ACTIONS,
  CO_HOST_ACTIONS,
  OWNER_ONLY_ACTIONS,
  bookingAccessActions,
  canCollaborator,
  canDo,
  collaboratorActions,
  hostScopeCan,
  isCollaboratorRole,
  isCollaboratorStatus,
  type BookingAction,
} from "./collaborator-permissions";

// The matrix as agreed, restated literally so a change to the module has to change this too.
const VIEWS: BookingAction[] = ["event:view", "runOfShow:view", "checklist:view", "guests:view", "live:view"];
const CO_HOST_WRITES: BookingAction[] = ["guests:manage", "todos:manage", "concierge:message"];
const NEVER_FOR_COLLABORATORS: BookingAction[] = [
  "payments:view",
  "invoices:view",
  "receipts:view",
  "documents:view",
  "contracts:view",
  "quotations:view",
  "packages:request",
  "menu:request",
  "holds:place",
  "reviews:submit",
  "rewards:use",
  "collaborators:view",
  "collaborators:manage",
];

describe("the co-host permission matrix", () => {
  it("every action belongs to exactly one group", () => {
    const all = [...COLLABORATOR_VIEW_ACTIONS, ...CO_HOST_ACTIONS, ...OWNER_ONLY_ACTIONS];
    expect(new Set(all).size).toBe(all.length);
    expect([...BOOKING_ACTIONS].sort()).toEqual([...all].sort());
    expect([...BOOKING_ACTIONS].sort()).toEqual([...VIEWS, ...CO_HOST_WRITES, ...NEVER_FOR_COLLABORATORS].sort());
  });

  it("a CO_HOST views the event, run of show, checklist, guest list and live screen", () => {
    for (const a of VIEWS) expect(canCollaborator("CO_HOST", a)).toBe(true);
  });

  it("a CO_HOST manages the guest list, their own to-dos and concierge messages", () => {
    for (const a of CO_HOST_WRITES) expect(canCollaborator("CO_HOST", a)).toBe(true);
  });

  it("a VIEWER views those same screens and changes nothing", () => {
    for (const a of VIEWS) expect(canCollaborator("VIEWER", a)).toBe(true);
    for (const a of CO_HOST_WRITES) expect(canCollaborator("VIEWER", a)).toBe(false);
  });

  it("collaborators never see money or documents, request, hold, review, use rewards, or touch co-hosts", () => {
    for (const role of COLLABORATOR_ROLES) {
      for (const a of NEVER_FOR_COLLABORATORS) expect(canCollaborator(role, a)).toBe(false);
    }
  });

  it("only the booking's own customer can invite or revoke co-hosts", () => {
    expect(canDo(bookingAccessActions({ kind: "OWNER" }), "collaborators:manage")).toBe(true);
    expect(canDo(bookingAccessActions({ kind: "PREVIEW" }), "collaborators:manage")).toBe(false);
    for (const role of COLLABORATOR_ROLES) {
      expect(canDo(bookingAccessActions({ kind: "COLLABORATOR", role, status: "ACTIVE" }), "collaborators:manage")).toBe(false);
    }
  });

  it("unknown, missing or differently-cased roles get nothing", () => {
    for (const role of ["OWNER", "co_host", "Viewer", "", null, undefined]) {
      for (const a of BOOKING_ACTIONS) expect(canCollaborator(role, a)).toBe(false);
    }
  });
});

describe("collaboratorActions — only an ACTIVE row grants anything", () => {
  it("ACTIVE rows get exactly their role's actions", () => {
    expect(collaboratorActions("CO_HOST", "ACTIVE").sort()).toEqual([...VIEWS, ...CO_HOST_WRITES].sort());
    expect(collaboratorActions("VIEWER", "ACTIVE").sort()).toEqual([...VIEWS].sort());
  });

  it("INVITED and REVOKED rows grant nothing, whatever the role", () => {
    for (const role of COLLABORATOR_ROLES) {
      for (const status of ["INVITED", "REVOKED", "active", "", null, undefined]) {
        expect(collaboratorActions(role, status)).toEqual([]);
      }
    }
  });

  it("hands back a fresh array, so one caller cannot widen another's rights", () => {
    const first = collaboratorActions("VIEWER", "ACTIVE");
    first.push("guests:manage");
    expect(collaboratorActions("VIEWER", "ACTIVE")).not.toContain("guests:manage");
  });
});

describe("bookingAccessActions — host, collaborator and team preview on one scale", () => {
  it("the booking's own customer can do everything", () => {
    expect(bookingAccessActions({ kind: "OWNER" }).sort()).toEqual([...BOOKING_ACTIONS].sort());
  });

  it("rights nest: viewer ⊂ co-host ⊂ own customer", () => {
    const viewer = bookingAccessActions({ kind: "COLLABORATOR", role: "VIEWER", status: "ACTIVE" });
    const coHost = bookingAccessActions({ kind: "COLLABORATOR", role: "CO_HOST", status: "ACTIVE" });
    const owner = bookingAccessActions({ kind: "OWNER" });
    expect(viewer.every((a) => coHost.includes(a))).toBe(true);
    expect(coHost.every((a) => owner.includes(a))).toBe(true);
    expect(coHost.length).toBeGreaterThan(viewer.length);
    expect(owner.length).toBeGreaterThan(coHost.length);
  });

  it("a team preview can view everything the host sees and change nothing", () => {
    const actions = bookingAccessActions({ kind: "PREVIEW" });
    expect(actions).toContain("payments:view");
    expect(actions).toContain("collaborators:view");
    expect(actions.every((a) => a.endsWith(":view"))).toBe(true);
    expect(actions).toHaveLength(BOOKING_ACTIONS.filter((a) => a.endsWith(":view")).length);
  });

  it("no access grants nothing", () => {
    expect(bookingAccessActions(null)).toEqual([]);
    expect(bookingAccessActions(undefined)).toEqual([]);
  });
});

describe("hostScopeCan — the rule over a getHostScope() result", () => {
  const scope = {
    preview: false,
    booking: { id: "own" },
    bookings: [{ id: "own" }, { id: "cohost" }, { id: "viewer" }],
    collaboratorRoles: { cohost: "CO_HOST", viewer: "VIEWER" },
  };

  it("a booking absent from collaboratorRoles is the customer's own", () => {
    expect(hostScopeCan(scope, "own", "payments:view")).toBe(true);
    expect(hostScopeCan(scope, "own", "collaborators:manage")).toBe(true);
  });

  it("a shared booking follows the role", () => {
    expect(hostScopeCan(scope, "cohost", "guests:manage")).toBe(true);
    expect(hostScopeCan(scope, "cohost", "payments:view")).toBe(false);
    expect(hostScopeCan(scope, "viewer", "guests:view")).toBe(true);
    expect(hostScopeCan(scope, "viewer", "todos:manage")).toBe(false);
  });

  it("a booking outside the scope, or no scope, allows nothing", () => {
    expect(hostScopeCan(scope, "someone-else", "event:view")).toBe(false);
    expect(hostScopeCan(null, "own", "event:view")).toBe(false);
    expect(hostScopeCan(scope, "", "event:view")).toBe(false);
  });

  it("a team preview only views", () => {
    const preview = { preview: true, booking: { id: "b1" }, bookings: [], collaboratorRoles: {} };
    expect(hostScopeCan(preview, "b1", "guests:view")).toBe(true);
    expect(hostScopeCan(preview, "b1", "guests:manage")).toBe(false);
    expect(hostScopeCan(preview, "b1", "concierge:message")).toBe(false);
  });
});

describe("guards", () => {
  it("recognises only the exact role and status values the schema stores", () => {
    expect(isCollaboratorRole("CO_HOST")).toBe(true);
    expect(isCollaboratorRole("VIEWER")).toBe(true);
    expect(isCollaboratorRole("viewer")).toBe(false);
    expect(isCollaboratorRole(undefined)).toBe(false);
    expect(isCollaboratorStatus("ACTIVE")).toBe(true);
    expect(isCollaboratorStatus("PENDING")).toBe(false);
  });

  it("canDo answers from an actions list", () => {
    expect(canDo(["guests:view"], "guests:view")).toBe(true);
    expect(canDo(["guests:view"], "guests:manage")).toBe(false);
    expect(canDo(null, "guests:view")).toBe(false);
  });
});
