import { describe, it, expect } from "vitest";
import {
  parseAmount, parseBankCsv, dedupeKey, scoreMatch, suggestMatches, applyRules, ruleTokenFor,
  type BankRow, type MatchCandidate, type ReconRule,
} from "./reconcile";

describe("parseAmount", () => {
  it("parses Indian-grouped numbers", () => expect(parseAmount("1,23,456.78")).toBeCloseTo(123456.78));
  it("treats parentheses as negative", () => expect(parseAmount("(500.00)")).toBe(-500));
  it("returns 0 for empty / junk", () => { expect(parseAmount("")).toBe(0); expect(parseAmount("-")).toBe(0); });
});

describe("parseBankCsv", () => {
  it("parses a debit/credit-column statement", () => {
    const csv = [
      "Date,Narration,Debit,Credit,Ref",
      "01/04/2026,UPI/PAYTM/RENT,50000.00,,UTR123",
      "02/04/2026,NEFT FROM ACME EVENTS,,118000.00,UTR456",
      "bad,row,,,",
    ].join("\n");
    const { rows, skipped } = parseBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(rows[0].debit).toBe(50000);
    expect(rows[1].credit).toBe(118000);
    expect(rows[0].date.toISOString().slice(0, 10)).toBe("2026-04-01");
  });
  it("parses a signed-amount statement", () => {
    const csv = ["Date,Description,Amount", "2026-04-03,Bank charges,-236", "2026-04-04,Deposit,10000"].join("\n");
    const { rows } = parseBankCsv(csv);
    expect(rows[0].debit).toBe(236);
    expect(rows[1].credit).toBe(10000);
  });
});

describe("dedupeKey", () => {
  it("is stable for the same row and differs by amount", () => {
    const a: BankRow = { date: new Date("2026-04-01T00:00:00Z"), description: "NEFT  ACME", reference: "U1", debit: 0, credit: 100 };
    const b: BankRow = { ...a, credit: 200 };
    expect(dedupeKey(a)).toBe(dedupeKey({ ...a }));
    expect(dedupeKey(a)).not.toBe(dedupeKey(b));
  });
});

describe("scoreMatch", () => {
  const txnIn: BankRow = { date: new Date("2026-04-02T00:00:00Z"), description: "x", reference: null, debit: 0, credit: 118000 };
  it("matches money-in to a bank debit on the same day", () => {
    const cand: MatchCandidate = { entryId: "e1", date: new Date("2026-04-02T00:00:00Z"), bankDebit: 118000, bankCredit: 0 };
    expect(scoreMatch(txnIn, cand)).toBeCloseTo(1.0);
  });
  it("scores lower as dates drift, zero past the window", () => {
    const near: MatchCandidate = { entryId: "e1", date: new Date("2026-04-04T00:00:00Z"), bankDebit: 118000, bankCredit: 0 };
    const far: MatchCandidate = { entryId: "e2", date: new Date("2026-04-20T00:00:00Z"), bankDebit: 118000, bankCredit: 0 };
    expect(scoreMatch(txnIn, near)).toBeGreaterThan(0.6);
    expect(scoreMatch(txnIn, near)).toBeLessThan(1.0);
    expect(scoreMatch(txnIn, far)).toBe(0);
  });
  it("returns 0 when amount or direction mismatch", () => {
    expect(scoreMatch(txnIn, { entryId: "e", date: txnIn.date, bankDebit: 99999, bankCredit: 0 })).toBe(0);
    expect(scoreMatch(txnIn, { entryId: "e", date: txnIn.date, bankDebit: 0, bankCredit: 118000 })).toBe(0);
  });
});

describe("suggestMatches", () => {
  it("assigns each txn its best free candidate 1:1", () => {
    const txns: BankRow[] = [
      { date: new Date("2026-04-02T00:00:00Z"), description: "in A", reference: null, debit: 0, credit: 100 },
      { date: new Date("2026-04-03T00:00:00Z"), description: "out B", reference: null, debit: 50, credit: 0 },
    ];
    const cands: MatchCandidate[] = [
      { entryId: "e1", date: new Date("2026-04-02T00:00:00Z"), bankDebit: 100, bankCredit: 0 },
      { entryId: "e2", date: new Date("2026-04-03T00:00:00Z"), bankDebit: 0, bankCredit: 50 },
    ];
    const m = suggestMatches(txns, cands);
    expect(m.get(0)?.entryId).toBe("e1");
    expect(m.get(1)?.entryId).toBe("e2");
  });
});

describe("applyRules", () => {
  const rules: ReconRule[] = [
    { id: "r1", match: "paytm", accountId: "a-rent", direction: "DEBIT", hits: 5 },
    { id: "r2", match: "rent", accountId: "a-rent2", direction: null, hits: 2 },
  ];
  it("picks the highest-hits compatible rule", () => {
    const r = applyRules("UPI/PAYTM/RENT", "DEBIT", rules);
    expect(r?.id).toBe("r1");
  });
  it("respects direction", () => {
    expect(applyRules("UPI/PAYTM/RENT", "CREDIT", rules)?.id).toBe("r2");
  });
  it("returns null when nothing matches", () => {
    expect(applyRules("salary", "DEBIT", rules)).toBeNull();
  });
});

describe("ruleTokenFor", () => {
  it("extracts the longest alphabetic token", () => {
    expect(ruleTokenFor("NEFT/ACMEEVENTS/UTR12345")).toBe("acmeevents");
  });
});
