import type { Decimal } from "@prisma/client/runtime/library";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatINR(value: any): string {
  if (value === null || value === undefined) return "--";
  const num = Number(value);
  if (isNaN(num)) return "--";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Recursively converts Prisma Decimal → number and Date → string
 * at the type level, matching what JSON serialization does at runtime.
 */
type Serialized<T> = T extends Decimal
  ? number
  : T extends Date
    ? string
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export type { Serialized };

/**
 * Converts Prisma Decimal fields to plain numbers so data can be
 * passed from Server Components to Client Components.
 */
export function serialize<T>(data: T): Serialized<T> {
  return JSON.parse(JSON.stringify(data, (_key, value) =>
    value !== null &&
    typeof value === "object" &&
    typeof value.toNumber === "function"
      ? value.toNumber()
      : value
  )) as Serialized<T>;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "--";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// Single app-wide date+time format (e.g. "13 Jun 2026, 8:27 PM") so detail pages
// don't mix "12/6/2026", lowercase "8:27:28 pm", etc. (Sales SCRM-010).
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "--";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}
