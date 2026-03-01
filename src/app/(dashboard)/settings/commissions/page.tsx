import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { getCommissionRules } from "@/actions/commission.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CommissionRuleForm } from "../../commissions/_components/commission-rule-form";

export const metadata: Metadata = { title: "Commission Rules | Settings" };

// ============================================================
// Commission Rules Settings Page
// ============================================================

export default async function CommissionSettingsPage() {
  const result = await getCommissionRules();
  const rules = result.success ? result.data : [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Commission Rules"
        description="Create and manage commission calculation rules for your team."
      >
        <Button variant="outline" asChild>
          <Link href="/commissions">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Commissions
          </Link>
        </Button>
      </PageHeader>

      <CommissionRuleForm initialRules={rules} />
    </div>
  );
}
