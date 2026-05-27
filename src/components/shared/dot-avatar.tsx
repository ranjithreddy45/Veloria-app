import { cn } from "@/lib/utils";

// ============================================================
// DotAvatar — deterministic-color avatar with initials
// ----------------------------------------------------------------
// Hashes a stable input (id or name) to a soft, harmonized hue.
// All avatars share a desaturated palette so the list reads calm,
// not festive.
// ============================================================

const PALETTE = [
  { bg: "bg-indigo-100",  text: "text-indigo-700"  },
  { bg: "bg-blue-100",    text: "text-blue-700"    },
  { bg: "bg-sky-100",     text: "text-sky-700"     },
  { bg: "bg-cyan-100",    text: "text-cyan-700"    },
  { bg: "bg-teal-100",    text: "text-teal-700"    },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100",   text: "text-amber-700"   },
  { bg: "bg-orange-100",  text: "text-orange-700"  },
  { bg: "bg-rose-100",    text: "text-rose-700"    },
  { bg: "bg-pink-100",    text: "text-pink-700"    },
  { bg: "bg-violet-100",  text: "text-violet-700"  },
] as const;

const SIZE_CLASSES = {
  xs: "size-5 text-[9.5px]",
  sm: "size-6 text-[10px]",
  md: "size-7 text-[10.5px]",
  lg: "size-9 text-[12px]",
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
