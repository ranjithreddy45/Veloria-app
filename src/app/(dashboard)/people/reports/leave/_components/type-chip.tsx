import { StatusPill, type Hue } from "@/components/shared/status-pill";

// LeaveType.color is a free-form hue token ("blue", "amber", ...). Coerce it to
// a StatusPill Hue, falling back to slate for anything unrecognised.
const HUES: Hue[] = [
  "slate", "indigo", "blue", "sky", "cyan", "teal", "emerald",
  "amber", "orange", "rose", "red", "violet", "purple", "pink", "neutral",
];

export function toHue(color: string | null | undefined): Hue {
  return HUES.includes((color ?? "") as Hue) ? (color as Hue) : "slate";
}

/** A small colored chip for a leave type — "SL" style code in the type's hue. */
export function TypeChip({ code, color }: { code: string; color: string }) {
  return <StatusPill label={code} hue={toHue(color)} size="xs" />;
}
