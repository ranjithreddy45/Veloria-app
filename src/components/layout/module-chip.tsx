"use client";

// ============================================================
// ModuleChip: the page header's module chip, derived from the route.
// ------------------------------------------------------------
// A small client island so PageHeader can stay a server component: only this
// chip reads the URL. The glyph and hue come from src/config/modules.ts via
// the current pathname (longest prefix wins), so no page picks its own chip.
// The override is a string key (serialisable from a server component), or
// `false` to suppress the chip.
//
// Hidden below sm: on a phone the title starts at the 16px gutter, so the
// title, description and actions keep one left edge.
//
// ModuleEyebrow is the same lookup for PageHeader's eyebrow line: a page that
// passes no `eyebrow` gets its module's name there (design spec R1: every
// PageHeader has an eyebrow). That also keeps the title where the loading
// skeletons expect it, under a one-line eyebrow.
// ============================================================

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconChip } from "@/components/ui/icon-chip";
import { MODULES, isModuleKey, resolveModule, type ModuleKey } from "@/config/modules";

export interface ModuleChipProps {
  /** Force a module (e.g. a page outside its module's URL tree), or `false` for no chip. */
  module?: ModuleKey | false;
  className?: string;
}

/** The module for a route: an explicit key wins, `false` means none. */
function useModuleKey(override: ModuleKey | false | undefined): ModuleKey | null {
  const pathname = usePathname();
  if (override === false) return null;
  // An unknown key (a stale string from a call site) falls back to the route
  // rather than rendering nothing.
  return isModuleKey(override) ? override : resolveModule(pathname);
}

export function ModuleChip({ module: override, className }: ModuleChipProps) {
  const key = useModuleKey(override);
  if (!key) return null;
  const mod = MODULES[key];

  return (
    <span
      data-slot="module-chip"
      data-module={key}
      aria-hidden
      className={cn("hidden shrink-0 sm:flex", className)}
    >
      <IconChip icon={mod.icon} hue={mod.hue} size="lg" tone="solid" />
    </span>
  );
}

/**
 * PageHeader's default eyebrow: the module's name as src/config/modules.ts
 * spells it (the eyebrow class uppercases it on screen). Renders nothing
 * where the route has no module (the hub, the external portals) or the page
 * passes `module={false}`.
 */
export function ModuleEyebrow({ module: override, className }: ModuleChipProps) {
  const key = useModuleKey(override);
  if (!key) return null;
  return (
    <div data-slot="module-eyebrow" className={className}>
      {MODULES[key].label}
    </div>
  );
}
