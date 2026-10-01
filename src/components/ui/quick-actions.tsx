import * as React from "react";
import Link from "next/link";
import { ArrowRight, MoreHorizontal, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/permissions";
import { HOVER_EDGE, type Hue } from "@/lib/ui/hues";
import { IconChip } from "@/components/ui/icon-chip";
import { MODULES, resolveModule, type ModuleKey } from "@/config/modules";

// ============================================================
// QuickActions: a page's action cluster (the dashboard's pill row, shared).
// ------------------------------------------------------------
// One cluster per landing, passed to PageHeader's `actions` slot:
//   [leading dialog/button pills] [link pills] [More menu]
//
// Rules this file holds (design spec R5-R9):
// - At most 3 pills plus an optional "More" menu on a landing. Pill 1 is the
//   page's main create action, drawn as the filled primary pill.
// - Labels are verbs in sentence case ("New lead", "Import"); ActionLabel
//   makes a noun label a type error. Pills that only navigate are the
//   sidebar's job. The /dashboard hub is the one exception (`hub`).
// - A pill's chip is its DESTINATION's module chip, resolved from the href
//   through src/config/modules.ts. Pages never pick a pill's icon or colour.
// - Who sees a pill is decided by the page with visibleActions()
//   (src/lib/permission-claims.ts), the same override-aware rule middleware
//   uses. This file only renders what it is given (and drops `when: false`).
// - The accessible name is the label alone; the hint is the description
//   (aria-describedby). The row is a list labelled "Page actions".
// - The row wraps; it never scrolls sideways and never clips a focus ring.
//
// Server-safe: no "use client" and no hooks, so a server page can render the
// cluster directly and a client component can render QuickActionButton.
// A pill that triggers a dialog (`<DialogTrigger asChild>`) must be CREATED in
// the client component that owns the dialog, never passed in from a server
// page as a `trigger` prop: once the page's payload ahead of it passes about
// 3.2 KB, React Flight serialises a server-built element as a lazy reference,
// and Radix Slot (1.2.3) renders a lazy child as nothing, so the button
// silently disappears.
// Every class string is a literal; text-size utilities are never passed
// through cn(), because tailwind-merge drops text-meta/text-detail when a
// text colour follows them.
// ============================================================

/** The verbs a page action label may start with. */
export const ACTION_VERBS = [
  "New",
  "Add",
  "Import",
  "Record",
  "Schedule",
  "Create",
  "Sync",
  "Score",
  "Run",
  "Upload",
  "Export",
  "Book",
] as const;

export type ActionVerb = (typeof ACTION_VERBS)[number];

/** A verb, optionally followed by an object: "Import", "New lead", "Add employee". */
export type ActionLabel = ActionVerb | `${ActionVerb} ${string}`;

export function isActionLabel(label: string): label is ActionLabel {
  return ACTION_VERBS.some((verb) => label === verb || label.startsWith(`${verb} `));
}

type ActionSpecFields = {
  /** Destination. Also decides the pill's chip (its module's glyph and hue). */
  href: string;
  /** One short line in a command voice ("Add an enquiry"), at most 24 characters. */
  hint?: string;
  /**
   * Read by visibleActions(), not here. Omitted: the destination's route
   * permission. A permission: required as well (a stricter check the page
   * makes). null: no check.
   */
  permission?: Permission | null;
  /** false hides the pill (feature flag, module setup state). */
  when?: boolean;
  /** The page's main create action: the filled plum pill with a Plus chip. */
  primary?: boolean;
  /** Use this module's chip instead of the one resolved from `href`. */
  module?: ModuleKey;
};

/** A landing-page action: a verb label. */
export type QuickActionSpec = ActionSpecFields & { label: ActionLabel };

/**
 * A /dashboard hub shortcut. The hub is not a module landing, so its pills may
 * name a destination ("Payments") and it may show more than three. Use only
 * with `<QuickActions hub …>`.
 */
export type HubActionSpec = ActionSpecFields & { label: string };

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

// pointer-coarse: a 44px touch target on phones and tablets, matching the
// app-wide coarse-pointer minimum that buttons already get in globals.css, so
// link pills, button pills and the More trigger share one row height there.
const PILL_BASE =
  "group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-[background-color,border-color,scale] active:scale-95 disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11";
const PILL_SECONDARY = "border-border bg-card hover:bg-muted/40";
const PILL_PRIMARY = "border-primary bg-primary hover:bg-primary/90";

const LABEL_SECONDARY = "text-detail font-semibold leading-tight text-foreground";
const LABEL_PRIMARY = "text-detail font-semibold leading-tight text-primary-foreground";
const HINT_SECONDARY = "hidden text-meta leading-tight text-muted-foreground sm:block";
const HINT_PRIMARY = "hidden text-meta leading-tight text-primary-foreground/80 sm:block";

// Square, and the same height as a pill without a hint (1px border + 6px
// padding + 28px box); 44px square on a coarse pointer.
const MORE_TRIGGER =
  "flex shrink-0 items-center justify-center rounded-xl border border-border bg-card p-1.5 text-muted-foreground transition-[background-color,border-color,scale] hover:bg-muted/40 hover:text-foreground active:scale-95 data-[state=open]:bg-muted/40 data-[state=open]:text-foreground disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:min-w-11";

const LIST =
  "flex flex-wrap items-center gap-2 [&:not(:has(a,button))]:hidden";
// `flex` so a fragment of several buttons in one slot still lines up in a
// row; `empty:hidden` so a slot whose component rendered nothing leaves no gap.
const ITEM = "flex shrink-0 items-center gap-2 empty:hidden";

// A pill whose destination belongs to no module (rare: the hub, an external
// link) gets a neutral chip.
const FALLBACK_GLYPH: LucideIcon = ArrowRight;
const FALLBACK_HUE: Hue = "slate";

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "action"
  );
}

/**
 * The id of a pill's hint, "qa-<label>-hint". Deterministic (no useId), so the
 * cluster stays hook-free. QuickActions suffixes a repeat within one row.
 */
export function quickActionHintId(label: string): string {
  return `qa-${slug(label)}-hint`;
}

// ---------------------------------------------------------------------------
// Pill content
// ---------------------------------------------------------------------------

function chipFor(moduleKey: ModuleKey | undefined, href: string | undefined) {
  const key = resolveModule(moduleKey ?? href);
  return key ? MODULES[key] : null;
}

function PillBody({
  primary,
  glyph,
  hue,
  label,
  hint,
  hintId,
}: {
  primary: boolean;
  glyph: LucideIcon | React.ReactElement;
  hue: Hue;
  label: string;
  hint?: string;
  hintId: string;
}) {
  return (
    <>
      {primary ? (
        <IconChip icon={Plus} hue="brand" size="sm" tone="inverse" />
      ) : (
        <IconChip icon={glyph} hue={hue} size="sm" tone="solid" />
      )}
      <span className="flex min-w-0 flex-col">
        <span className={primary ? LABEL_PRIMARY : LABEL_SECONDARY}>{label}</span>
        {hint && (
          <span id={hintId} className={primary ? HINT_PRIMARY : HINT_SECONDARY}>
            {hint}
          </span>
        )}
      </span>
    </>
  );
}

function PillLink({ action, hintId }: { action: HubActionSpec; hintId: string }) {
  const primary = Boolean(action.primary);
  const mod = chipFor(action.module, action.href);
  const hue: Hue = mod?.hue ?? FALLBACK_HUE;

  return (
    <Link
      href={action.href}
      aria-label={action.label}
      aria-describedby={action.hint ? hintId : undefined}
      data-slot="quick-action"
      data-variant={primary ? "primary" : "secondary"}
      className={cn(PILL_BASE, primary ? PILL_PRIMARY : PILL_SECONDARY, !primary && HOVER_EDGE[hue])}
    >
      <PillBody
        primary={primary}
        glyph={mod?.icon ?? FALLBACK_GLYPH}
        hue={hue}
        label={action.label}
        hint={action.hint}
        hintId={hintId}
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// QuickActionButton
// ---------------------------------------------------------------------------

export interface QuickActionButtonProps
  extends Omit<React.ComponentPropsWithoutRef<"button">, "children"> {
  label: ActionLabel;
  hint?: string;
  /** primary: the page's main create action (filled plum, Plus chip). */
  variant?: "primary" | "secondary";
  /**
   * Secondary only: the chip glyph (a Lucide icon or an element, e.g. a
   * spinner while pending). Defaults to `module`'s glyph. The primary pill
   * always shows a Plus.
   */
  icon?: LucideIcon | React.ReactElement;
  /** Secondary only: the module whose hue (and default glyph) the chip wears. */
  module?: ModuleKey;
  /** Override the hint id when one page renders two pills with the same label. */
  hintId?: string;
}

/**
 * A pill that is a <button>: a dialog trigger (`<DialogTrigger asChild>`), or
 * a client action such as "Sync leads". Put it in QuickActions' `leading`.
 * As a dialog trigger, create it inside the client dialog component (see
 * NewKitchenPlanDialog), not on a server page: a server-built element can
 * reach the client as a lazy Flight reference, which Radix Slot renders as
 * nothing. data-slot and data-variant are set after the spread props, so an
 * asChild trigger's own data-slot ("dialog-trigger") cannot replace them.
 */
export const QuickActionButton = React.forwardRef<HTMLButtonElement, QuickActionButtonProps>(
  function QuickActionButton(
    { label, hint, variant = "secondary", icon, module: moduleKey, hintId, className, type = "button", ...rest },
    ref
  ) {
    const primary = variant === "primary";
    const mod = moduleKey ? MODULES[moduleKey] : null;
    const hue: Hue = mod?.hue ?? FALLBACK_HUE;
    const id = hintId ?? quickActionHintId(label);

    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-describedby={hint ? id : undefined}
        {...rest}
        data-slot="quick-action"
        data-variant={primary ? "primary" : "secondary"}
        className={cn(PILL_BASE, primary ? PILL_PRIMARY : PILL_SECONDARY, !primary && HOVER_EDGE[hue], className)}
      >
        <PillBody
          primary={primary}
          glyph={icon ?? mod?.icon ?? FALLBACK_GLYPH}
          hue={hue}
          label={label}
          hint={hint}
          hintId={id}
        />
      </button>
    );
  }
);

// ---------------------------------------------------------------------------
// PageMoreMenuTrigger
// ---------------------------------------------------------------------------

export type PageMoreMenuTriggerProps = Omit<React.ComponentPropsWithoutRef<"button">, "children">;

/**
 * The "More actions" button at the end of the cluster, for maintenance tools
 * (recompute, clean up, repair, demo data). Use it as
 * `<DropdownMenuTrigger asChild><PageMoreMenuTrigger /></DropdownMenuTrigger>`
 * and pass the whole menu as QuickActions' `more`. data-slot is set after the
 * spread props, so the trigger's data-slot ("dropdown-menu-trigger") cannot
 * replace it.
 */
export const PageMoreMenuTrigger = React.forwardRef<HTMLButtonElement, PageMoreMenuTriggerProps>(
  function PageMoreMenuTrigger({ className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label="More actions"
        {...rest}
        data-slot="page-more-trigger"
        className={cn(MORE_TRIGGER, className)}
      >
        <span className="flex size-7 items-center justify-center" aria-hidden>
          <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden />
        </span>
      </button>
    );
  }
);

// ---------------------------------------------------------------------------
// QuickActions
// ---------------------------------------------------------------------------

interface QuickActionsSlots {
  /**
   * Pills rendered before the link pills, each child in its own list item:
   * the dialog-trigger primary (a client dialog that builds its own
   * QuickActionButton trigger, e.g. `<NewKitchenPlanDialog />`), or client
   * buttons such as "Sync leads". Never pass a server-built QuickActionButton
   * into a client dialog's `asChild` trigger (see QuickActionButton).
   */
  leading?: React.ReactNode;
  /** The "More" menu (a DropdownMenu around PageMoreMenuTrigger). Always last. */
  more?: React.ReactNode;
  className?: string;
}

export type QuickActionsProps =
  | (QuickActionsSlots & {
      /** Link pills, already filtered with visibleActions(). At most 3 pills in all. */
      actions?: readonly QuickActionSpec[];
      hub?: false;
    })
  | (QuickActionsSlots & {
      actions?: readonly HubActionSpec[];
      /**
       * The /dashboard hub only. It is not a module landing, so the landing
       * limits (3 pills, verb labels) do not apply to its shortcuts.
       */
      hub: true;
    });

const DEV = process.env.NODE_ENV !== "production";
const HINT_MAX = 24;

/** Development-only checks of the cluster rules; silent in production. */
function checkRow(actions: readonly HubActionSpec[], leadingCount: number, hub: boolean) {
  if (!DEV) return;
  const problems: string[] = [];
  const pills = actions.length + leadingCount;
  if (!hub && pills > 3) {
    problems.push(`${pills} pills; a landing shows at most 3 plus a "More" menu. Move the rest into More.`);
  }
  const primaries = actions.filter((a) => a.primary);
  if (primaries.length > 1) problems.push("more than one primary pill; only the main create action is primary.");
  if (primaries.length > 0 && !actions[0].primary) problems.push("the primary pill must come first.");
  const hinted = actions.filter((a) => a.hint).length;
  if (hinted > 0 && hinted < actions.length) problems.push("hints go on every pill in the row or on none.");
  for (const a of actions) {
    if (!hub && !isActionLabel(a.label)) {
      problems.push(`"${a.label}" does not start with a verb (${ACTION_VERBS.join("/")}).`);
    }
    if (a.hint && a.hint.length > HINT_MAX) {
      problems.push(`hint "${a.hint}" is longer than ${HINT_MAX} characters.`);
    }
  }
  if (problems.length) console.error(`QuickActions: ${problems.join(" ")}`);
}

/**
 * The page's action cluster: `<ul role="list" aria-label="Page actions">`.
 * Returns null when every slot is empty. Pass it to PageHeader's `actions`.
 */
export function QuickActions(props: QuickActionsProps) {
  const { leading, more, className } = props;
  const hub = props.hub === true;
  // A landing spec is a hub spec with a narrower label, so one list type
  // serves both from here on.
  const given: readonly HubActionSpec[] = props.actions ?? [];
  const actions = given.filter((a) => a.when !== false);
  const leadingItems = React.Children.toArray(leading);
  const hasMore = more !== undefined && more !== null && more !== false;

  if (actions.length === 0 && leadingItems.length === 0 && !hasMore) return null;
  checkRow(actions, leadingItems.length, hub);

  // Hint ids are unique within the row: a repeated label gets a suffix.
  const seen = new Map<string, number>();
  const hintIds = actions.map((a) => {
    const base = slug(a.label);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? `qa-${base}-hint` : `qa-${base}-${n}-hint`;
  });

  return (
    <ul role="list" aria-label="Page actions" data-slot="page-actions" className={cn(LIST, className)}>
      {leadingItems.map((node, i) => (
        <li key={React.isValidElement(node) && node.key != null ? node.key : `leading-${i}`} className={ITEM}>
          {node}
        </li>
      ))}
      {actions.map((action, i) => (
        <li key={`${action.href}|${action.label}`} className={ITEM}>
          <PillLink action={action} hintId={hintIds[i]} />
        </li>
      ))}
      {hasMore && <li className={ITEM}>{more}</li>}
    </ul>
  );
}
