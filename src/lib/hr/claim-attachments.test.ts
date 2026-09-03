import { describe, it, expect } from "vitest";
import {
  checkAttachments,
  dataUrlBytes,
  CLAIM_ATTACHMENT_MAX_COUNT,
  type IncomingAttachment,
} from "./claim-attachments";

/** A data-URL whose decoded size is approximately `bytes`. */
function fake(bytes: number, mimeType = "image/jpeg", fileName = "bill.jpg"): IncomingAttachment {
  const b64 = "A".repeat(Math.ceil((bytes * 4) / 3));
  return { fileName, mimeType, data: `data:${mimeType};base64,${b64}` };
}

describe("dataUrlBytes", () => {
  it("measures decoded size without decoding", () => {
    expect(dataUrlBytes("data:image/png;base64,QUJD")).toBe(3); // "ABC"
  });
  it("accounts for padding", () => {
    expect(dataUrlBytes("data:image/png;base64,QUI=")).toBe(2); // "AB"
  });
  it("returns 0 for a malformed value rather than throwing", () => {
    expect(dataUrlBytes("not-a-data-url")).toBe(0);
  });
});

describe("checkAttachments", () => {
  it("accepts a normal set of compressed bills", () => {
    const r = checkAttachments([fake(400_000), fake(350_000), fake(500_000)]);
    expect(r.ok).toBe(true);
    expect(r.sizes).toHaveLength(3);
  });

  it("rejects an unsupported type, naming the file", () => {
    const r = checkAttachments([fake(1000, "application/zip", "receipts.zip")]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("receipts.zip");
  });

  it("rejects one oversized file with its actual size", () => {
    // The employee must be able to tell WHICH file and by how much; "upload
    // failed" is what makes people give up and email HR instead.
    const r = checkAttachments([fake(3_000_000, "image/jpeg", "hotel.jpg")]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("hotel.jpg");
    expect(r.error).toMatch(/MB/);
  });

  it("rejects a set that busts the total budget", () => {
    const r = checkAttachments([fake(2_000_000), fake(2_000_000)]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/total/i);
  });

  it("counts attachments ALREADY on the claim", () => {
    // Adding to an existing claim must respect what is already there, or the
    // limit is trivially bypassed one upload at a time.
    const r = checkAttachments([fake(1000)], CLAIM_ATTACHMENT_MAX_COUNT, 0);
    expect(r.ok).toBe(false);
    expect(r.error).toContain(String(CLAIM_ATTACHMENT_MAX_COUNT));
  });

  it("counts bytes ALREADY on the claim", () => {
    const r = checkAttachments([fake(2_000_000)], 1, 2_000_000);
    expect(r.ok).toBe(false);
  });

  it("rejects an empty file instead of storing a zero-byte row", () => {
    const r = checkAttachments([{ fileName: "x.pdf", mimeType: "application/pdf", data: "data:application/pdf;base64," }]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("empty");
  });

  it("accepts PDFs, which cannot be compressed client-side", () => {
    const r = checkAttachments([fake(900_000, "application/pdf", "invoice.pdf")]);
    expect(r.ok).toBe(true);
  });
});
