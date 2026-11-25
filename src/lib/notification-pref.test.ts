import { describe, it, expect } from "vitest";
import { emailPrefEnabled, ATTENDANCE_PUNCH_PREF } from "./notification-pref";

describe("emailPrefEnabled", () => {
  it("is on unless the person saved it off", () => {
    expect(emailPrefEnabled(null, ATTENDANCE_PUNCH_PREF)).toBe(true);
    expect(emailPrefEnabled("junk", ATTENDANCE_PUNCH_PREF)).toBe(true);
    expect(emailPrefEnabled([{ key: "lead_assigned", emailEnabled: false }], ATTENDANCE_PUNCH_PREF)).toBe(true);
    expect(emailPrefEnabled([{ key: ATTENDANCE_PUNCH_PREF, emailEnabled: true }], ATTENDANCE_PUNCH_PREF)).toBe(true);
    expect(emailPrefEnabled([{ key: ATTENDANCE_PUNCH_PREF, emailEnabled: false, smsEnabled: false }], ATTENDANCE_PUNCH_PREF)).toBe(false);
  });
});
