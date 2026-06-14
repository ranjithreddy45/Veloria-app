"use client";

// ============================================================
// CapEx version card (Spec D) — rich per-version breakdown.
// Visual/UX only: renders ONE CapEx projection version as a Card with the
// status pill, big total, timeline + author meta, a computed line breakdown
// (derived purely from inputsJson via computeCapex — no server/data change),
// and the existing action buttons (Approve / Return / PDF / Send-to-owner).
// All handlers are passed in from project-detail.tsx; this file owns no state.
// ============================================================

import { CheckCircle2, Download, User2, CalendarClock } from "lucide-react";
import {
  computeCapex,
  type CapexInput,
  type CapexResultLine,
} from "@/lib/projects/capex-calc";
import type { Hue } from "@/components/shared/status-pill";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const inr = (n: number | string) =>
  "₹" + Math.round(Number(n)).toLocaleString("en-IN");

export interface CapexVersionRow {
  id: string;
  version: number;
  status: string;
  totalCapex: string;
  estimatedWeeks: number;
  inputsJson: CapexInput;
  notes: string | null;
  createdBy?: { name: string | null };
}

function statusHue(status: string): Hue {
  if (status === "APPROVED" || status === "SENT") return "emerald";
  if (status === "PENDING_APPROVAL") return "amber";
  return "slate";
}

interface CapexVersionCardProps {
  capex: CapexVersionRow;
  busy: boolean;
  canApprove: boolean;
  canUpdate: boolean;
  onApprove: () => void;
  onReturn: () => void;
  onSend: () => void;
}

export function CapexVersionCard({
  capex,
  busy,
  canApprove,
  canUpdate,
  onApprove,
  onReturn,
  onSend,
}: CapexVersionCardProps) {
  const isApproved = capex.status === "APPROVED" || capex.status === "SENT";
  const isPending = capex.status === "PENDING_APPROVAL";

  // Derive the per-line breakdown from the stored inputs. Pure compute — same
  // engine the calculator + PDF use, so nothing can drift and no number is
  // invented. Guarded so a malformed/empty inputsJson degrades gracefully.
  let result: ReturnType<typeof computeCapex> | null = null;
  try {
    if (capex.inputsJson && Array.isArray(capex.inputsJson.lines)) {
      result = computeCapex(capex.inputsJson);
    }
  } catch {
    result = null;
  }
  const lines: CapexResultLine[] = result?.lines ?? [];

  // Fallback spec list straight off inputsJson (only fields that exist).
  const specs: { label: string; value: string }[] = [];
  const inp = capex.inputsJson;
  if (inp) {
    if (typeof inp.builtUpAreaSqft === "number" && inp.builtUpAreaSqft > 0)
      specs.push({
        label: "Built-up area",
        value: `${inp.builtUpAreaSqft.toLocaleString("en-IN")} sq ft`,
      });
    if (typeof inp.guestSeats === "number" && inp.guestSeats > 0)
      specs.push({
        label: "Guest seats",
        value: inp.guestSeats.toLocaleString("en-IN"),
      });
    if (typeof inp.contingencyPct === "number")
      specs.push({ label: "Contingency", value: `${inp.contingencyPct}%` });
  }

  return (
    <Card
      className={cn(
        "border-0 shadow-card ring-1 ring-inset",
        isApproved ? "ring-emerald-200/70" : "ring-border/60",
      )}
    >
      <CardContent className="space-y-4 py-4">
        {/* Header: version + status, big total */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Version {capex.version}
              </span>
              <StatusPill
                label={capex.status.replace(/_/g, " ")}
                hue={statusHue(capex.status)}
                size="xs"
              />
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {inr(capex.totalCapex)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                <span className="tabular-nums">{capex.estimatedWeeks}</span> weeks
              </span>
              <span className="inline-flex items-center gap-1">
                <User2 className="h-3.5 w-3.5" />
                {capex.createdBy?.name ?? "—"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {isApproved && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={`/api/projects/capex/${capex.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" /> PDF
                </a>
              </Button>
            )}
            {isPending && canApprove && (
              <>
                <Button size="sm" disabled={busy} onClick={onApprove}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={onReturn}
                >
                  Return
                </Button>
              </>
            )}
            {isApproved && canUpdate && (
              <Button size="sm" disabled={busy} onClick={onSend}>
                Send to owner
              </Button>
            )}
          </div>
        </div>

        {/* Line breakdown — preferred; falls back to a spec list */}
        {lines.length > 0 ? (
          <div className="rounded-lg border border-border/60">
            <ul className="divide-y divide-border/60">
              {lines.map((l) => (
                <li
                  key={l.key}
                  className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2 truncate text-muted-foreground">
                    <span className="truncate text-foreground">{l.label}</span>
                    {l.belowLuxury && (
                      <StatusPill
                        label="below luxury"
                        hue="amber"
                        size="xs"
                        noDot
                      />
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">{inr(l.amount)}</span>
                </li>
              ))}
            </ul>
            {result && (
              <div className="space-y-1 border-t border-border/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{inr(result.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Contingency ({result.contingencyPct}%)</span>
                  <span className="tabular-nums">
                    {inr(result.contingencyAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{inr(result.total)}</span>
                </div>
              </div>
            )}
          </div>
        ) : specs.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border/60 px-3 py-2.5 text-sm sm:grid-cols-3">
            {specs.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="tabular-nums font-medium">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {capex.notes && (
          <p className="text-xs text-muted-foreground">{capex.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
