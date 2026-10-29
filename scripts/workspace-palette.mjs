// ============================================================
// Workspace palette: the calm hue scales that replace Tailwind's default
// colours inside the team workspace (Workspace v3, 2026-10-30).
// ------------------------------------------------------------
// The team app carries ~4,700 hard-coded hue utilities (text-emerald-600,
// bg-indigo-50, border-amber-200 …) across ~385 files. Tailwind v4 compiles
// each one to var(--color-<hue>-<step>), so redefining those variables
// recolours every call site at once, with no page edits:
//
//   indigo, violet, purple, fuchsia, pink  → plum   (the brand accent)
//   blue, sky                              → info   (calm blue)
//   teal, cyan                             → sage   (quiet decorative)
//   green, emerald, lime                   → ok     (success)
//   amber, yellow                          → warn   (attention)
//   orange                                 → ember  (attention, warmer)
//   red, rose                              → bad    (errors, overdue)
//   slate, gray, zinc, neutral, stone      → stone  (plum-biased greys)
//
// Each scale keeps Tailwind's lightness ladder, so `dark:` variants that pick
// a step (dark:text-emerald-300) still land where their author meant, but
// with far less chroma, and the 600/700 text steps are ≥ 4.5:1 on white.
//
// Usage:
//   node scripts/workspace-palette.mjs report   contrast table
//   node scripts/workspace-palette.mjs css      the block pasted into globals.css
// ============================================================

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const L = { 50: 0.975, 100: 0.948, 200: 0.9, 300: 0.83, 400: 0.72, 500: 0.62, 600: 0.535, 700: 0.465, 800: 0.405, 900: 0.355, 950: 0.26 };
// Warm hues sit lighter at the same step (as in Tailwind), but 600+ are pulled
// down so amber text is readable instead of 3:1.
const L_WARM = { 50: 0.977, 100: 0.952, 200: 0.91, 300: 0.85, 400: 0.775, 500: 0.71, 600: 0.56, 700: 0.49, 800: 0.43, 900: 0.375, 950: 0.275 };
const L_STONE = { 50: 0.975, 100: 0.958, 200: 0.918, 300: 0.865, 400: 0.72, 500: 0.555, 600: 0.47, 700: 0.4, 800: 0.32, 900: 0.25, 950: 0.18 };

// Chroma envelope: soft tints, restrained mids; scaled per hue.
const C = { 50: 0.014, 100: 0.028, 200: 0.05, 300: 0.078, 400: 0.105, 500: 0.122, 600: 0.125, 700: 0.118, 800: 0.102, 900: 0.085, 950: 0.06 };

const SCALES = {
  plum: { h: 350, k: 1.0, l: L, hues: ["indigo", "violet", "purple", "fuchsia", "pink"] },
  info: { h: 252, k: 0.92, l: L, hues: ["blue", "sky"] },
  sage: { h: 190, k: 0.55, l: L, hues: ["teal", "cyan"] },
  ok: { h: 158, k: 0.88, l: L, hues: ["green", "emerald", "lime"] },
  warn: { h: 68, k: 1.0, l: L_WARM, hues: ["amber", "yellow"] },
  ember: { h: 50, k: 1.0, l: L_WARM, hues: ["orange"] },
  bad: { h: 27, k: 1.25, l: L, hues: ["red", "rose"] },
  stone: { h: 340, k: 0.06, l: L_STONE, hues: ["slate", "gray", "zinc", "neutral", "stone"] },
};

function steps(scale) {
  return STEPS.map((step) => {
    const l = scale.l[step];
    const c = +(C[step] * scale.k).toFixed(4);
    return { step, l, c, css: `oklch(${l} ${c} ${scale.h})` };
  });
}

// --- contrast report ---------------------------------------------------------

function oklchToLinearSrgb(l, c, h) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((x) => Math.min(1, Math.max(0, x)));
}
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hex = (lin) =>
  "#" + lin.map((x) => Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, "0")).join("");

const mode = process.argv[2];

if (mode === "report") {
  const DARK_CARD = luminance([0.0094, 0.0075, 0.0088]); // #181417
  for (const [name, scale] of Object.entries(SCALES)) {
    const cells = steps(scale).map(({ step, l, c }) => {
      const lin = oklchToLinearSrgb(l, c, scale.h);
      const y = luminance(lin);
      return `${step} ${hex(lin)} ${contrast(y, 1).toFixed(1)}/${contrast(y, DARK_CARD).toFixed(1)}`;
    });
    console.log(`${name.padEnd(6)} ${cells.join(" · ")}`);
  }
} else if (mode === "css") {
  const lines = [];
  for (const [name, scale] of Object.entries(SCALES)) {
    lines.push(`  /* ${name}: ${scale.hues.join(", ")} */`);
    for (const { step, css } of steps(scale)) {
      lines.push(`  ${scale.hues.map((hue) => `--color-${hue}-${step}: ${css};`).join(" ")}`);
    }
  }
  console.log(lines.join("\n"));
} else {
  console.log("usage: node scripts/workspace-palette.mjs report|css");
}
