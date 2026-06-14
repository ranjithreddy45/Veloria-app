import { FlaskConical } from "lucide-react";

// Prominent muted banner — makes it unmistakable that nothing is filed live.
export function SandboxBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/60 px-4 py-3 shadow-card">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
        <FlaskConical className="size-4" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">Sandbox mode</p>
        <p className="text-xs text-muted-foreground">
          Connect your GSTIN + IRP/GSP credentials to issue live e-invoices. IRNs generated here are
          mock artifacts and are not registered with the GSTN.
        </p>
      </div>
    </div>
  );
}
