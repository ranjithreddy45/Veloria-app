import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { getPayroll } from "@/actions/staff.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { PayrollTable } from "../_components/payroll-table";
import { PayrollToolbar } from "./payroll-toolbar";

export const metadata: Metadata = { title: "Staff Payroll" };

// ============================================================
// Payroll Page
// ============================================================

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;

  // Default to current month in YYYY-MM format
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = params.month || defaultMonth;

  const result = await getPayroll(month);
  const entries = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Payroll"
        help={<PageHelp id="staff-payroll" />}
        description="Review and manage monthly payroll entries."
      >
        <Button variant="outline" asChild>
          <Link href="/staff">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Schedule
          </Link>
        </Button>
      </PageHeader>

      <PayrollToolbar month={month} entryCount={entries.length} />

      <PayrollTable data={entries} />
    </div>
  );
}
