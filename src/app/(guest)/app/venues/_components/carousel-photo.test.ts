import { describe, expect, it } from "vitest";
import { carouselGroupLabel, describeCarouselSlide } from "./carousel-photo";
import { STOCK } from "../../../_components/stock";

// The one rule these guard: a bundled illustration says it is an
// illustration, per picture, even when it arrives as a published gallery item
// alongside real photos of the hall.

const HALL = "Orchid Hall";
const real = (title: string | null = null) => ({ url: "/api/guest/photo/g/ck123", title });
const stock = (title: string | null = null) => ({ url: STOCK.banquet, title });

describe("describeCarouselSlide", () => {
  it("labels a bundled illustration published as a gallery item", () => {
    const slide = describeCarouselSlide(stock(), HALL, 0, 3);
    expect(slide.illustration).toBe(true);
    expect(slide.alt).toBe("Illustration, not a photo of Orchid Hall");
  });

  it("will not let a stored caption dress an illustration up as the room", () => {
    const slide = describeCarouselSlide(stock("Mandap"), HALL, 1, 4);
    expect(slide.illustration).toBe(true);
    expect(slide.alt).not.toContain("Mandap");
    expect(slide.alt).toBe("Illustration, not a photo of Orchid Hall");
  });

  it("leaves a real photo alone", () => {
    expect(describeCarouselSlide(real("Stage"), HALL, 0, 2)).toEqual({
      illustration: false,
      alt: "Orchid Hall — Stage",
    });
  });

  it("gives every untitled real photo alt text, not just the first", () => {
    expect(describeCarouselSlide(real(), HALL, 0, 5).alt).toBe("Orchid Hall, photo 1 of 5");
    // This one used to be alt="" and was silent to a screen reader.
    expect(describeCarouselSlide(real(), HALL, 3, 5).alt).toBe("Orchid Hall, photo 4 of 5");
  });

  it("does not number a lone photo", () => {
    expect(describeCarouselSlide(real(), HALL, 0, 1).alt).toBe("Orchid Hall");
  });

  it("decides per picture, so a mixed set is labelled in part", () => {
    const photos = [real("Stage"), stock(), real()];
    const slides = photos.map((p, i) => describeCarouselSlide(p, HALL, i, photos.length));
    expect(slides.map((s) => s.illustration)).toEqual([false, true, false]);
  });
});

describe("carouselGroupLabel", () => {
  const label = (photos: { url: string; title: string | null }[]) =>
    carouselGroupLabel(HALL, photos.map((p, i) => describeCarouselSlide(p, HALL, i, photos.length)));

  it("calls a set of real photos photos", () => {
    expect(label([real(), real()])).toBe("Orchid Hall — 2 photos. Use the arrow keys to see more.");
  });

  it("never calls an all-illustration set photos", () => {
    const text = label([stock(), stock(), stock()]);
    expect(text).toContain("3 illustrations, not photos of this hall");
    expect(text).not.toMatch(/\d+ photos/);
  });

  it("counts the illustrations in a mixed set", () => {
    expect(label([real(), stock(), real(), stock()])).toContain("4 pictures, of which 2 are illustrations");
  });

  it("drops the arrow-key hint when there is nothing to move between", () => {
    expect(label([real()])).toBe("Orchid Hall — 1 photo.");
  });
});
