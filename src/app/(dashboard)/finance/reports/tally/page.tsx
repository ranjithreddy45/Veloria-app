import { redirect } from "next/navigation";
import { FileDownIcon } from "lucide-react";
import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import { hasPermission } from "@/lib/permissions";
import { getTallyExportDefaults } from "@/actions/finance-tally.actions";
import { TallyExport } from "./_components/tally-export";

export const metadata = { title: "Tally Export · Veloria Grand" };

export default async function FinanceTallyExportPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "finance:read")) redirect("/dashboard");

  const defaults = await getTallyExportDefaults();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileDownIcon}
        accent="gold"
        eyebrow="Finance · Reports"
        title="Tally export"
        description="Download the posted ledger as Tally Prime XML — ledger masters and vouchers for a date range — for your accountant to import."
      />
      <TallyExport defaults={defaults} />
    </div>
  );
}
