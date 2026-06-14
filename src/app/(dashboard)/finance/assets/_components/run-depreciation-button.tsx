"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { runDepreciation } from "@/actions/finance-assets.actions";

export function RunDepreciationButton({ assetId, disabled }: { assetId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    const res = await runDepreciation(assetId);
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(
      res.data.fullyDepreciated
        ? `Depreciated ${formatINR(res.data.amount)} — asset now fully depreciated.`
        : `Posted ${formatINR(res.data.amount)} depreciation to the GL.`,
    );
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={run} disabled={busy || disabled}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <TrendingDown className="size-3.5" />}
      Run depreciation
    </Button>
  );
}
