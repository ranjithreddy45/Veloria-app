"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toCSV, downloadCSV } from "@/lib/csv-export";

// A reusable "Export CSV" button for the employee reports. The parent (a server
// component) has already computed every filtered row, so the button simply
// serialises the in-memory data — no re-query, no client-side data access.
export function ReportExportButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  function handleExport() {
    if (rows.length === 0) {
      toast.info("Nothing to export for the current filters.");
      return;
    }
    const csv = toCSV(headers, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCSV(`${filename}-${stamp}.csv`, csv);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}.`);
  }

  return (
    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
      <Download className="size-3.5" />
      Export CSV
    </Button>
  );
}
