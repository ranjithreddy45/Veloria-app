// ============================================================
// Illustration photos for the guest app.
//
// These are licensed Unsplash photos the approved design shipped with
// (credits in /public/guest/photos/CREDITS.txt). They are NOT photos of
// Veloria Grand. The rules, carried by the helpers below:
//   - a real public photo (a GalleryItem marked public, or a property photo of
//     a live hall) always wins;
//   - illustrations are used only when a hall, or the gallery, has no real
//     photo at all, and are never mixed into a real set;
//   - wherever one is shown it carries a visible "Illustration" label
//     (IllustrationBadge in ui.tsx), and nothing implies a real photo set.
// ============================================================

const DIR = "/guest/photos/";
const P = (n: string) => `${DIR}${n}.jpg`;

export const STOCK = {
  welcome: P("welcome"), orchid: P("orchid"), stage: P("stage"), banquet: P("banquet"), chairs: P("chairs"),
  chandelier: P("chandelier"), jasmine: P("jasmine"), arch: P("arch"), entrance: P("entrance"), tents: P("tents"),
  dance: P("dance"), confetti: P("confetti"), terrace: P("terrace"), tentnight: P("tentnight"), flowers: P("flowers"), tables: P("tables"),
} as const;
export type StockKey = keyof typeof STOCK;

/** The visible label on every illustration photo. */
export const ILLUSTRATION_LABEL = "Illustration";

/** True for one of the bundled illustration photos (never a photo of Veloria Grand). */
export function isStockPhoto(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(DIR);
}

const HALL_SETS: { cover: StockKey; shots: StockKey[] }[] = [
  { cover: "orchid", shots: ["stage", "banquet", "entrance", "chandelier"] },
  { cover: "jasmine", shots: ["arch", "flowers", "entrance", "tables"] },
  { cover: "terrace", shots: ["tentnight", "dance", "flowers", "tables"] },
  { cover: "chandelier", shots: ["banquet", "stage", "chairs", "confetti"] },
  { cover: "stage", shots: ["tents", "entrance", "banquet", "dance"] },
  { cover: "banquet", shots: ["chairs", "tables", "chandelier", "flowers"] },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

/** A stable illustration cover + four detail shots for a hall, chosen by its id. */
export function hallStock(seed: string): { cover: string; shots: string[] } {
  const set = HALL_SETS[hash(seed) % HALL_SETS.length];
  return { cover: STOCK[set.cover], shots: set.shots.map((k) => STOCK[k]) };
}

export const STOCK_TAGS = ["Weddings", "Receptions", "Corporate"] as const;
export const GALLERY_STOCK: { src: string; tag: (typeof STOCK_TAGS)[number]; label: string }[] = [
  { src: STOCK.stage, tag: "Weddings", label: "Mandap" },
  { src: STOCK.terrace, tag: "Receptions", label: "Terrace at dusk" },
  { src: STOCK.entrance, tag: "Weddings", label: "Baraat entry" },
  { src: STOCK.chairs, tag: "Corporate", label: "Gala" },
  { src: STOCK.banquet, tag: "Receptions", label: "Dinner wing" },
  { src: STOCK.tents, tag: "Weddings", label: "Sangeet stage" },
  { src: STOCK.confetti, tag: "Receptions", label: "Celebration" },
  { src: STOCK.dance, tag: "Weddings", label: "Sangeet" },
  { src: STOCK.arch, tag: "Weddings", label: "Floral arch" },
  { src: STOCK.tentnight, tag: "Receptions", label: "Evening tent" },
  { src: STOCK.flowers, tag: "Weddings", label: "Florals" },
  { src: STOCK.tables, tag: "Corporate", label: "Dinner tables" },
];

export interface PhotoLike {
  id: string;
  url: string;
  title: string | null;
}

/** A hall's card or hero image: its first real photo, else an illustration (label it when isStock). */
export function hallCover(realUrl: string | null | undefined, seed: string): { src: string; isStock: boolean } {
  return realUrl ? { src: realUrl, isStock: false } : { src: hallStock(seed).cover, isStock: true };
}

/**
 * A hall's detail imagery. With real photos: the first is the hero, the next
 * eight form the strip. Without: an illustration hero and no strip — detail
 * shots of somewhere else would read as this hall's interiors.
 */
export function hallPhotoSet(real: readonly PhotoLike[], seed: string): { hero: string; strip: PhotoLike[]; isStock: boolean } {
  if (real.length > 0) return { hero: real[0].url, strip: real.slice(1, 9), isStock: false };
  return { hero: hallStock(seed).cover, strip: [], isStock: true };
}

/** Home teaser: up to `max` real photos; illustrations only when there is no real photo at all. */
export function teaserPhotos(real: readonly PhotoLike[], max = 3): { items: PhotoLike[]; isStock: boolean } {
  if (real.length > 0) return { items: real.slice(0, max), isStock: false };
  return { items: GALLERY_STOCK.slice(0, max).map((g) => ({ id: g.src, url: g.src, title: g.label })), isStock: true };
}

/** Category → thumbnail for partner packages without their own image (an illustration — label it). */
export function packageStock(category: string): string {
  const c = category.toLowerCase();
  if (/cater|food|menu|cuisine/.test(c)) return STOCK.banquet;
  if (/floral|flower|mandap/.test(c)) return STOCK.arch;
  if (/decor|light/.test(c)) return STOCK.tents;
  if (/photo|film|video|cinema/.test(c)) return STOCK.confetti;
  if (/dj|band|music|sound/.test(c)) return STOCK.dance;
  if (/tent|venue|outdoor/.test(c)) return STOCK.tentnight;
  return STOCK.tables;
}

export const CREDITS_LINE =
  "Photography courtesy of Unsplash contributors: AMISH THAKKAR, iKshana Productions, AMIT KUMAR, Vaibhav Nagare, Sloshout, Vidit Goswami, Anubhav Event Productions, Titas Mallick, Brands&People, Vladyslav Tobolenko, Awesome Sauce Creative and Abby Savage.";
