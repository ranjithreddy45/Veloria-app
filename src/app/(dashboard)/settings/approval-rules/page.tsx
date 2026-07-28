import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, ShieldCheckIcon } from "lucide-react";

import { getApprovalRules } from "@/actions/approval.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PageHelp } from "@/lib/page-help";
import { ApprovalRulesTable } from "./_components/approval-rules-table";

export const metadata: Metadata = { title: "Approval Rules" };

export default async function ApprovalRulesPage() {
  const result = await getApprovalRules();
  const rules = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Governance"
        icon={ShieldCheckIcon}
        accent="emerald"
        title="Approval Rules"
        description="Decide what needs a sign-off before it moves. Quotes, deals and bookings matching a rule's conditions are routed through its approval chain first."
        help={<PageHelp id="approval-rules" />}
      >
        <Button asChild>
          <Link href="/settings/approval-rules/new">
            <PlusIcon className="mr-2 size-4" />
            New Rule
          </Link>
        </Button>
      </PageHeader>

      <ApprovalRulesTable initialRules={rules} />
    </div>
  );
}
