import { describe, it, expect } from "vitest";
import { isSafeReceiptDataUrl, isSafeReceiptUrl } from "./receipt";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("isSafeReceiptDataUrl (customer-submitted proofs)", () => {
  it("accepts base64 image/pdf data-URLs", () => {
    expect(isSafeReceiptDataUrl(PNG)).toBe(true);
    expect(isSafeReceiptDataUrl("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isSafeReceiptDataUrl("data:application/pdf;base64,JVBERi0=")).toBe(true);
  });

  it("REJECTS executable / unsafe schemes (the XSS vectors)", () => {
    expect(isSafeReceiptDataUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBe(false);
    expect(isSafeReceiptDataUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeReceiptDataUrl("javascript:fetch('/steal')")).toBe(false);
    expect(isSafeReceiptDataUrl('data:image/png,x"></iframe><script>alert(1)</script>')).toBe(false); // not base64
    expect(isSafeReceiptDataUrl("https://evil.example/x")).toBe(false); // https not allowed for customer path
    expect(isSafeReceiptDataUrl("")).toBe(false);
  });
});

describe("isSafeReceiptUrl (staff references)", () => {
  it("accepts image/pdf data-URLs and https links", () => {
    expect(isSafeReceiptUrl(PNG)).toBe(true);
    expect(isSafeReceiptUrl("https://drive.example/receipt.pdf")).toBe(true);
  });
  it("rejects javascript:, data:text/html, http and quotes", () => {
    expect(isSafeReceiptUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeReceiptUrl("data:text/html;base64,AA==")).toBe(false);
    expect(isSafeReceiptUrl("http://insecure.example/x")).toBe(false);
    expect(isSafeReceiptUrl('https://evil.example/"><script>')).toBe(false);
  });
});
