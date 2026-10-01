// ============================================================
// IconChip: the one coloured icon square.
// ------------------------------------------------------------
// Three sizes, one per job:
//   lg (40px, rounded-xl): the module chip in the page header (identity)
//   md (36px, rounded-xl): the tinted chip on a KPI tile (metric)
//   sm (28px, rounded-lg): the chip inside an action pill (action)
// Colours come only from src/lib/ui/hues.ts. No "use client" and no hooks, so
// it renders in server and client trees alike.
// ============================================================

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_INVERSE_CHIP, SOFT_CHIP, SOLID_CHIP, type Hue } from "@/lib/ui/hues";

export type IconChipSize = "sm" | "md" | "lg";
/**
 * solid: white glyph on a filled square (header and pill chips).
 * soft: coloured glyph on a pale wash (KPI tiles).
 * inverse: the chip inside the filled primary pill; `hue` is ignored.
 */
export type IconChipTone = "solid" | "soft" | "inverse";

const BOX: Record<IconChipSize, string> = {
  sm: "size-7 rounded-lg",
  md: "size-9 rounded-xl",
  lg: "size-10 rounded-xl",
};

// Glyph size when IconChip renders the icon component itself.
const GLYPH: Record<IconChipSize, string> = {
  sm: "size-4",
  md: "size-4.5",
  lg: "size-5",
};

// Glyph size when the caller passes a ready-made element (StatTile's `icon`
// prop is an element like <Wallet className="size-4" />). The child selector
// outranks the element's own size class, so every chip of a size matches.
const ELEMENT_GLYPH: Record<IconChipSize, string> = {
  sm: "[&>svg]:size-4",
  md: "[&>svg]:size-4.5",
  lg: "[&>svg]:size-5",
};

export interface IconChipProps extends Omit<React.ComponentPropsWithoutRef<"span">, "children"> {
  /** A Lucide icon component, or an already-rendered icon element. */
  icon: LucideIcon | React.ReactElement;
  hue: Hue;
  size?: IconChipSize;
  tone?: IconChipTone;
}

export function IconChip({ icon, hue, size = "md", tone = "solid", className, ...rest }: IconChipProps) {
  const isElement = React.isValidElement(icon);
  const toneClass =
    tone === "inverse"
      ? PRIMARY_INVERSE_CHIP
      : tone === "soft"
        ? (SOFT_CHIP[hue] ?? SOFT_CHIP.brand)
        : (SOLID_CHIP[hue] ?? SOLID_CHIP.brand);

  return (
    <span
      data-slot="icon-chip"
      data-hue={hue}
      data-tone={tone}
      {...rest}
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        BOX[size],
        toneClass,
        isElement && ELEMENT_GLYPH[size],
        className
      )}
    >
      {isElement
        ? icon
        : // createElement rather than a capitalised local: the icon is a prop,
          // and the React compiler lint reads `<Icon />` from a render-time
          // variable as a component created during render.
          React.createElement(icon as LucideIcon, {
            className: GLYPH[size],
            strokeWidth: 2,
            "aria-hidden": true,
          })}
    </span>
  );
}
