import { isStockPhoto } from "../../../_components/stock";

// ============================================================
// What one slide of a hall's photo carousel IS, and what it says.
//
// The rule is per picture, not per mode. A hall's carousel used to be either
// "real photos" (no label) or "the fallback illustration" (labelled) — so a
// bundled illustration published as a public GalleryItem sailed through as a
// photo of the room. `isStockPhoto` answers the question for each URL, so a
// mixed set labels the illustrations in it and leaves the real photos alone.
//
// Pure on purpose: the component only renders what these decide.
// ============================================================

export interface CarouselPhotoInput {
  url: string;
  title: string | null;
}

export interface CarouselSlide {
  /** True when this URL is one of the app's bundled illustrations. */
  illustration: boolean;
  /** The image's alt text — never empty, and never claims an illustration is the room. */
  alt: string;
}

/**
 * One slide's honesty verdict and alt text.
 * `index` is 0-based; `count` is how many pictures the carousel holds.
 */
export function describeCarouselSlide(photo: CarouselPhotoInput, hallName: string, index: number, count: number): CarouselSlide {
  if (isStockPhoto(photo.url)) {
    // Deliberately ignores the stored title: a caption cannot make a stock
    // picture a photo of this hall, and "Mandap" under an illustration would.
    return { illustration: true, alt: `Illustration, not a photo of ${hallName}` };
  }
  if (photo.title) return { illustration: false, alt: `${hallName} — ${photo.title}` };
  // Every slide gets real alt text; the later ones used to be alt="" and were
  // silent to a screen reader.
  return { illustration: false, alt: count > 1 ? `${hallName}, photo ${index + 1} of ${count}` : hallName };
}

/** The whole carousel's accessible name — it says how many illustrations are in it. */
export function carouselGroupLabel(hallName: string, slides: readonly CarouselSlide[]): string {
  const count = slides.length;
  const stock = slides.filter((s) => s.illustration).length;
  const keys = count > 1 ? " Use the arrow keys to see more." : "";
  if (count === 0) return hallName;
  if (stock === count) {
    return `${hallName} — ${count} ${count === 1 ? "illustration, not a photo" : "illustrations, not photos"} of this hall.${keys}`;
  }
  if (stock > 0) {
    return `${hallName} — ${count} pictures, of which ${stock} ${stock === 1 ? "is an illustration" : "are illustrations"} rather than ${stock === 1 ? "a photo" : "photos"} of this hall.${keys}`;
  }
  return `${hallName} — ${count} ${count === 1 ? "photo" : "photos"}.${keys}`;
}
