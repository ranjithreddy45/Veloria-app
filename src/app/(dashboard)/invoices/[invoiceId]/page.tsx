import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PencilIcon,
  SendIcon,
  CreditCardIcon,
  CalendarClockIcon,
  PrinterIcon,
} from "lucide-react";
import { getInvoice, sendInvoice } from "@/actions/invoice.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_COLORS } from "@/lib/constants";
import { InvoicePreview } from "./_components/invoice-preview";
import { RecordPaymentDialog } from "./_components/record-payment-dialog";
import { PendingProofs } from "./_components/pending-proofs";
import { InstallmentPlanDialog } from "./_components/installment-plan-dialog";
import { PaymentLinkDialog } from "./_components/payment-link-dialog";
import { DownloadPdfButton } from "./_components/download-pdf-button";

export const metadata = {
  title: "Invoice Details",
};

interface InvoiceDetailPageProps {
  params: Promise<{ invoiceId: string }>;
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { invoiceId } = await params;
  const result = await getInvoice(invoiceId);

  if (!result.success || !result.data) {
    notFound();
  }

  const invoice = result.data;
  const statusColors = INVOICE_STATUS_COLORS[invoice.status] || "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`${invoice.contact.firstName} ${invoice.contact.lastName}${invoice.contact.company ? ` - ${invoice.contact.company}` : ""}`}
      >
        <Badge variant="outline" className={`${statusColors} border text-sm`}>
          {invoice.status.replace("_", " ")}
        </Badge>
        <div className="flex items-center gap-2">
          <DownloadPdfButton invoiceId={invoiceId} />
          {invoice.status === "DRAFT" && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/invoices/${invoiceId}/edit`}>
                  <PencilIcon className="mr-2 size-4" />
                  Edit
                </Link>
              </Button>
              <form
                action={async () => {
                  "use server";
                  await sendInvoice(invoiceId);
                }}
              >
                <Button type="submit" size="sm" variant="outline">
                  <SendIcon className="mr-2 size-4" />
                  Send
                </Button>
              </form>
            </>
          )}
          {invoice.status !== "PAID" &&
            invoice.status !== "CANCELLED" &&
            invoice.status !== "DRAFT" && (
              <>
                <PaymentLinkDialog
                  invoiceId={invoice.id}
                  invoiceNumber={invoice.invoiceNumber}
                  balanceDue={Number(invoice.balanceDue)}
                />
                <RecordPaymentDialog
                  invoiceId={invoice.id}
                  balanceDue={Number(invoice.balanceDue)}
                />
              </>
            )}
          {invoice.status !== "PAID" &&
            invoice.status !== "CANCELLED" &&
            invoice.installments.length === 0 && (
              <InstallmentPlanDialog
                invoiceId={invoice.id}
                totalAmount={Number(invoice.totalAmount)}
                eventDate={invoice.booking?.date ?? null}
              />
            )}
        </div>
      </PageHeader>

      <PendingProofs payments={invoice.payments as never} />

      <InvoicePreview invoice={invoice} />
    </div>
  );
}
