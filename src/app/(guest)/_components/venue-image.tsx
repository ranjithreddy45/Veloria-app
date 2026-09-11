import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// VenueImage — venue visual
// ============================================================
// The Venue model has no photo field yet (the storefront action returns no
// imageUrl/photos), so we render a tasteful branded gradient placeholder
// showing the venue's name + a Building icon rather than a stock photo of
// some *other* venue. When a real image is available, pass `src` and it is
// rendered instead. NEVER fall back to an external stock photo.

const GRADIENTS = [
  "from-[#7a2160] via-[#6d1b52] to-[#4d1239]",
  "from-[#8a2a6a] via-[#6d1b52] to-[#3b0e2c]",
  "from-[#b88513] via-[#9a6d0f] to-[#6d1b52]",
  "from-[#5c1646] via-[#7b2262] to-[#b88513]",
  "from-[#4d1239] via-[#6d1b52] to-[#8a5a78]",
  "from-[#2a0b20] via-[#5c1646] to-[#7a2160]",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

export function VenueImage({
  seed,
  alt,
  name,
  src,
  className,
}: {
  seed: string;
  alt: string;
  /** Venue name shown on the placeholder when no real image exists. */
  name?: string;
  /** A REAL venue image URL. When absent, always render the placeholder. */
  src?: string | null;
  className?: string;
  /** Kept for call-site compatibility; background images need no priority hint. */
  priority?: boolean;
}) {
  const gradient = GRADIENTS[hash(seed) % GRADIENTS.length];

  // Real image path: a background image (v4), never next/image — uploads are
  // base64 data URLs the optimiser rejects, and a missing file must degrade to
  // the gradient rather than a broken glyph.
  if (src) {
    const safe = src.replace(/["\\]/g, "\\$&");
    return (
      <div role="img" aria-label={alt} className={cn("relative overflow-hidden bg-gradient-to-br", gradient, className)}>
        <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${safe}")` }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
      </div>
    );
  }

  // Branded placeholder — no external image.
  const label = (name ?? alt ?? "").trim();
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br text-white",
        gradient,
        className
      )}
      role="img"
      aria-label={alt}
    >
      {/* Soft radial pattern for depth */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_30%_20%,white_0,transparent_45%),radial-gradient(circle_at_80%_70%,white_0,transparent_40%)]"
      />
      <Building2 className="relative size-9 opacity-90 drop-shadow-sm" strokeWidth={1.8} />
      {label && (
        <span className="relative mt-2 max-w-[85%] truncate px-3 text-center font-editorial text-lede font-semibold drop-shadow-sm">
          {label}
        </span>
      )}
      {/* bottom gradient so overlaid text/badges stay legible */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent"
      />
    </div>
  );
}
