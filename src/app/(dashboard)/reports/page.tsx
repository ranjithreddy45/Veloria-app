import type { Metadata } from "next";
import { BarChart3Icon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { ReportsDashboard } from "./_components/reports-dashboard";

export const metadata: Metadata = { title: "Reports & Analytics" };

// ============================================================
// Reports & Analytics Page
// ============================================================

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={BarChart3Icon}
        accent="pink"
        eyebrow="Business Intelligence"
        title="Reports & Analytics"
        help={<PageHelp id="reports" />}
        description="Comprehensive analytics and performance reports for your venue operations."
      />
      <ReportsDashboard />
    </div>
  );
}
