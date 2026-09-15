import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import {
  CUSTOMER_NOTIFICATION_KEYS,
  NOTIFICATION_CATALOG,
  NOTIFICATION_PREFERENCES_ENFORCED,
  customerNotificationRows,
  parseNotificationPreferences,
  resolveNotificationPreferences,
  serializeNotificationPreferences,
} from "./notification-preferences";

const SRC = fileURLToPath(new URL("../../../../../", import.meta.url));
const TEAM_FILE = join(SRC, "actions", "notification-settings.actions.ts");

function defaults(key: string) {
  const row = NOTIFICATION_CATALOG.find((p) => p.key === key);
  if (!row) throw new Error(`no catalog row for ${key}`);
  return row;
}

describe("parseNotificationPreferences: the team parser's acceptance rule", () => {
  it("treats nothing stored as 'use the defaults'", () => {
    expect(parseNotificationPreferences(null)).toBeNull();
    expect(parseNotificationPreferences(undefined)).toBeNull();
  });

  it("rejects a value that is not an array", () => {
    expect(parseNotificationPreferences({ key: "payment_due", emailEnabled: true, smsEnabled: true })).toBeNull();
    expect(parseNotificationPreferences("[]")).toBeNull();
  });

  it("accepts an empty array", () => {
    expect(parseNotificationPreferences([])).toEqual([]);
  });

  it("accepts well-formed rows and drops extra fields such as the label", () => {
    const stored = [{ key: "payment_due", label: "Payment Due", emailEnabled: false, smsEnabled: true }];
    expect(parseNotificationPreferences(stored)).toEqual([{ key: "payment_due", emailEnabled: false, smsEnabled: true }]);
  });

  it("rejects the whole value when a single row is malformed, as shouldSendNotification() would", () => {
    const stored = [
      { key: "payment_due", emailEnabled: false, smsEnabled: true },
      { key: "event_reminder", emailEnabled: "no", smsEnabled: true },
    ];
    expect(parseNotificationPreferences(stored)).toBeNull();
  });
});

describe("resolveNotificationPreferences: defaults with stored choices on top", () => {
  it("gives the full catalog of defaults when nothing is stored", () => {
    expect(resolveNotificationPreferences(null)).toEqual(NOTIFICATION_CATALOG);
  });

  it("applies a stored choice and keeps defaults for the rest", () => {
    const resolved = resolveNotificationPreferences([{ key: "event_reminder", emailEnabled: false, smsEnabled: false }]);
    expect(resolved.find((p) => p.key === "event_reminder")).toEqual({ key: "event_reminder", emailEnabled: false, smsEnabled: false });
    expect(resolved.find((p) => p.key === "payment_due")).toEqual(defaults("payment_due"));
  });

  it("drops keys that are not in the catalog", () => {
    const resolved = resolveNotificationPreferences([{ key: "retired_event", emailEnabled: false, smsEnabled: false }]);
    expect(resolved.map((p) => p.key)).toEqual(NOTIFICATION_CATALOG.map((p) => p.key));
  });

  it("falls back to defaults when the stored value is malformed", () => {
    expect(resolveNotificationPreferences([{ key: 1 }])).toEqual(NOTIFICATION_CATALOG);
  });
});

describe("customerNotificationRows", () => {
  it("never offers the team-only rows", () => {
    const keys = customerNotificationRows(null).map((r) => r.key as string);
    expect(keys).not.toContain("task_assigned");
    expect(keys).not.toContain("lead_assigned");
    expect(keys).toEqual([...CUSTOMER_NOTIFICATION_KEYS]);
  });

  it("carries customer wording and the stored values", () => {
    const rows = customerNotificationRows([{ key: "payment_due", emailEnabled: false, smsEnabled: false }]);
    const due = rows.find((r) => r.key === "payment_due");
    expect(due).toMatchObject({ emailEnabled: false, smsEnabled: false, label: "Payment reminders" });
  });
});

describe("serializeNotificationPreferences", () => {
  it("writes the full catalog with the customer's change applied", () => {
    const next = serializeNotificationPreferences(null, [{ key: "event_reminder", emailEnabled: true, smsEnabled: false }]);
    expect(next.map((p) => p.key)).toEqual(NOTIFICATION_CATALOG.map((p) => p.key));
    expect(next.find((p) => p.key === "event_reminder")).toEqual({ key: "event_reminder", emailEnabled: true, smsEnabled: false });
    expect(next.find((p) => p.key === "booking_confirmed")).toEqual(defaults("booking_confirmed"));
  });

  it("keeps what a team member set on team-only rows", () => {
    const current = [{ key: "task_assigned", emailEnabled: false, smsEnabled: false }];
    const next = serializeNotificationPreferences(current, [{ key: "payment_due", emailEnabled: false, smsEnabled: true }]);
    expect(next.find((p) => p.key === "task_assigned")).toEqual({ key: "task_assigned", emailEnabled: false, smsEnabled: false });
  });

  it("ignores attempts to change team-only or unknown rows", () => {
    const next = serializeNotificationPreferences(null, [
      { key: "lead_assigned", emailEnabled: false, smsEnabled: true },
      { key: "made_up", emailEnabled: false, smsEnabled: false },
    ]);
    expect(next).toEqual(NOTIFICATION_CATALOG);
  });

  it("ignores values that are not booleans", () => {
    const bad = [{ key: "payment_due", emailEnabled: "false", smsEnabled: 0 }] as unknown as { key: string; emailEnabled: boolean; smsEnabled: boolean }[];
    expect(serializeNotificationPreferences(null, bad)).toEqual(NOTIFICATION_CATALOG);
  });

  it("repairs a malformed stored value instead of carrying it forward", () => {
    const next = serializeNotificationPreferences("garbage", [{ key: "invoice_sent", emailEnabled: false, smsEnabled: false }]);
    expect(parseNotificationPreferences(next)).toEqual(next);
    expect(next.find((p) => p.key === "invoice_sent")).toEqual({ key: "invoice_sent", emailEnabled: false, smsEnabled: false });
  });

  it("round-trips: what it writes, the parser reads back unchanged", () => {
    const next = serializeNotificationPreferences(
      [{ key: "payment_received", emailEnabled: false, smsEnabled: true }],
      [{ key: "tasting_scheduled", emailEnabled: false, smsEnabled: true }]
    );
    expect(resolveNotificationPreferences(next)).toEqual(next);
  });
});

describe("staying in step with the team's notification settings", () => {
  it("mirrors DEFAULT_PREFERENCES: same keys, same defaults, same order", () => {
    const src = readFileSync(TEAM_FILE, "utf8");
    const start = src.indexOf("const DEFAULT_PREFERENCES");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("];", start));
    const re = /key:\s*"([^"]+)"[\s\S]*?emailEnabled:\s*(true|false)[\s\S]*?smsEnabled:\s*(true|false)/g;
    const rows: { key: string; emailEnabled: boolean; smsEnabled: boolean }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) rows.push({ key: m[1], emailEnabled: m[2] === "true", smsEnabled: m[3] === "true" });
    expect(rows).toEqual(NOTIFICATION_CATALOG);
  });

  it("keeps the switches hidden while no sender checks them", () => {
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.") && p !== TEAM_FILE) {
          if (/shouldSendNotification\s*\(/.test(readFileSync(p, "utf8"))) callers.push(p);
        }
      }
    };
    for (const dir of ["lib", "actions", join("app", "api")]) walk(join(SRC, dir));
    if (callers.length === 0) expect(NOTIFICATION_PREFERENCES_ENFORCED).toBe(false);
  });
});
