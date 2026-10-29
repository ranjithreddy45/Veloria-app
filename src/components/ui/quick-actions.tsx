import * as React from "react";
import Link from "next/link";
import { ArrowRight, MoreHorizontal, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/permissions";
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
// - A pill's glyph is its DESTINATION's module glyph, resolved from the href
//   through src/config/modules.ts. Pages never pick a pill's icon or colour.
//   The primary pill's glyph differs by context: on a landing it is a Plus
//   (R6), while on the /dashboard hub it is the destination's glyph like
//   every other hub pill (owner decision 3), so the hub's "New lead" shows the
//   leads glyph. With no module it falls back to Plus.
// - Who sees a pill is decided by the page with visibleActions()
//   (src/lib/permission-claims.ts), the same override-aware rule middleware
//   uses. This file only renders what it is given (and drops `when: false`).
// - The accessible name is the label alone; the hint is the description
//   (aria-describedby), read to screen readers only since Workspace v3 so the
//   row stays one quiet line. The row is a list labelled "Page actions".
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
// Every class string is a literal. (Text sizes once had to stay out of cn():
// tailwind-merge dropped text-meta/text-detail beside a text colour until
// src/lib/utils.ts taught it the type scale.)
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
  /** Destination. Also decides the pill's glyph (its module's icon). */
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
  /**
   * The page's main create action: the filled plum pill. Its glyph is a
   * Plus on a landing, and the destination's module glyph on the hub.
   */
  primary?: boolean;
  /** Use this module's glyph instead of the one resolved from `href`. */
  module?: ModuleKey;
};

/** A landing-page action: a verb label. */
export type QuickActionSpec = ActionSpecFields & { label: ActionLabel };

/**
 * A /dashboard hub shortcut. The hub is not a module landing, so its pills may
 * name a destination ("Payments") and it may show more than three, and a
 * primary hub pill wears its destination's glyph instead of a Plus. Use only
 * with `<QuickActions hub …>`.
 */
export type HubActionSpec = ActionSpecFields & { label: string };

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

// Workspace v3: a pill is a plain one-line button (36px), the same anatomy as
// <Button>: a white sheet with a hairline edge, or flat plum for the primary.
// The glyph is a bare icon, not a coloured chip, and the hint is read to
// screen readers only (aria-describedby), so a header row stays one quiet line.
// pointer-coarse: a 44px touch target on phones and tablets, matching the
// app-wide coarse-pointer minimum that buttons already get in globals.css, so
// link pills, button pills and the More trigger share one row height there.
const PILL_BASE =
  "group flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-3.5 text-left transition-[background-color,border-color,scale] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11";
const PILL_SECONDARY = "border-border bg-card shadow-[var(--shadow-1)] hover:border-input dark:hover:bg-accent";
const PILL_PRIMARY =
  "border-transparent bg-primary shadow-[0_1px_2px_rgb(109_27_82/0.22),inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-primary-hover dark:shadow-none";

const LABEL_SECONDARY = "text-body font-medium leading-none text-foreground";
const LABEL_PRIMARY = "text-body font-medium leading-none text-primary-foreground";
const GLYPH_SECONDARY = "size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground";
const GLYPH_PRIMARY = "size-4 shrink-0 text-primary-foreground";

// Square, and the same height as a pill; 44px square on a coarse pointer.
const MORE_TRIGGER =
  "flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground shadow-[var(--shadow-1)] transition-[background-color,border-color,scale] hover:border-input hover:text-foreground active:scale-[0.97] data-[state=open]:border-input data-[state=open]:text-foreground disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:min-w-11";

const LIST =
  "flex flex-wrap items-center gap-2 [&:not(:has(a,button))]:hidden";
// `flex` so a fragment of several buttons in one slot still lines up in a
// row; `empty:hidden` so a slot whose component rendered nothing leaves no gap.
const ITEM = "flex shrink-0 items-center gap-2 empty:hidden";

// A pill whose destination belongs to no module (rare: the hub, an external
// link) gets an arrow.
const FALLBACK_GLYPH: LucideIcon = ArrowRight;

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
  primaryGlyph = Plus,
  label,
  hint,
  hintId,
}: {
  primary: boolean;
  glyph: LucideIcon | React.ReactElement;
  /** A primary pill's glyph: Plus, except on the hub. */
  primaryGlyph?: LucideIcon;
  label: string;
  hint?: string;
  hintId: string;
}) {
  const Glyph = primary ? primaryGlyph : glyph;
  return (
    <>
      {React.isValidElement(Glyph) ? (
        <span className={primary ? GLYPH_PRIMARY : GLYPH_SECONDARY} aria-hidden>
          {Glyph}
        </span>
      ) : (
        <Glyph className={primary ? GLYPH_PRIMARY : GLYPH_SECONDARY} strokeWidth={primary ? 2.25 : 2} aria-hidden />
      )}
      <span className={primary ? LABEL_PRIMARY : LABEL_SECONDARY}>{label}</span>
      {hint && (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}
    </>
  );
}

function PillLink({ action, hintId, hub }: { action: HubActionSpec; hintId: string; hub: boolean }) {
  const primary = Boolean(action.primary);
  const mod = chipFor(action.module, action.href);
  // On the hub every pill, the primary included, shows where it goes (owner
  // decision 3). A landing's primary keeps R6's Plus.
  const primaryGlyph: LucideIcon = hub && mod ? mod.icon : Plus;

  return (
    <Link
      href={action.href}
      aria-label={action.label}
      aria-describedby={action.hint ? hintId : undefined}
      data-slot="quick-action"
      data-variant={primary ? "primary" : "secondary"}
      className={cn(PILL_BASE, primary ? PILL_PRIMARY : PILL_SECONDARY)}
    >
      <PillBody
        primary={primary}
        glyph={mod?.icon ?? FALLBACK_GLYPH}
        primaryGlyph={primaryGlyph}
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
  /** primary: a landing's main create action (filled plum, Plus glyph). */
  variant?: "primary" | "secondary";
  /**
   * Secondary only: the glyph (a Lucide icon or an element, e.g. a
   * spinner while pending). Defaults to `module`'s glyph. A primary button
   * pill always shows a Plus: it is a landing's create action (R6); the hub's
   * destination-glyph primary is a link pill (PillLink).
   */
  icon?: LucideIcon | React.ReactElement;
  /** Secondary only: the module whose glyph the pill shows by default. */
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
        className={cn(PILL_BASE, primary ? PILL_PRIMARY : PILL_SECONDARY, className)}
      >
        <PillBody
          primary={primary}
          glyph={icon ?? mod?.icon ?? FALLBACK_GLYPH}
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
        <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden />
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
       * limits (3 pills, verb labels) do not apply to its shortcuts, and its
       * primary shortcut wears its destination's glyph rather than a Plus.
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
          <PillLink action={action} hintId={hintIds[i]} hub={hub} />
        </li>
      ))}
      {hasMore && <li className={ITEM}>{more}</li>}
    </ul>
  );
}
