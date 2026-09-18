import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as L from "./status-labels";

// Every status value the team can store must have customer wording, so a
// customer never reads a raw enum. Values come straight from schema.prisma.
const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

function block(kind: "enum" | "model", name: string): string {
  const m = new RegExp(`^${kind} ${name} \\{([\\s\\S]*?)^\\}`, "m").exec(schema);
  if (!m) throw new Error(`${kind} ${name} not found in prisma/schema.prisma`);
  return m[1];
}

const isValue = (s: string) => /^[A-Z][A-Z0-9_]*$/.test(s);

function enumValues(name: string): string[] {
  return block("enum", name)
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(isValue);
}

/** Values documented on a String column, e.g. `status String @default("OPEN") // OPEN | CLOSED`. */
function documentedValues(model: string, field: string): string[] {
  const line = block("model", model)
    .split("\n")
    .find((l) => new RegExp(`^\\s*${field}\\s`).test(l));
  const comment = line?.split("//")[1] ?? "";
  return comment
    .split("|")
    .map((s) => s.trim())
    .filter(isValue);
}

describe("customer wording covers every stored status", () => {
  const enums: [string, Record<string, string>][] = [
    ["BookingStatus", L.BOOKING_STATUS_LABEL],
    ["RSVPStatus", L.RSVP_STATUS_LABEL],
    ["InvoiceStatus", L.INVOICE_STATUS_LABEL],
    ["PaymentStatus", L.PAYMENT_STATUS_LABEL],
    ["PaymentStatus", L.INSTALLMENT_STATUS_LABEL],
    ["SiteVisitStatus", L.SITE_VISIT_STATUS_LABEL],
    ["PublicHoldStatus", L.PUBLIC_HOLD_STATUS_LABEL],
    ["TimelineItemStatus", L.TIMELINE_ITEM_STATUS_LABEL],
    ["ExecutionTaskStatus", L.EXECUTION_TASK_STATUS_LABEL],
    ["TaskStatus", L.TASK_STATUS_LABEL],
  ];

  it.each(enums)("enum %s", (name, map) => {
    const values = enumValues(name);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(map[v], `${name}.${v}`).toBeTruthy();
  });

  const columns: [string, string, Record<string, string>][] = [
    ["BookingCollaborator", "status", L.COLLABORATOR_STATUS_LABEL],
    ["BookingCollaborator", "role", L.COLLABORATOR_ROLE_LABEL],
    ["ConciergeThread", "status", L.CONCIERGE_THREAD_STATUS_LABEL],
    ["MenuSelectionRequest", "status", L.CUSTOMER_REQUEST_STATUS_LABEL],
  ];

  it.each(columns)("%s.%s", (model, field, map) => {
    const values = documentedValues(model, field);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(map[v], `${model}.${field} ${v}`).toBeTruthy();
  });
});

describe("customerLabel", () => {
  it("uses the mapped wording", () => {
    expect(L.customerLabel(L.INVOICE_STATUS_LABEL, "PARTIALLY_PAID")).toBe("Partly paid");
    expect(L.customerLabel(L.BOOKING_STATUS_LABEL, "HOLD")).toBe("Date on hold");
  });

  it("turns an unmapped value into words instead of showing the raw enum", () => {
    expect(L.customerLabel(L.INVOICE_STATUS_LABEL, "WRITTEN_OFF")).toBe("Written off");
  });

  it("is empty when there is no status", () => {
    expect(L.customerLabel(L.INVOICE_STATUS_LABEL, null)).toBe("");
    expect(L.customerLabel(L.INVOICE_STATUS_LABEL, undefined)).toBe("");
  });

  it("never calls a held date secured or confirmed before the token is paid", () => {
    expect(L.PUBLIC_HOLD_STATUS_LABEL.INITIATED).not.toMatch(/secur|confirm/i);
    expect(L.PUBLIC_HOLD_STATUS_LABEL.SLOT_CLAIMED).not.toMatch(/secur|confirm/i);
  });
});
