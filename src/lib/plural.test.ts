import { describe, it, expect } from "vitest";
import { pluralNoun } from "./plural";

describe("pluralNoun", () => {
  it("handles the filter labels on the People pages", () => {
    expect(pluralNoun("entity")).toBe("entities");
    expect(pluralNoun("status")).toBe("statuses");
    expect(pluralNoun("department")).toBe("departments");
    expect(pluralNoun("designation")).toBe("designations");
    expect(pluralNoun("vertical")).toBe("verticals");
    expect(pluralNoun("day")).toBe("days");
    expect(pluralNoun("branch")).toBe("branches");
  });
});
