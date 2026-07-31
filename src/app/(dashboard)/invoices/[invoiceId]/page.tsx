import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon, SendIcon, FileTextIcon } from "lucide-react";
import { getInvoice, sendInvoice } from "@/actions/invoice.actions";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_COLORS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { InvoicePreview } from "./_components/invoice-preview";
import { RecordPaymentDialog } from "./_components/record-payment-dialog";
import { PendingProofs } from "./_components/pending-proofs";
import { InstallmentPlanDialog } from "./_components/installment-plan-dialog";
import { PaymentLinkDialog } from "./_components/payment-link-dialog";
import { DownloadPdfButton } from "./_components/download-pdf-button";
import {
  CancelInvoiceDialog,
  InvoiceCancellationBanner,
} from "./_components/cancel-invoice-dialog";

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

  const session = await auth();
  const role = (session?.user?.role as string) ?? "";
  const canRequestCancel = hasPermission(role, "invoices:update");
  const isCancelManager = hasPermission(role, "invoices:cancel");
  // Cancellation is blocked server-side once any money is collected — the
  // payments must be cancelled first. Reflect that in the UI instead of
  // offering a button the server will always reject.
  const hasCollectedMoney = Number(invoice.paidAmount) > 0;
  const cancellableStatus =
    invoice.status !== "DRAFT" &&
    invoice.status !== "CANCELLED" &&
    !invoice.cancelPending;
  const isCancellable = cancellableStatus && !hasCollectedMoney;

  // Resolve the requester's name for the pending-cancellation banner.
  let requestedByName: string | null = null;
  if (invoice.cancelPending && invoice.cancelRequestedById) {
    const requester = await prisma.user.findUnique({
      where: { id: invoice.cancelRequestedById },
      select: { name: true, email: true },
    });
    requestedByName = requester?.name || requester?.email || null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileTextIcon}
        accent="emerald"
        eyebrow={
          <span>
            INVOICE ·{" "}
            <span className="numeric">{formatINR(invoice.totalAmount)}</span>{" "}
            total ·{" "}
            <span className="numeric">{formatINR(invoice.balanceDue)}</span> due
          </span>
        }
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`${invoice.contact.firstName} ${invoice.contact.lastName}${invoice.contact.company ? ` — ${invoice.contact.company}` : ""}`}
      >
        <Badge variant="outline" className={`${statusColors} border text-sm`}>
          {invoice.status.replace("_", " ")}
        </Badge>
        {/* Up to six actions live here (PDF, Edit, Send, Payment link, Record
            payment, Installments, Cancel). Without flex-wrap this single row
            runs ~700px wide and drags the whole page sideways on a phone. */}
        <div className="flex flex-wrap items-center gap-2">
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
                  totalAmount={Number(invoice.totalAmount)}
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
          {canRequestCancel && isCancellable && (
            <CancelInvoiceDialog invoiceId={invoice.id} isManager={isCancelManager} />
          )}
          {canRequestCancel && cancellableStatus && hasCollectedMoney && (
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Cancel the payments on this invoice first."
            >
              Cancel
            </Button>
          )}
        </div>
      </PageHeader>

      {invoice.cancelPending && (
        <InvoiceCancellationBanner
          invoiceId={invoice.id}
          isManager={isCancelManager}
          reason={invoice.cancelReason ?? null}
          requestedByName={requestedByName}
        />
      )}

      <PendingProofs payments={invoice.payments as never} />

      <InvoicePreview invoice={invoice} />
    </div>
  );
}
