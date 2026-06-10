import Image from "next/image";
import { cn } from "@/lib/utils";

// ============================================================
// VenueImage — image-forward venue visual (Zepto-style)
// ============================================================
// The Venue model has no photo field yet, so we deterministically map
// each venue to a curated, royalty-free event-space photo (Unsplash).
// Layered over a gradient so it looks polished while loading / if the
// image fails. When real photos are added, pass `src` directly.

const CURATED = [
  // elegant banquet / ballroom / wedding / reception imagery
  "photo-1519225421980-715cb0215aed",
  "photo-1464366400600-7168b8af9bc3",
  "photo-1511795409834-ef04bbd61622",
  "photo-1505236858219-8359eb29e329",
  "photo-1530103862676-de8c9debad1d",
  "photo-1492684223066-81342ee5ff30",
  "photo-1519671482749-fd09be7ccebf",
  "photo-1583939003579-730e3918a45a",
];

const GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-rose-500 to-orange-400",
  "from-indigo-500 to-sky-500",
  "from-emerald-500 to-teal-500",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

export function VenueImage({
  seed,
  alt,
  src,
  className,
  priority,
  sizes = "(max-width: 768px) 100vw, 448px",
}: {
  seed: string;
  alt: string;
  src?: string | null;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const h = hash(seed);
  const photoId = CURATED[h % CURATED.length];
  const gradient = GRADIENTS[h % GRADIENTS.length];
  const url =
    src ||
    `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=900&q=70`;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        gradient,
        className
      )}
    >
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
      {/* subtle bottom gradient so overlaid text/badges stay legible */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent"
      />
    </div>
  );
}
