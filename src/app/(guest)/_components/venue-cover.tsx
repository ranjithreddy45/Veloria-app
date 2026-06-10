import { cn } from "@/lib/utils";

// ============================================================
// VenueCover — placeholder hero imagery
// ============================================================
// The Venue model has no photos yet, so we render a tasteful
// deterministic gradient with the venue's initial. When real photos
// are added (a Venue.images field), swap this for an <Image>.

const GRADIENTS = [
  "from-indigo-500 via-violet-500 to-fuchsia-500",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-emerald-400 via-teal-500 to-cyan-500",
  "from-sky-500 via-blue-600 to-indigo-600",
  "from-rose-400 via-pink-500 to-purple-500",
  "from-teal-400 via-cyan-500 to-sky-600",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

export function VenueCover({
  name,
  seed,
  className,
  rounded = true,
}: {
  name: string;
  seed: string;
  className?: string;
  rounded?: boolean;
}) {
  const gradient = GRADIENTS[hash(seed) % GRADIENTS.length];
  const initial = name.trim().charAt(0).toUpperCase() || "V";
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br text-white",
        gradient,
        rounded && "rounded-xl",
        className
      )}
    >
      {/* Soft pattern overlay for depth */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_30%_20%,white_0,transparent_45%),radial-gradient(circle_at_80%_70%,white_0,transparent_40%)]"
      />
      <span className="relative font-serif text-5xl font-semibold drop-shadow-sm">
        {initial}
      </span>
    </div>
  );
}
