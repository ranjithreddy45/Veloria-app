"use client";

// ============================================================
// Price summary — presentational. Pure display of the computeQuotation()
// result the parent computes via the SAME engine the server re-prices with.
// ============================================================

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { QuotationResult } from "@/lib/sales/quotation-calc";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export function PriceSummary({ result }: { result: QuotationResult }) {
  const advance = result.paymentSchedule[0];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your estimate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a few options on the left to see your live price.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            {result.lines.map((line) => (
              <div key={line.sl} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{line.particulars}</p>
                  <p className="truncate text-xs text-muted-foreground">{line.plan}</p>
                </div>
                <span className="shrink-0 tabular-nums">{inr(line.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5 border-t border-border/60 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{inr(result.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Tax ({Math.round(result.taxRate * 100)}%)
            </span>
            <span className="tabular-nums">{inr(result.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-2 text-base font-bold">
            <span>Grand total</span>
            <span className="tabular-nums">{inr(result.grandTotal)}</span>
          </div>
        </div>

        {result.grandTotal > 0 && (
          <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment plan
            </p>
            {result.paymentSchedule.map((inst, idx) => (
              <div
                key={inst.label}
                className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ${
                  idx === 0 ? "bg-primary/10" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{inst.label}</span>
                    <Badge variant={idx === 0 ? "default" : "secondary"}>{inst.pct}%</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {idx === 0 ? "Pay now to block your date" : inst.dueHint}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-sm font-semibold">
                  {inr(inst.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {advance && advance.amount > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Pay just <span className="font-semibold text-foreground">{inr(advance.amount)}</span>{" "}
            now to block your date.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
