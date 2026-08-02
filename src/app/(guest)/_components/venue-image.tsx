import Image from "next/image";
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
  "from-violet-500 via-fuchsia-500 to-rose-500",
  "from-rose-500 via-orange-400 to-amber-400",
  "from-indigo-500 via-sky-500 to-cyan-500",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-sky-500 via-blue-600 to-indigo-600",
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
  priority,
  sizes = "(max-width: 768px) 100vw, 448px",
}: {
  seed: string;
  alt: string;
  /** Venue name shown on the placeholder when no real image exists. */
  name?: string;
  /** A REAL venue image URL. When absent, always render the placeholder. */
  src?: string | null;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const gradient = GRADIENTS[hash(seed) % GRADIENTS.length];

  // Real image path: only when a genuine src is supplied.
  if (src) {
    return (
      <div className={cn("relative overflow-hidden bg-gradient-to-br", gradient, className)}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent"
        />
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
        <span className="relative mt-2 max-w-[85%] truncate px-3 text-center font-serif text-lede font-semibold drop-shadow-sm">
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
