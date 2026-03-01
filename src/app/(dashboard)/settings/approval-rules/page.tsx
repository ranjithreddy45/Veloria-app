import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getApprovalRules } from "@/actions/approval.actions";
import { Button } from "@/components/ui/button";
import { ApprovalRulesTable } from "./_components/approval-rules-table";

export const metadata: Metadata = { title: "Approval Rules" };

export default async function ApprovalRulesPage() {
  const result = await getApprovalRules();
  const rules = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approval Rules</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure approval workflows for quotes, deals, and bookings.
            Requests matching rule conditions will be routed through an
            approval chain before proceeding.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <Button asChild>
            <Link href="/settings/approval-rules/new">
              <PlusIcon className="mr-2 size-4" />
              New Rule
            </Link>
          </Button>
        </div>
      </div>

      <ApprovalRulesTable initialRules={rules} />
    </div>
  );
}
