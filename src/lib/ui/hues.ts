// ============================================================
// Hue tokens: the one place chip colours are written down.
// ------------------------------------------------------------
// Every coloured icon chip in the app (the module chip in the page header, the
// chip inside an action pill, the tinted chip on a KPI tile) takes its classes
// from the maps below. Pages pick a Hue (usually indirectly, through the module
// registry in src/config/modules.ts); they never write colour classes.
//
// Rules this file holds:
// - Every class string is a full literal. Tailwind's JIT only generates classes
//   it can see in the source, so a class name assembled from a hue variable
//   would silently render nothing.
// - Every map is total over Hue. A missing key used to ship silently (the build
//   ignores TS errors) and crash or mis-colour at runtime.
// - White ink on a solid fill must reach 3:1 (the icon/UI-component bar).
//   amber, emerald, teal and cyan fail at -500 (2.13-2.47:1), so their fill is
//   the -600 step (3.20-3.67:1). blue, indigo, pink and slate pass at -500.
//   SOLID_FILL_HEX records the light-mode fill so hues.test.ts can prove it.
// - gold: white ink passes on the light --gold fill (#b88513, 3.28:1) but not
//   on the dark-mode --gold (about 1.9:1), so dark mode switches to the espresso
//   --gold-foreground ink.
// - The tinted shadow (shadow-md shadow-<hue>/20) is the dashboard's approved
//   light-mode look. Dark mode has no coloured glow.
// - brand (plum --primary) and rose/red are hues, but never a module identity:
//   brand is reserved for the primary action, rose/red for semantic states.
// ============================================================

export const HUES = [
  "brand",
  "gold",
  "blue",
  "indigo",
  "amber",
  "emerald",
  "teal",
  "pink",
  "cyan",
  "rose",
  "red",
  "slate",
] as const;

export type Hue = (typeof HUES)[number];

/**
 * Solid filled chip: white glyph on a filled square, with the dashboard's
 * tinted shadow in light mode only. Used by the page-header module chip and the
 * chip inside an action pill.
 */
export const SOLID_CHIP: Readonly<Record<Hue, string>> = {
  brand: "bg-primary text-primary-foreground shadow-md shadow-primary/20 dark:shadow-none",
  gold: "bg-gold text-white shadow-md shadow-gold/20 dark:text-gold-foreground dark:shadow-none",
  blue: "bg-blue-500 text-white shadow-md shadow-blue-500/20 dark:shadow-none",
  indigo: "bg-indigo-500 text-white shadow-md shadow-indigo-500/20 dark:shadow-none",
  amber: "bg-amber-600 text-white shadow-md shadow-amber-500/20 dark:shadow-none",
  emerald: "bg-emerald-600 text-white shadow-md shadow-emerald-500/20 dark:shadow-none",
  teal: "bg-teal-600 text-white shadow-md shadow-teal-500/20 dark:shadow-none",
  pink: "bg-pink-500 text-white shadow-md shadow-pink-500/20 dark:shadow-none",
  cyan: "bg-cyan-600 text-white shadow-md shadow-cyan-500/20 dark:shadow-none",
  rose: "bg-rose-500 text-white shadow-md shadow-rose-500/20 dark:shadow-none",
  red: "bg-red-500 text-white shadow-md shadow-red-500/20 dark:shadow-none",
  slate: "bg-slate-500 text-white shadow-md shadow-slate-500/20 dark:shadow-none",
};

/**
 * Light-mode fill of each SOLID_CHIP entry, as sRGB hex. Not used for
 * rendering: hues.test.ts checks it against the real Tailwind palette and the
 * :root tokens, then checks the white-ink contrast on it.
 */
export const SOLID_FILL_HEX: Readonly<Record<Hue, string>> = {
  brand: "#6d1b52", // --primary (plum)
  gold: "#b88513", // --gold, light mode
  blue: "#2b7fff", // blue-500
  indigo: "#615fff", // indigo-500
  amber: "#e17100", // amber-600
  emerald: "#009966", // emerald-600
  teal: "#009689", // teal-600
  pink: "#f6339a", // pink-500
  cyan: "#0092b8", // cyan-600
  rose: "#ff2056", // rose-500
  red: "#fb2c36", // red-500
  slate: "#62748e", // slate-500
};

/**
 * Tinted (soft) chip: a pale wash with a coloured glyph. This is the KPI tile's
 * chip, carried over unchanged from StatTile, plus a slate entry so the map is
 * total. Dark slate uses -800 because slate-950 is the colour of the dark ground
 * and would leave the chip invisible.
 */
export const SOFT_CHIP: Readonly<Record<Hue, string>> = {
  brand: "bg-primary/12 text-primary dark:bg-primary/20",
  gold: "bg-gold/15 text-gold dark:bg-gold/20",
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300",
  pink: "bg-pink-100 text-pink-600 dark:bg-pink-950/50 dark:text-pink-300",
  cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300",
  red: "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
};

/**
 * Hover border tint for a pill whose chip is this hue. It follows the solid
 * fill's step, so the four -600 hues tint with -600.
 */
export const HOVER_EDGE: Readonly<Record<Hue, string>> = {
  brand: "hover:border-primary/40",
  gold: "hover:border-gold/40",
  blue: "hover:border-blue-500/40",
  indigo: "hover:border-indigo-500/40",
  amber: "hover:border-amber-600/40",
  emerald: "hover:border-emerald-600/40",
  teal: "hover:border-teal-600/40",
  pink: "hover:border-pink-500/40",
  cyan: "hover:border-cyan-600/40",
  rose: "hover:border-rose-500/40",
  red: "hover:border-red-500/40",
  slate: "hover:border-slate-500/40",
};

/**
 * Arc colour of StatTile's progress ring (the Donut draws in currentColor).
 * Not a chip class, but kept here so every per-hue class map lives in one file.
 */
export const RING_TEXT: Readonly<Record<Hue, string>> = {
  brand: "text-primary",
  gold: "text-gold",
  blue: "text-blue-500",
  indigo: "text-indigo-500",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  teal: "text-teal-500",
  pink: "text-pink-500",
  cyan: "text-cyan-500",
  rose: "text-rose-500",
  red: "text-red-500",
  slate: "text-slate-500",
};

/**
 * The chip inside the filled primary pill: the primary colours inverted, so the
 * chip reads as a light square on the plum pill. It has no hue because the
 * primary pill is always brand.
 */
export const PRIMARY_INVERSE_CHIP = "bg-primary-foreground text-primary";

export function isHue(value: unknown): value is Hue {
  return typeof value === "string" && (HUES as readonly string[]).includes(value);
}
