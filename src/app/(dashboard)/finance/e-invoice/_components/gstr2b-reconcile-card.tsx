import { FileSpreadsheet, Lock } from "lucide-react";

// GSTR-2B reconciliation — clearly-labelled placeholder. Activates once GSTN
// access is connected; intentionally non-interactive for now.
export function Gstr2bReconcileCard() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300">
            <FileSpreadsheet className="size-4" />
          </span>
          <h2 className="text-sm font-medium text-foreground">GSTR-2B reconciliation</h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-meta font-medium text-muted-foreground">
          <Lock className="size-3" />
          Coming soon
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 py-10 text-center">
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileSpreadsheet className="size-5" />
        </span>
        <p className="text-sm font-medium text-foreground">
          Upload your GSTR-2B to reconcile input credit
        </p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          Available once GSTN access is connected. We&apos;ll auto-match your purchase invoices against
          the GSTR-2B statement and flag mismatched or missing input tax credit.
        </p>
      </div>
    </div>
  );
}
