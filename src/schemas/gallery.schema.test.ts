import { describe, expect, it } from "vitest";
import { galleryItemSchema, isAllowedGalleryMediaUrl, updateGalleryItemSchema } from "./gallery.schema";

// ============================================================
// Gallery media URLs. Public gallery photos are served from the app's own
// origin, so a stored URL may only be an http(s) link or a base64 PNG, JPEG,
// GIF or WebP data URL — never HTML, SVG or a script scheme.
// ============================================================

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("isAllowedGalleryMediaUrl", () => {
  it("accepts http(s) links and base64 PNG, JPEG, GIF and WebP images", () => {
    for (const url of [
      "https://cdn.example.com/hall.jpg",
      "http://example.com/walkthrough.mp4",
      "https://www.youtube.com/watch?v=abc123",
      PNG,
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      "data:image/gif;base64,R0lGODlh",
      "data:image/webp;base64,UklGRg==",
    ]) {
      expect(isAllowedGalleryMediaUrl(url), url).toBe(true);
    }
  });

  it("refuses anything a browser could run, and anything the photo route won't serve", () => {
    for (const url of [
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "data:text/html,<script>alert(1)</script>",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:application/pdf;base64,JVBERi0=",
      "data:image/heic;base64,AAAAGGZ0eXA=",
      "data:image/png,not-base64",
      "data:image/png;base64,",
      "data:image/png;base64,iVBOR w0KGgo=",
      "javascript:alert(1)",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "/uploads/hall.jpg",
      "not a url",
    ]) {
      expect(isAllowedGalleryMediaUrl(url), url).toBe(false);
    }
  });
});

describe("gallery schemas use the rule for url and thumbnail", () => {
  it("on create", () => {
    expect(galleryItemSchema.safeParse({ url: PNG }).success).toBe(true);
    expect(galleryItemSchema.safeParse({ url: PNG, thumbnailUrl: "" }).success).toBe(true);
    expect(galleryItemSchema.safeParse({ url: "https://cdn.example.com/a.jpg", thumbnailUrl: PNG }).success).toBe(true);
    expect(galleryItemSchema.safeParse({ url: "" }).success).toBe(false);
    expect(galleryItemSchema.safeParse({ url: "data:text/html;base64,PHNjcmlwdD4=" }).success).toBe(false);
    expect(galleryItemSchema.safeParse({ url: PNG, thumbnailUrl: "data:image/svg+xml;base64,PHN2Zz4=" }).success).toBe(false);
  });

  it("on update", () => {
    expect(updateGalleryItemSchema.safeParse({}).success).toBe(true);
    expect(updateGalleryItemSchema.safeParse({ url: PNG, thumbnailUrl: "" }).success).toBe(true);
    expect(updateGalleryItemSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(updateGalleryItemSchema.safeParse({ thumbnailUrl: "data:text/html,<b>x</b>" }).success).toBe(false);
  });
});
