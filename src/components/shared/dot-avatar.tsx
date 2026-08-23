import { cn } from "@/lib/utils";

// ============================================================
// DotAvatar — deterministic-color avatar with initials
// ----------------------------------------------------------------
// Hashes a stable input (id or name) to a soft, harmonized hue.
// All avatars share a desaturated palette so the list reads calm,
// not festive.
// ============================================================

// Each entry carries a dark variant (dark tint bg + light text) so initials stay
// legible in dark mode (SC-02).
const PALETTE = [
  { bg: "bg-indigo-100 dark:bg-indigo-950/60",   text: "text-indigo-700 dark:text-indigo-300"  },
  { bg: "bg-blue-100 dark:bg-blue-950/60",       text: "text-blue-700 dark:text-blue-300"    },
  { bg: "bg-sky-100 dark:bg-sky-950/60",         text: "text-sky-700 dark:text-sky-300"     },
  { bg: "bg-cyan-100 dark:bg-cyan-950/60",       text: "text-cyan-700 dark:text-cyan-300"    },
  { bg: "bg-teal-100 dark:bg-teal-950/60",       text: "text-teal-700 dark:text-teal-300"    },
  { bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-amber-100 dark:bg-amber-950/60",     text: "text-amber-700 dark:text-amber-300"   },
  { bg: "bg-orange-100 dark:bg-orange-950/60",   text: "text-orange-700 dark:text-orange-300"  },
  { bg: "bg-rose-100 dark:bg-rose-950/60",       text: "text-rose-700 dark:text-rose-300"    },
  { bg: "bg-pink-100 dark:bg-pink-950/60",       text: "text-pink-700 dark:text-pink-300"    },
  { bg: "bg-violet-100 dark:bg-violet-950/60",   text: "text-violet-700 dark:text-violet-300"  },
] as const;

const SIZE_CLASSES = {
  xs: "size-5 text-meta",
  sm: "size-6 text-meta",
  md: "size-7 text-meta",
  lg: "size-9 text-detail",
} as const;

type Size = keyof typeof SIZE_CLASSES;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface DotAvatarProps {
  /** Stable identity used to pick the color (e.g. user id or email). */
  seed: string;
  /** Display name — first/last initials are extracted from it. */
  name?: string | null;
  size?: Size;
  className?: string;
  /** Optional explicit initials override. */
  text?: string;
}

export function DotAvatar({
  seed,
  name,
  size = "sm",
  className,
  text,
}: DotAvatarProps) {
  const idx = hashString(seed) % PALETTE.length;
  const c = PALETTE[idx]!;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]",
        c.bg,
        c.text,
        SIZE_CLASSES[size],
        className
      )}
      aria-hidden
    >
      {text ?? initials(name)}
    </span>
  );
}

// Stacked avatar group (for "assigned to multiple" later)
export function DotAvatarStack({
  items,
  size = "sm",
  max = 3,
  className,
}: {
  items: Array<{ seed: string; name?: string | null }>;
  size?: Size;
  max?: number;
  className?: string;
}) {
  const shown = items.slice(0, max);
  const overflow = items.length - shown.length;
  return (
    <div className={cn("flex -space-x-1.5", className)}>
      {shown.map((it, i) => (
        <DotAvatar
          key={i}
          seed={it.seed}
          name={it.name}
          size={size}
          className="ring-2 ring-background"
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-medium ring-2 ring-background",
            SIZE_CLASSES[size]
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
