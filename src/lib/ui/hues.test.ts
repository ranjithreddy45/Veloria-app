import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import colors from "tailwindcss/colors";
import { describe, expect, it } from "vitest";
import {
  HOVER_EDGE,
  HUES,
  PRIMARY_INVERSE_CHIP,
  RING_TEXT,
  SOFT_CHIP,
  SOLID_CHIP,
  SOLID_FILL_HEX,
  isHue,
  type Hue,
} from "./hues";

// ------------------------------------------------------------
// Colour helpers: OKLCH -> sRGB (clipped, as browsers and Tailwind's own hex
// fallbacks do) and the WCAG 2.x contrast ratio.
// ------------------------------------------------------------
type Rgb = [number, number, number];

function parseOklch(value: string): Rgb {
  const m = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value);
  if (!m) throw new Error(`not an oklch() colour: ${value}`);
  const L = m[2] === "%" ? Number(m[1]) / 100 : Number(m[1]);
  const C = Number(m[3]);
  const h = (Number(m[4]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const encode = (x: number) => {
    const c = Math.min(1, Math.max(0, x));
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
  };
  return [encode(linear[0]), encode(linear[1]), encode(linear[2])];
}

function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function parseColor(value: string): Rgb {
  return value.trim().startsWith("#") ? parseHex(value.trim()) : parseOklch(value);
}

function toHex(rgb: Rgb): string {
  return "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Light-mode token values from the first :root block of globals.css.
const GLOBALS = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
const ROOT_BLOCK = (() => {
  const start = GLOBALS.indexOf(":root {");
  const end = GLOBALS.indexOf("}", start);
  if (start < 0 || end < 0) throw new Error("globals.css has no :root block");
  return GLOBALS.slice(start, end);
})();

function rootToken(name: string): string {
  const m = new RegExp(`\\n\\s*--${name}:\\s*([^;]+);`).exec(ROOT_BLOCK);
  if (!m) throw new Error(`--${name} not found in :root`);
  return m[1].trim();
}

const PALETTE = colors as unknown as Record<string, Record<string, string>>;

/** The colour class a SOLID_CHIP entry fills with, resolved to its light-mode value. */
function solidFill(hue: Hue): { token: string; rgb: Rgb } {
  const classes = SOLID_CHIP[hue].split(/\s+/);
  const bg = classes.filter((c) => c.startsWith("bg-"));
  expect(bg, `${hue}: exactly one bg- class`).toHaveLength(1);
  const token = bg[0].slice(3);
  if (token === "primary") return { token, rgb: parseColor(rootToken("primary")) };
  if (token === "gold") return { token, rgb: parseColor(rootToken("gold")) };
  const m = /^([a-z]+)-(\d{2,3})$/.exec(token);
  if (!m) throw new Error(`${hue}: unexpected fill token "${token}"`);
  const value = PALETTE[m[1]]?.[m[2]];
  if (!value) throw new Error(`${hue}: fill token "${token}" is not a Tailwind palette colour`);
  return { token, rgb: parseColor(value) };
}

// The fill step of every solid chip, pinned (R4).
const EXPECTED_FILL: Record<Hue, string> = {
  brand: "primary",
  gold: "gold",
  blue: "blue-500",
  indigo: "indigo-500",
  amber: "amber-600",
  emerald: "emerald-600",
  teal: "teal-600",
  pink: "pink-500",
  cyan: "cyan-600",
  rose: "rose-500",
  red: "red-500",
  slate: "slate-500",
};

const WHITE: Rgb = [255, 255, 255];
const PALETTE_HUES = HUES.filter((h) => h !== "brand" && h !== "gold");
const MAPS = { SOLID_CHIP, SOFT_CHIP, HOVER_EDGE, SOLID_FILL_HEX, RING_TEXT } as const;

describe("hue maps", () => {
  it.each(Object.entries(MAPS))("%s has exactly one entry per Hue", (_name, map) => {
    expect(Object.keys(map).sort()).toEqual([...HUES].sort());
    for (const hue of HUES) expect(map[hue], hue).toMatch(/\S/);
  });

  it("no value is an interpolated or arbitrary-pixel class", () => {
    const values = [...Object.values(MAPS).flatMap((m) => Object.values(m)), PRIMARY_INVERSE_CHIP];
    for (const v of values) {
      expect(v).not.toContain("${");
      expect(v).not.toMatch(/text-\[\d+px\]/);
    }
  });

  it("the source writes every class string as a plain literal", () => {
    const source = readFileSync(fileURLToPath(new URL("./hues.ts", import.meta.url)), "utf8");
    expect(source).not.toContain("${");
    expect(source).not.toContain("`");
  });

  it("isHue accepts every Hue and nothing else", () => {
    for (const hue of HUES) expect(isHue(hue)).toBe(true);
    for (const bad of ["violet", "", "Blue", undefined, null, 3]) expect(isHue(bad)).toBe(false);
  });
});

describe("solid chips (R4)", () => {
  it.each([...HUES])("%s: SOLID_FILL_HEX is the real light-mode fill of its class", (hue) => {
    expect(toHex(solidFill(hue).rgb)).toBe(SOLID_FILL_HEX[hue].toLowerCase());
  });

  it.each([...HUES])("%s: white ink on the light fill reaches 3:1", (hue) => {
    // gold in dark mode fails with white (about 1.9:1); the token handles it
    // with dark:text-gold-foreground, checked below.
    expect(contrast(WHITE, parseHex(SOLID_FILL_HEX[hue]))).toBeGreaterThanOrEqual(3);
  });

  it("brand's own ink (--primary-foreground) also reaches 3:1 on plum", () => {
    expect(contrast(parseColor(rootToken("primary-foreground")), parseHex(SOLID_FILL_HEX.brand))).toBeGreaterThanOrEqual(3);
  });

  it.each(Object.entries(EXPECTED_FILL))("%s fills with %s", (hue, token) => {
    // amber, emerald, teal and cyan at -600; blue, indigo, pink and slate at
    // -500; brand and gold on their tokens.
    expect(solidFill(hue as Hue).token).toBe(token);
  });

  it("the -500 step really fails 3:1 for the four hues moved to -600", () => {
    for (const hue of ["amber", "emerald", "teal", "cyan"]) {
      expect(contrast(WHITE, parseColor(PALETTE[hue]["500"]))).toBeLessThan(3);
    }
  });

  it("ink: white on palette hues and light gold, the espresso token on dark gold, the token on brand", () => {
    for (const hue of PALETTE_HUES) expect(SOLID_CHIP[hue].split(/\s+/)).toContain("text-white");
    const gold = SOLID_CHIP.gold.split(/\s+/);
    expect(gold).toContain("text-white");
    expect(gold).toContain("dark:text-gold-foreground");
    expect(SOLID_CHIP.brand.split(/\s+/)).toContain("text-primary-foreground");
  });

  it("dark gold really needs the dark ink", () => {
    const darkBlock = GLOBALS.slice(GLOBALS.indexOf(".dark {"));
    const m = /\n\s*--gold:\s*([^;]+);/.exec(darkBlock);
    if (!m) throw new Error("--gold not found in .dark");
    expect(contrast(WHITE, parseColor(m[1]))).toBeLessThan(3);
  });

  it.each([...HUES])("%s: tinted shadow in light mode, no glow in dark mode", (hue) => {
    const classes = SOLID_CHIP[hue].split(/\s+/);
    expect(classes).toContain("shadow-md");
    expect(classes).toContain("dark:shadow-none");
    expect(classes.filter((c) => /^shadow-[a-z]+(-\d{3})?\/20$/.test(c))).toHaveLength(1);
  });
});

describe("hover edges", () => {
  it.each([...HUES])("%s: the pill's hover border follows the fill step", (hue) => {
    const m = /^hover:border-([a-z]+(?:-\d{3})?)\/40$/.exec(HOVER_EDGE[hue]);
    expect(m, HOVER_EDGE[hue]).not.toBeNull();
    expect(m?.[1]).toBe(solidFill(hue).token);
  });
});

describe("soft chips", () => {
  it.each([...HUES])("%s: a pale wash with a dark-mode variant", (hue) => {
    const classes = SOFT_CHIP[hue].split(/\s+/);
    expect(classes.some((c) => c.startsWith("bg-"))).toBe(true);
    expect(classes.some((c) => c.startsWith("text-"))).toBe(true);
    expect(classes.some((c) => c.startsWith("dark:bg-"))).toBe(true);
    // A soft chip never uses white ink: it sits on a pale wash.
    expect(classes).not.toContain("text-white");
  });
});
