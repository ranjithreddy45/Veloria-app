"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadPdfButtonProps {
  invoiceId: string;
}

export function DownloadPdfButton({ invoiceId }: DownloadPdfButtonProps) {
  const handleDownload = () => {
    window.open(`/invoices/${invoiceId}/pdf?auto=1`, "_blank");
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <DownloadIcon className="mr-2 size-4" />
      Download PDF
    </Button>
  );
}
