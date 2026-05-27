/**
 * App Icon Generator for Veloria Grand
 *
 * Generates PNG icons at multiple sizes from an SVG template.
 * Uses Node.js canvas (via sharp or canvas) to produce icons.
 *
 * Usage: npx tsx scripts/generate-icons.ts
 *
 * Since we may not have canvas/sharp available, this script generates
 * SVG icons and converts them using the system's built-in tools,
 * or creates placeholder PNGs that can be replaced with final designs.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const PUBLIC_DIR = join(__dirname, "..", "public");
const ICONS_DIR = join(PUBLIC_DIR, "icons");

// Ensure directories exist
if (!existsSync(ICONS_DIR)) {
  mkdirSync(ICONS_DIR, { recursive: true });
}

// SVG template for the Veloria Grand icon
// Purple gradient background with white "VG" monogram
function generateSVG(size: number): string {
  const fontSize = Math.round(size * 0.35);
  const borderRadius = Math.round(size * 0.2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c3aed"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${borderRadius}" fill="url(#bg)"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif" font-weight="700"
    font-size="${fontSize}" fill="white" letter-spacing="${Math.round(size * 0.02)}">
    VG
  </text>
</svg>`;
}

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

console.log("Generating Veloria Grand app icons...\n");

for (const size of sizes) {
  const svg = generateSVG(size);
  const filename =
    size === 180 ? "apple-touch-icon.svg" : `icon-${size}x${size}.svg`;
  const filepath =
    size === 180 ? join(PUBLIC_DIR, filename) : join(ICONS_DIR, filename);

  writeFileSync(filepath, svg);
  console.log(`  ✓ ${filename} (${size}×${size})`);
}

// Also generate a 32x32 favicon SVG
const faviconSVG = generateSVG(32);
writeFileSync(join(PUBLIC_DIR, "favicon.svg"), faviconSVG);
console.log("  ✓ favicon.svg (32×32)");

console.log(
  "\nSVG icons generated! To convert to PNG, use one of these methods:"
);
console.log(
  "  1. Online: https://cloudconvert.com/svg-to-png (batch upload)"
);
console.log("  2. CLI: npx svgexport icon.svg icon.png (per file)");
console.log(
  '  3. macOS: sips -s format png icon.svg --out icon.png --resampleWidth SIZE"'
);
console.log(
  "\nFor now, the SVGs work as web icons. PNG conversion needed for native apps."
);
