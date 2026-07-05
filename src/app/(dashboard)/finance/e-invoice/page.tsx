import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getEInvoiceRows } from "@/actions/finance-einvoice.actions";
import { EInvoiceWorkspace } from "./_components/einvoice-workspace";

export const metadata = { title: "E-Invoicing · Veloria Grand" };

export default async function FinanceEInvoicePage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const canWrite = ["SUPER_ADMIN", "ADMIN", "FINANCE"].includes(role);
  const rows = await getEInvoiceRows();

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Finance · E-Invoicing"
        title="GST E-Invoicing"
        description="Generate IRP-style Invoice Reference Numbers (IRN) and signed-QR for your issued invoices, then reconcile input credit against GSTR-2B."
      />
      <EInvoiceWorkspace rows={rows} canWrite={canWrite} />
    </div>
  );
}
