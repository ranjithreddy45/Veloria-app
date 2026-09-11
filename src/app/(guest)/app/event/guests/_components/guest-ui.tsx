"use client";
export { ScreenHeader, Card, Chip, Avatar } from "../../../../_components/ui";
export function initialsTone(name: string): string {
  const s = name.split(/[\s&×]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return s || "G";
}
