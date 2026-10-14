import Link from "next/link";
import { cn } from "@/lib/utils";

// ============================================================
// LinkSegments — a pill group of links (venue and period switchers).
// ------------------------------------------------------------
// Links, not buttons with state: the portal's filters live in the URL and the
// server page clamps them, so there is no client-callable code that takes a
// venue id. Styled like ViewTabs, but the group WRAPS rather than scrolling
// sideways: an owner has a handful of venues with long names, and a venue
// hidden off the edge of a phone scroller is one they never find. `grid`
// lays a short fixed set (the four periods) out as an even 2×2 on a phone.
// ============================================================

// Literal class strings picked per state, never merged through cn():
// tailwind-merge reads text-detail as a text colour and drops it when the
// active/idle colour follows. min-w-0 + break-words: a venue name longer than
// the phone is wide wraps inside its pill instead of widening the page.
// pointer-coarse: a 44px target for a thumb.
const SEGMENT =
  "inline-flex min-w-0 items-center justify-center break-words rounded-[10px] px-3 py-1.5 text-center text-detail font-medium transition-colors duration-150 pointer-coarse:min-h-11";
const SEGMENT_ACTIVE = `${SEGMENT} bg-card text-foreground shadow-card`;
const SEGMENT_IDLE = `${SEGMENT} text-muted-foreground hover:bg-background/70 hover:text-foreground`;

export interface LinkSegment {
  key: string;
  label: string;
  href: string;
}

export function LinkSegments({
  label,
  segments,
  active,
  grid = false,
  className,
}: {
  /** Accessible name of the group, e.g. "Venue". */
  label: string;
  segments: LinkSegment[];
  active: string;
  /** Two even columns below sm (for a short, fixed set of options). */
  grid?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "max-w-full gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5",
        grid ? "grid grid-cols-2 sm:inline-flex sm:items-center" : "inline-flex flex-wrap items-center",
        className
      )}
    >
      {segments.map((s) => {
        const isActive = s.key === active;
        return (
          <Link
            key={s.key}
            href={s.href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? SEGMENT_ACTIVE : SEGMENT_IDLE}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
