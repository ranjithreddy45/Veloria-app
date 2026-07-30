// ============================================================
// Client-side image downscaling for the app's base64 upload pattern.
//
// WHY THIS EXISTS (this was a real, silent data-loss bug):
// Uploads in this app are read as base64 data-URLs and posted through a Next.js
// server action. Two ceilings sit in that path:
//   1. Next.js caps a server-action body (default 1 MB; see next.config.ts).
//   2. The hosting platform caps the request body independently, and that cap is
//      only a few MB — raising the Next.js limit cannot buy more than that.
// base64 also inflates the payload by roughly a third. So a single 3 MB phone
// photo arrives as ~4 MB and blows straight past the limit, and picking several
// photos at once (which the BD team asked for) makes it certain.
//
// Downscaling on the client is the fix that actually works: a 4000×3000 camera
// photo becomes a ~1600px long-edge JPEG of a few hundred KB, so a batch fits
// comfortably and the images still look right in a thumbnail grid or a property
// gallery. Raising the server limit alone would not have been enough.
//
// Only raster images are touched. PDFs (scanned contracts, certificates) and
// anything a canvas cannot decode are returned byte-for-byte unchanged, because
// re-encoding a document would corrupt it.
// ============================================================

/** Long-edge ceiling in px. 1600 keeps venue photos crisp at gallery size. */
const DEFAULT_MAX_EDGE = 1600;
/** JPEG quality. 0.82 is visually clean while cutting size by ~10x on photos. */
const DEFAULT_QUALITY = 0.82;
/** Below this, re-encoding usually costs more bytes than it saves. */
const SKIP_BELOW_BYTES = 300 * 1024;

export interface DownscaleOptions {
  maxEdge?: number;
  quality?: number;
}

/** Raster types a browser canvas can reliably decode and re-encode. */
const RE_ENCODABLE = /^image\/(png|jpe?g|webp)$/i;

/**
 * Reads `file` as a data-URL, downscaling it first when it is a large raster
 * image. Never throws for downscale reasons: if anything in the canvas path
 * fails (a decode error, a tainted or zero-size bitmap), it falls back to the
 * original bytes so an upload still succeeds — a slightly-too-big image beats a
 * failed save.
 */
export async function readImageAsDataUrl(
  file: File,
  opts: DownscaleOptions = {}
): Promise<string> {
  const original = await readAsDataUrl(file);

  // Leave documents and exotic formats (HEIC etc.) exactly as they are.
  if (!RE_ENCODABLE.test(file.type)) return original;
  // Small images: not worth a re-encode, which can even inflate a tuned PNG.
  if (file.size <= SKIP_BELOW_BYTES) return original;

  try {
    const shrunk = await downscaleDataUrl(original, opts);
    // Only take the new version if it is genuinely smaller. A graphic with flat
    // colour can come out LARGER as JPEG than as source PNG.
    return shrunk && shrunk.length < original.length ? shrunk : original;
  } catch {
    return original;
  }
}

/** Plain FileReader read — no transformation. */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

/** Human-readable size, for "skipped because too large" messages. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Rough decoded byte size of a base64 data-URL (for post-compression guards). */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

// ------------------------------------------------------------
// Canvas re-encode. Kept separate so the read path above stays readable.
// ------------------------------------------------------------
function downscaleDataUrl(
  dataUrl: string,
  { maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_QUALITY }: DownscaleOptions
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (!width || !height) return resolve(null);

      // Already within budget — nothing to gain from resizing, but a big JPEG
      // at low compression still benefits from a re-encode, so continue at 1:1.
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      // White backdrop: flattening a transparent PNG onto JPEG would otherwise
      // render the alpha areas black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(null); // tainted canvas — keep the original
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
