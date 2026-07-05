"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PortalPdfButtonProps {
  invoiceId: string;
}

// H1: points at the PORTAL-scoped PDF route (ownership-checked), not the
// staff-only /invoices/{id}/pdf route that returns /not-authorized to clients.
export function PortalPdfButton({ invoiceId }: PortalPdfButtonProps) {
  const handleDownload = () => {
    window.open(`/portal/invoices/${invoiceId}/pdf?auto=1`, "_blank");
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <DownloadIcon className="mr-2 size-4" />
      Download PDF
    </Button>
  );
}
