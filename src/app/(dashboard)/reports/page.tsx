import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ReportsDashboard } from "./_components/reports-dashboard";

export const metadata: Metadata = { title: "Reports & Analytics" };

// ============================================================
// Reports & Analytics Page
// ============================================================

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive analytics and performance reports for your venue operations."
      />
      <ReportsDashboard />
    </div>
  );
}
