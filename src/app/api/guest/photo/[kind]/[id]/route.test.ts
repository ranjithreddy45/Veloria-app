import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// /api/guest/photo/[kind]/[id]: the public photo route answers on the app's
// own origin, so it must never hand back a stored file a browser would run
// (HTML, SVG, …) or follow a stored non-http(s) link. Only Prisma is mocked.
// ============================================================

const db = vi.hoisted(() => ({
  galleryItem: { findFirst: vi.fn() },
  acqAttachment: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { GET } from "./route";

const ID = "clphoto0000000001";
const BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const dataUrl = (mime: string, body: Buffer = BYTES) => `data:${mime};base64,${body.toString("base64")}`;

async function open(kind: string, stored: string | null, id = ID) {
  db.galleryItem.findFirst.mockResolvedValue(stored === null ? null : { url: stored, thumbnailUrl: null });
  db.acqAttachment.findFirst.mockResolvedValue(stored === null ? null : { url: stored });
  return GET(new Request(`https://app.example.com/api/guest/photo/${kind}/${id}`), {
    params: Promise.resolve({ kind, id }),
  });
}

beforeEach(() => {
  db.galleryItem.findFirst.mockReset();
  db.acqAttachment.findFirst.mockReset();
});

describe("guest photo route: inline images only", () => {
  it.each(["image/png", "image/jpeg", "image/gif", "image/webp"])(
    "serves a %s data URL with nosniff and a sandboxing CSP",
    async (mime) => {
      const res = await open("g", dataUrl(mime));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe(mime);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
      expect(Buffer.from(await res.arrayBuffer()).equals(BYTES)).toBe(true);
    }
  );

  it("serves a deal photo too, reading the type case-insensitively", async () => {
    const res = await open("p", dataUrl("IMAGE/PNG"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it.each(["text/html", "image/svg+xml", "application/xhtml+xml", "text/javascript", "application/pdf", "image/heic"])(
    "refuses a stored %s data URL",
    async (mime) => {
      const res = await open("g", dataUrl(mime, Buffer.from("<script>alert(document.cookie)</script>")));
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type") ?? "").not.toMatch(/html|svg|javascript/);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
      expect(await res.text()).not.toContain("<script>");
    }
  );

  it("redirects to a hosted http(s) link or a site-relative path", async () => {
    const hosted = await open("g", "https://cdn.example.com/hall.jpg");
    expect(hosted.status).toBe(302);
    expect(hosted.headers.get("location")).toBe("https://cdn.example.com/hall.jpg");
    const relative = await open("p", "/images/hall.jpg");
    expect(relative.status).toBe(302);
    expect(relative.headers.get("location")).toBe("https://app.example.com/images/hall.jpg");
  });

  it.each(["javascript:alert(1)", "vbscript:msgbox(1)", "s3://bucket/photos/key.jpg", "DATA:text/html;base64,PHNjcmlwdD4="])(
    "never redirects to or serves %s",
    async (stored) => {
      const res = await open("g", stored);
      expect(res.status).toBe(404);
      expect(res.headers.get("location")).toBeNull();
    }
  );

  it("404s an unknown photo, a malformed id and an unknown kind", async () => {
    expect((await open("g", null)).status).toBe(404);
    expect((await open("g", dataUrl("image/png"), "bad id!")).status).toBe(404);
    expect((await open("x", dataUrl("image/png"))).status).toBe(404);
  });
});
