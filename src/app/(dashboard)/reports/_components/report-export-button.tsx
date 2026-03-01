"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportExportButtonProps {
  data: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  filename: string;
}

export function ReportExportButton({ data, columns, filename }: ReportExportButtonProps) {
  const handleExport = () => {
    if (!data.length) return;
    const header = columns.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          const str = val == null ? "" : String(val);
          // Escape commas and quotes
          return str.includes(",") || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport} disabled={!data.length}>
      <Download className="mr-1.5 size-3.5" />
      Export CSV
    </Button>
  );
}
