import { describe, it, expect } from "vitest";
import {
  ALL_HALLS,
  POLICY_KEYS,
  formatIstDate,
  groupFaqsForDisplay,
  isPolicyKey,
  isSameAsLive,
  nextFaqOrder,
  nextPolicyVersion,
  parsePolicyParam,
  planFaqMove,
  policyDraftKey,
  policyPath,
  resolvePublishedFaqs,
  sortByOrder,
  validateFaqInput,
  validatePolicyDraft,
  type DisplayFaq,
} from "./content-rules";

describe("policy keys and URLs", () => {
  it("parses slugs and keys in any case", () => {
    expect(parsePolicyParam("house-rules")).toBe("HOUSE_RULES");
    expect(parsePolicyParam("HOUSE_RULES")).toBe("HOUSE_RULES");
    expect(parsePolicyParam("Cancellation-Refund")).toBe("CANCELLATION_REFUND");
    expect(parsePolicyParam("booking_terms")).toBe("BOOKING_TERMS");
  });

  it("rejects anything else, including draft keys", () => {
    for (const bad of ["", "privacy", "DRAFT:HOUSE_RULES", "house rules", null, undefined]) {
      expect(parsePolicyParam(bad)).toBeNull();
    }
  });

  it("round-trips every key through its customer URL", () => {
    for (const key of POLICY_KEYS) {
      const path = policyPath(key);
      expect(path.startsWith("/app/policies/")).toBe(true);
      expect(parsePolicyParam(path.split("/").pop())).toBe(key);
    }
  });

  it("keeps drafts in a key customers can never request", () => {
    for (const key of POLICY_KEYS) {
      expect(policyDraftKey(key)).not.toBe(key);
      expect(isPolicyKey(policyDraftKey(key))).toBe(false);
    }
  });
});

describe("nextPolicyVersion", () => {
  it("starts at 1", () => {
    expect(nextPolicyVersion(null)).toBe(1);
    expect(nextPolicyVersion({ version: 1, isPublished: false, publishedAt: null })).toBe(1);
    expect(nextPolicyVersion({ version: 0, isPublished: false, publishedAt: null })).toBe(1);
  });

  it("bumps on every publish after the first", () => {
    expect(nextPolicyVersion({ version: 1, isPublished: true, publishedAt: "2026-09-01T10:00:00Z" })).toBe(2);
    expect(nextPolicyVersion({ version: 7, isPublished: true, publishedAt: new Date() })).toBe(8);
  });

  it("still bumps when the live version was taken offline, so numbers are never reused", () => {
    expect(nextPolicyVersion({ version: 2, isPublished: false, publishedAt: "2026-09-01T10:00:00Z" })).toBe(3);
    expect(nextPolicyVersion({ version: 1, isPublished: true, publishedAt: null })).toBe(2);
    expect(nextPolicyVersion({ version: 4, isPublished: false, publishedAt: null })).toBe(4);
  });
});

describe("validatePolicyDraft", () => {
  it("tidies title and text", () => {
    expect(validatePolicyDraft({ title: "  House   rules ", body: "Line one\r\nLine two\n\n\n\nNext" })).toEqual({
      ok: true,
      data: { title: "House rules", body: "Line one\nLine two\n\nNext" },
    });
  });

  it("requires both a title and text", () => {
    const r = validatePolicyDraft({ title: " ", body: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["body", "title"]);
    expect(validatePolicyDraft(null).ok).toBe(false);
  });

  it("enforces limits and types", () => {
    expect(validatePolicyDraft({ title: "x".repeat(121), body: "Text" }).ok).toBe(false);
    expect(validatePolicyDraft({ title: "Terms", body: 123 }).ok).toBe(false);
  });
});

describe("isSameAsLive", () => {
  const live = { title: "Terms", body: "Text", isPublished: true };
  it("is true only when the live version is published with identical text", () => {
    expect(isSameAsLive({ title: "Terms", body: "Text" }, live)).toBe(true);
    expect(isSameAsLive({ title: "Terms", body: "Text!" }, live)).toBe(false);
    expect(isSameAsLive({ title: "Terms", body: "Text" }, { ...live, isPublished: false })).toBe(false);
    expect(isSameAsLive({ title: "Terms", body: "Text" }, null)).toBe(false);
  });
});

describe("validateFaqInput", () => {
  it("tidies input and maps 'all halls' to no hall", () => {
    expect(validateFaqInput({ question: " Is  parking free? ", answer: "Yes.\n\n\n\nAsk security.", category: "  ", venueId: ALL_HALLS })).toEqual({
      ok: true,
      data: { question: "Is parking free?", answer: "Yes.\n\nAsk security.", category: null, venueId: null },
    });
    const hall = validateFaqInput({ question: "Q", answer: "A", category: "Parking", venueId: "venue_1" });
    expect(hall.ok && hall.data.venueId).toBe("venue_1");
  });

  it("requires a question and an answer", () => {
    const r = validateFaqInput({ question: "", answer: " " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["answer", "question"]);
  });

  it("limits the category", () => {
    expect(validateFaqInput({ question: "Q", answer: "A", category: "c".repeat(61) }).ok).toBe(false);
  });
});

describe("FAQ ordering", () => {
  const at = (d: string) => `2026-01-0${d}T00:00:00Z`;

  it("sorts by order, then oldest first, then id", () => {
    const items = [
      { id: "b", order: 1, createdAt: at("2") },
      { id: "a", order: 1, createdAt: at("2") },
      { id: "c", order: 0, createdAt: at("5") },
      { id: "d", order: 1, createdAt: at("1") },
    ];
    expect(sortByOrder(items).map((i) => i.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("puts a new FAQ last", () => {
    expect(nextFaqOrder([])).toBe(0);
    expect(nextFaqOrder([{ order: 3 }, { order: 7 }])).toBe(8);
  });

  it("swaps neighbours and writes only what changed", () => {
    const items = [
      { id: "a", order: 0, createdAt: at("1") },
      { id: "b", order: 1, createdAt: at("1") },
      { id: "c", order: 2, createdAt: at("1") },
    ];
    expect(planFaqMove(items, "c", "up")).toEqual([
      { id: "c", order: 1 },
      { id: "b", order: 2 },
    ]);
    expect(planFaqMove(items, "a", "down")).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
    ]);
  });

  it("does nothing past either end or for an unknown id", () => {
    const items = [
      { id: "a", order: 0, createdAt: at("1") },
      { id: "b", order: 1, createdAt: at("1") },
    ];
    expect(planFaqMove(items, "a", "up")).toEqual([]);
    expect(planFaqMove(items, "b", "down")).toEqual([]);
    expect(planFaqMove(items, "zzz", "up")).toEqual([]);
  });

  it("repairs ties and gaps while moving", () => {
    const ties = [
      { id: "a", order: 0, createdAt: at("1") },
      { id: "b", order: 0, createdAt: at("2") },
      { id: "c", order: 0, createdAt: at("3") },
    ];
    expect(planFaqMove(ties, "c", "up")).toEqual([
      { id: "c", order: 1 },
      { id: "b", order: 2 },
    ]);
    const gaps = [
      { id: "a", order: 0, createdAt: at("1") },
      { id: "b", order: 5, createdAt: at("1") },
      { id: "c", order: 9, createdAt: at("1") },
    ];
    expect(planFaqMove(gaps, "a", "down")).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
      { id: "c", order: 2 },
    ]);
  });
});

describe("published FAQs for customers", () => {
  const row = (id: string, order: number, venueId: string | null, category: string | null = null) => ({
    id,
    order,
    venueId,
    category,
    question: `Q ${id}`,
    answer: `A ${id}`,
    createdAt: "2026-01-01T00:00:00Z",
  });

  it("labels hall FAQs and hides those for halls customers can't see", () => {
    const out = resolvePublishedFaqs([row("general", 1, null), row("hall", 0, "h1"), row("hidden", 2, "h9")], [{ id: "h1", name: "Hall A" }]);
    expect(out.map((f) => [f.id, f.hallName])).toEqual([
      ["hall", "Hall A"],
      ["general", null],
    ]);
  });

  it("groups by category case-insensitively, in order of first appearance", () => {
    const faq = (id: string, category: string | null): DisplayFaq => ({ id, category, question: id, answer: id, venueId: null, hallName: null });
    const groups = groupFaqsForDisplay([faq("1", "Parking"), faq("2", null), faq("3", "parking "), faq("4", "Food")]);
    expect(groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([
      ["Parking", ["1", "3"]],
      ["General", ["2"]],
      ["Food", ["4"]],
    ]);
  });
});

describe("formatIstDate", () => {
  it("formats in India time, not the server's UTC", () => {
    const late = "2026-09-15T20:00:00Z"; // 16 Sep, 1:30 am IST
    expect(formatIstDate(late)).toMatch(/^16 /);
    expect(formatIstDate(late)).toContain("2026");
    expect(formatIstDate(late, { withTime: true })).toContain("1:30");
  });

  it("returns empty for missing or invalid dates", () => {
    expect(formatIstDate(null)).toBe("");
    expect(formatIstDate("not a date")).toBe("");
  });
});
