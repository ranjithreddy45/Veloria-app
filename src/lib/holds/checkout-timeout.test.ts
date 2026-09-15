import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHECKOUT_CLOSE_FALLBACK_MS,
  CHECKOUT_CLOSE_MARGIN_MS,
  CHECKOUT_TIMED_OUT_MESSAGE,
  RAZORPAY_CHECKOUT_TIMEOUT_SECONDS,
  checkoutClosedByTimeout,
  checkoutTimeoutSeconds,
} from "./checkout-timeout";
import { CHECKOUT_GRACE_MS, isHoldLapsed, type HoldFacts } from "./lapsed-hold";

// ============================================================
// A Razorpay checkout must close before the 15-minute protection a started
// checkout gives a hold runs out, so nobody pays onto a hold that may already
// have been released. The timeout is derived from that protection, never typed
// a second time, and every checkout in the app passes it.
// ============================================================

describe("the checkout timeout comes from the hold's checkout protection", () => {
  it("is the protection minus one minute: 840 seconds", () => {
    expect(CHECKOUT_GRACE_MS).toBe(15 * 60 * 1000);
    expect(CHECKOUT_CLOSE_MARGIN_MS).toBe(60 * 1000);
    expect(RAZORPAY_CHECKOUT_TIMEOUT_SECONDS).toBe(840);
    expect(RAZORPAY_CHECKOUT_TIMEOUT_SECONDS).toBe((CHECKOUT_GRACE_MS - CHECKOUT_CLOSE_MARGIN_MS) / 1000);
  });

  it("follows the protection and the margin if either changes", () => {
    expect(checkoutTimeoutSeconds(20 * 60 * 1000)).toBe(19 * 60);
    expect(checkoutTimeoutSeconds(10 * 60 * 1000, 2 * 60 * 1000)).toBe(8 * 60);
  });

  it("rounds down to whole seconds, so it never closes later than the margin allows", () => {
    expect(checkoutTimeoutSeconds(900_999, 60_000)).toBe(840);
  });

  it("is at least one second, even with a margin as long as the protection", () => {
    expect(checkoutTimeoutSeconds(60_000, 60_000)).toBe(1);
    expect(checkoutTimeoutSeconds(30_000, 60_000)).toBe(1);
  });

  it("the page's own close comes after Razorpay's and still inside the protection", () => {
    expect(CHECKOUT_CLOSE_FALLBACK_MS).toBeGreaterThan(RAZORPAY_CHECKOUT_TIMEOUT_SECONDS * 1000);
    expect(CHECKOUT_CLOSE_FALLBACK_MS).toBeLessThan(CHECKOUT_GRACE_MS);
  });
});

describe("a hold kept only by a checkout stays protected for as long as that checkout can be open", () => {
  const orderCreated = new Date("2026-09-16T10:00:00.000Z");
  const hold: HoldFacts = {
    status: "HOLD",
    holdExpiresAt: new Date("2026-09-16T09:59:00.000Z"), // the window closed just before checkout started
    invoices: [
      { status: "SENT", paidAmount: 0, payments: [{ status: "PENDING", receiptUploadedAt: null, createdAt: orderCreated }] },
    ],
  };
  const after = (ms: number) => new Date(orderCreated.getTime() + ms);

  it("when Razorpay closes the checkout, and when the page's fallback does, the hold has not lapsed", () => {
    expect(isHoldLapsed(hold, after(RAZORPAY_CHECKOUT_TIMEOUT_SECONDS * 1000))).toBe(false);
    expect(isHoldLapsed(hold, after(CHECKOUT_CLOSE_FALLBACK_MS))).toBe(false);
  });

  it("the hold lapses only once the checkout can no longer be open", () => {
    expect(isHoldLapsed(hold, after(CHECKOUT_GRACE_MS + 1))).toBe(true);
  });
});

describe("checkoutClosedByTimeout", () => {
  const opened = 1_000_000;
  const timeoutMs = RAZORPAY_CHECKOUT_TIMEOUT_SECONDS * 1000;

  it("a checkout the customer closes early is not a timeout", () => {
    expect(checkoutClosedByTimeout(opened, opened + 30_000)).toBe(false);
    expect(checkoutClosedByTimeout(opened, opened + timeoutMs - 60_000)).toBe(false);
  });

  it("a checkout that closes after the whole timeout is", () => {
    expect(checkoutClosedByTimeout(opened, opened + timeoutMs)).toBe(true);
    expect(checkoutClosedByTimeout(opened, opened + CHECKOUT_CLOSE_FALLBACK_MS)).toBe(true);
  });

  it("allows a moment's difference between the page's clock and Razorpay's", () => {
    expect(checkoutClosedByTimeout(opened, opened + timeoutMs - 1_000)).toBe(true);
  });

  it("honours a timeout reason if Razorpay passes one", () => {
    expect(checkoutClosedByTimeout(opened, opened + 5_000, "timeout")).toBe(true);
    expect(checkoutClosedByTimeout(opened, opened + 5_000, "cancel")).toBe(false);
  });

  it("a checkout that never opened did not time out", () => {
    expect(checkoutClosedByTimeout(0, Date.now())).toBe(false);
    expect(checkoutClosedByTimeout(Number.NaN, Date.now())).toBe(false);
  });
});

describe("the timed-out message", () => {
  it("says the checkout timed out and asks to try again, without claiming a payment went through or didn't", () => {
    expect(CHECKOUT_TIMED_OUT_MESSAGE).toMatch(/timed out/i);
    expect(CHECKOUT_TIMED_OUT_MESSAGE).toMatch(/try again/i);
    expect(CHECKOUT_TIMED_OUT_MESSAGE).not.toMatch(/success|payment received|no payment was taken|not charged|refund/i);
  });
});

// ---- Every checkout in the app passes the timeout ----------------------------

const SRC = fileURLToPath(new URL("../..", import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe("every Razorpay checkout in the app closes on the timeout and says so", () => {
  const checkouts = sourceFiles(SRC).filter((f) => readFileSync(f, "utf8").includes("new window.Razorpay("));

  it("finds the checkouts (the invoice and split links, one-tap quotes, the portal)", () => {
    expect(checkouts.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of checkouts) {
    it(file.slice(SRC.length), () => {
      const code = readFileSync(file, "utf8");
      expect(code).toContain("timeout: RAZORPAY_CHECKOUT_TIMEOUT_SECONDS");
      expect(code).toContain("checkoutClosedByTimeout(");
      expect(code).toContain("CHECKOUT_CLOSE_FALLBACK_MS");
    });
  }
});
