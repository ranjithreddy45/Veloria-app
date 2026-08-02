// ============================================================
// Shared presentational primitives for the BD Reports page.
// Pure/server-safe (no client hooks) — used to keep the page tidy.
// ============================================================

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function inr(n: number): string {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function pct(fraction: number): string {
  return `${Math.round((fraction || 0) * 100)}%`;
}

/** A report section: a Card with a heading + optional description. */
export function ReportSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="space-y-0.5">
          <h2 className="text-body font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {description && <p className="text-detail text-muted-foreground">{description}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-muted-foreground">{children}</p>;
}

/** A scroll-x wrapper for tables on mobile. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2 text-left text-meta font-semibold uppercase tracking-[0.04em] text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("whitespace-nowrap px-3 py-2 text-body text-foreground", className)}>{children}</td>;
}
