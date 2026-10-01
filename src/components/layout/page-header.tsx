import type React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Hue } from "@/lib/ui/hues";
import type { ModuleKey } from "@/config/modules";
import { ModuleChip } from "@/components/layout/module-chip";

// ============================================================
// PageHeader: the one header every page under src/app/(dashboard) uses.
// ------------------------------------------------------------
// Composition (one left edge):
//   eyebrow
//   [module chip] title [?]
//   description
//   meta row (only when `actions` is passed; holds `children`)
// with the action cluster to the right of that block.
//
// The module chip is NOT chosen by the page. ModuleChip (a small client
// island, so this file stays a server component) resolves it from the current
// route through src/config/modules.ts, longest prefix first. Pages pass
// `module` only to force another module's chip, or `module={false}` for none.
// The chip sits inside the title row as a sibling of the h1 (never inside it,
// and aria-hidden), so the eyebrow, title row and description all start at
// the content edge, and it is hidden below sm so a phone title starts at the
// 16px gutter.
//
// Colours: --primary is plum. Chip colours live only in src/lib/ui/hues.ts.
// ============================================================

/**
 * @deprecated The header chip's hue comes from src/config/modules.ts; the
 * `accent` prop is ignored. Kept as an alias so existing call sites still
 * type-check until the call-site cleanup removes them.
 */
export type HeaderAccent = Hue;

/**
 * The header's class strings, exported so PageHeaderSkeleton draws exactly the
 * same boxes and the two cannot drift. Full literals (Tailwind only generates
 * classes it can read in the source).
 */
export const PAGE_HEADER_CLASSES = {
  // min-w-0 on the wrapper AND the title column: without it a long unbroken
  // title (or a wide action button) sets the flex basis and pushes the whole
  // page into a horizontal scroll on a 375px screen. sm:flex-wrap plus a
  // minimum title width: a dense action row (lead detail has nine controls)
  // must wrap BELOW the title, never crush it into letter-by-letter breaks.
  root: "relative flex min-w-0 flex-col gap-4 pb-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
  // With an action cluster the cluster centres on the title block instead of
  // sitting on its baseline.
  rootWithActions:
    "relative flex min-w-0 flex-col gap-4 pb-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
  titleColumn: "min-w-0 space-y-2 sm:min-w-[280px] sm:flex-1",
  eyebrow: "text-meta font-semibold uppercase tracking-[0.06em] text-muted-foreground",
  // items-start: the 40px chip lines up with the h1's first line (39px at
  // sm and above) and stays there when a long title wraps.
  titleRow: "flex min-w-0 items-start gap-2.5",
  // The chip's own spacing, on top of the row gap (which also spaces the help
  // "?"), so chip-to-title is 14px.
  chip: "mr-1",
  // The chip's box: IconChip size "lg".
  chipBox: "size-10 rounded-xl",
  title: "large-title min-w-0 break-words text-h2 leading-tight text-foreground sm:text-h1",
  // self-center keeps the "?" centred on the title, as it was before the row
  // switched to items-start for the chip.
  help: "shrink-0 self-center",
  description: "max-w-2xl text-body leading-relaxed text-muted-foreground sm:text-copy",
  // `children` when the page also passes `actions`.
  meta: "flex flex-wrap items-center gap-2 empty:hidden",
  // `children` when the page passes no `actions` (unchanged right-side slot).
  // Actions wrap AND each child may shrink, so a header with three buttons
  // stacks into rows instead of running off a 375px screen.
  children: "relative flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto",
  // The action cluster. shrink-0 keeps it on one line beside the title; when
  // it does not fit beside a 280px title column, the root's flex-wrap moves the
  // whole cluster below the title block. max-w-full caps it at the content
  // width so it can never be clipped or scroll sideways.
  actions: "flex max-w-full shrink-0 items-center gap-2",
  // When nothing in the slot is clickable (every pill filtered out by
  // permissions, a menu that rendered nothing) the slot disappears instead of
  // leaving an empty box and its gap.
  actionsAutoHide: "[&:not(:has(a,button))]:hidden",
} as const;

const C = PAGE_HEADER_CLASSES;

interface PageHeaderProps {
  title: string;
  /** Supporting copy under the title. ReactNode (not just string) so callers can
   * inline links/emphasis instead of flattening rich content to a template string. */
  description?: React.ReactNode;
  /** Small uppercase label rendered above the title (Linear-style eyebrow). */
  eyebrow?: React.ReactNode;
  /**
   * The module whose chip to show. Omit it: the chip comes from the current
   * route via src/config/modules.ts. Pass a key only for a page that lives
   * outside its module's URL tree, or `false` for no chip.
   */
  module?: ModuleKey | false;
  /**
   * The page's action cluster, normally `<QuickActions … />`. It sits right of
   * the title block, vertically centred, and wraps below it as one row when it
   * does not fit. When it is passed, `children` render as a meta row under the
   * description instead of beside the actions.
   */
  actions?: React.ReactNode;
  /**
   * @deprecated Ignored. The chip comes from src/config/modules.ts via the
   * route; use `module` to override it.
   */
  icon?: LucideIcon;
  /**
   * @deprecated Ignored. The chip's hue comes from src/config/modules.ts; use
   * `module` to override it.
   */
  accent?: HeaderAccent;
  /**
   * Without `actions`: right-side controls (unchanged behaviour).
   * With `actions`: a meta row under the description.
   */
  children?: React.ReactNode;
  /** Optional help hint rendered as a "?" next to the title. */
  help?: React.ReactNode;
  /** @deprecated No-op. The header always sits on the plain canvas. */
  aura?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  module: moduleKey,
  actions,
  children,
  help,
  className,
}: PageHeaderProps) {
  const hasActions = Boolean(actions);

  return (
    <div className={cn(hasActions ? C.rootWithActions : C.root, className)}>
      <div className={C.titleColumn}>
        {eyebrow && <div className={C.eyebrow}>{eyebrow}</div>}
        {/* The help "?" must not be pushed off-screen by a long title, so the
            title takes the min-w-0/wrap and the hint stays shrink-0. */}
        <div className={C.titleRow}>
          <ModuleChip module={moduleKey} className={C.chip} />
          <h1 className={C.title}>{title}</h1>
          {help && <span className={C.help}>{help}</span>}
        </div>
        {description && <p className={C.description}>{description}</p>}
        {hasActions && children && <div className={C.meta}>{children}</div>}
      </div>
      {hasActions ? (
        <div className={cn(C.actions, C.actionsAutoHide)}>{actions}</div>
      ) : (
        children && <div className={C.children}>{children}</div>
      )}
    </div>
  );
}
