import { describe, expect, it } from "vitest";
import { GALLERY_STOCK, hallCover, hallPhotoSet, hallStock, isStockPhoto, packageStock, teaserPhotos } from "./stock";

const real = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `g${i}`, url: `/api/guest/photo/g/photo${i}`, title: `Photo ${i}` }));

describe("isStockPhoto", () => {
  it("recognises the bundled illustrations and nothing else", () => {
    expect(isStockPhoto(hallStock("hall-1").cover)).toBe(true);
    expect(isStockPhoto(GALLERY_STOCK[0].src)).toBe(true);
    expect(isStockPhoto(packageStock("Catering"))).toBe(true);
    expect(isStockPhoto("/api/guest/photo/g/abc123")).toBe(false);
    expect(isStockPhoto("https://cdn.example.com/guest/photos/x.jpg")).toBe(false);
    expect(isStockPhoto(null)).toBe(false);
  });
});

describe("hallCover", () => {
  it("prefers the hall's real photo", () => {
    expect(hallCover("/api/guest/photo/g/abc", "hall-1")).toEqual({ src: "/api/guest/photo/g/abc", isStock: false });
  });

  it("marks the illustration fallback", () => {
    expect(hallCover(undefined, "hall-1")).toEqual({ src: hallStock("hall-1").cover, isStock: true });
  });
});

describe("hallPhotoSet", () => {
  it("shows one labelled illustration and no detail strip when the hall has no real photo", () => {
    expect(hallPhotoSet([], "hall-1")).toEqual({ hero: hallStock("hall-1").cover, strip: [], isStock: true });
  });

  it("never mixes illustrations into a hall with a single real photo", () => {
    const photos = real(1);
    expect(hallPhotoSet(photos, "hall-1")).toEqual({ hero: photos[0].url, strip: [], isStock: false });
  });

  it("puts up to eight more real photos in the strip", () => {
    const set = hallPhotoSet(real(12), "hall-1");
    expect(set.strip).toHaveLength(8);
    expect(set.strip.some((p) => isStockPhoto(p.url))).toBe(false);
  });
});

describe("teaserPhotos", () => {
  it("shows real photos even when there are fewer than three", () => {
    expect(teaserPhotos(real(2))).toEqual({ items: real(2), isStock: false });
  });

  it("caps real photos", () => {
    expect(teaserPhotos(real(7)).items).toHaveLength(3);
  });

  it("falls back to three illustrations only when there is no real photo", () => {
    const t = teaserPhotos([]);
    expect(t.isStock).toBe(true);
    expect(t.items).toHaveLength(3);
    expect(t.items.every((p) => isStockPhoto(p.url))).toBe(true);
  });
});

describe("hallStock", () => {
  it("is stable per hall", () => {
    expect(hallStock("abc")).toEqual(hallStock("abc"));
  });
});
