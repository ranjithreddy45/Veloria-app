"use client";

// ============================================================
// REVENUE_MARGIN grid view — the on-screen twin of the owner PDF.
//
// Pure display of a RevenueMarginGrid, used by BOTH the live builder preview and
// the read-only view of an approved/sent projection, so the screen and the sent
// document can never disagree. The lifecycle itself (draft → approve → send →
// PDF) is the shared AcqProjection one; modelType REVENUE_MARGIN selects this
// engine and this view.
//
// Owner's chosen shape:
//   • Headline  = FULL GROSS revenue      price × pax × events × 12
//   • Secondary = our margin (the spread) (best − base) × pax × events × 12
//   • NO opex participates in this model at all.
// ============================================================

import { Info } from "lucide-react";

import type {
  RevenueMarginGrid,
  RmCaseRow,
  RmPriceBasis,
} from "@/lib/acq/projection-calc";
import { ACQ_RM_PRICE_BASIS_LABEL } from "@/lib/acq/constants";
import { formatINR } from "@/lib/utils";

export function RevenueMarginGridView({ grid }: { grid: RevenueMarginGrid }) {
  const perPax = grid.priceBasis === "PER_PAX";
  return (
    <div className="space-y-4">
      {/* Headline: the FULL gross, per the owner's definition. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CaseTile
          title="Base case"
          subtitle="At the owner's guaranteed price"
          row={grid.base}
          basis={grid.priceBasis}
        />
        <CaseTile
          title="Best case"
          subtitle="At the price we expect to sell at"
          row={grid.best}
          basis={grid.priceBasis}
          emphasize
        />
      </div>

      {/* Secondary line: the spread only — deliberately NOT the headline. */}
      <div className="rounded-md border border-border/60 bg-muted/30 p-3.5">
        <div className="text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Veloria&apos;s margin (spread only — not owner revenue)
        </div>
        <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label="Per event" value={formatINR(grid.margin.perEvent)} />
          <Figure label="Per month" value={formatINR(grid.margin.monthly)} />
          <Figure label="Annualised" value={formatINR(grid.margin.annual)} emphasize />
        </div>
        <p className="mt-2 text-meta text-muted-foreground">
          ({formatINR(grid.margin.spreadPerUnit)} spread
          {perPax ? ` × ${grid.effectivePax} pax` : ""} × {grid.eventsPerMonth} events
          × 12 months)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Figure label="Price basis" value={ACQ_RM_PRICE_BASIS_LABEL[grid.priceBasis]} />
        <Figure label="Events / month" value={String(grid.eventsPerMonth)} />
        {perPax && <Figure label="Billable pax" value={String(grid.effectivePax)} />}
      </div>

      {perPax && (
        <p className="flex items-start gap-1.5 text-meta text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" />
          <span>
            Billable pax {grid.effectivePax} — {paxBindingNote(grid.paxBinding)}
          </span>
        </p>
      )}

      <p className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-meta text-muted-foreground">
        Headline figures are the full gross event value, not profit — the
        Revenue-Margin model carries no operating expenses. What Veloria keeps is
        the base-to-best spread shown above.
      </p>
    </div>
  );
}

function paxBindingNote(binding: RevenueMarginGrid["paxBinding"]): string {
  switch (binding) {
    case "CAPACITY":
      return "capped at the hall capacity.";
    case "MINIMUM":
      return "floored to the minimum billable pax.";
    case "ACTUAL":
      return "the expected pax per event.";
    default:
      return "not a multiplier on a per-event price.";
  }
}

function Figure({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-meta uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          emphasize
            ? "text-copy font-semibold text-primary"
            : "text-body text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

function CaseTile({
  title,
  subtitle,
  row,
  basis,
  emphasize,
}: {
  title: string;
  subtitle: string;
  row: RmCaseRow;
  basis: RmPriceBasis;
  emphasize?: boolean;
}) {
  return (
    <div
      className={
        emphasize
          ? "rounded-md border border-primary/40 bg-primary/5 p-3.5"
          : "rounded-md border border-border/60 p-3.5"
      }
    >
      <div className="text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-1 text-title font-semibold tracking-[-0.02em] text-foreground">
        {formatINR(row.annualRevenue)}
      </div>
      <div className="text-meta text-muted-foreground">
        gross / year · {subtitle}
      </div>
      <dl className="mt-2.5 space-y-1 border-t border-border/50 pt-2 text-detail">
        <Line label="Gross / month" value={formatINR(row.monthlyRevenue)} />
        <Line label="Gross / event" value={formatINR(row.revenuePerEvent)} />
        <Line
          label={basis === "PER_PAX" ? "Price / pax" : "Price / event"}
          value={formatINR(row.price)}
        />
        {basis === "PER_PAX" && <Line label="Billable pax" value={String(row.pax)} />}
      </dl>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
