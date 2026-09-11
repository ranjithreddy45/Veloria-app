// ============================================================
// Default photography for the guest app.
//
// These are the licensed Unsplash photos the approved design shipped with
// (credits in /public/guest/photos/CREDITS.txt). They are ambience, not
// Veloria's halls: every place that uses them prefers a real, public
// GalleryItem first and falls back here only when none exists — so publishing
// real photos replaces them per hall with no code change.
// ============================================================

const P = (n: string) => `/guest/photos/${n}.jpg`;

export const STOCK = {
  welcome: P("welcome"), orchid: P("orchid"), stage: P("stage"), banquet: P("banquet"), chairs: P("chairs"),
  chandelier: P("chandelier"), jasmine: P("jasmine"), arch: P("arch"), entrance: P("entrance"), tents: P("tents"),
  dance: P("dance"), confetti: P("confetti"), terrace: P("terrace"), tentnight: P("tentnight"), flowers: P("flowers"), tables: P("tables"),
} as const;
export type StockKey = keyof typeof STOCK;

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

/** A stable cover + four detail shots for a hall, chosen by its id. */
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

/** Category → thumbnail for partner packages without their own image. */
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
