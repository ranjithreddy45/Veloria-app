import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { getApprovalRule } from "@/actions/approval.actions";
import { getUsers } from "@/actions/user.actions";
import { Button } from "@/components/ui/button";
import { ApprovalRuleForm } from "../_components/approval-rule-form";
import { ChainBuilder } from "../_components/chain-builder";

export const metadata: Metadata = { title: "Edit Approval Rule" };

// ============================================================
// Page
// ============================================================

interface ApprovalRuleDetailPageProps {
  params: Promise<{ ruleId: string }>;
}

export default async function ApprovalRuleDetailPage({
  params,
}: ApprovalRuleDetailPageProps) {
  const { ruleId } = await params;

  // Handle "new" route
  const isNew = ruleId === "new";

  let rule = null;
  if (!isNew) {
    const result = await getApprovalRule(ruleId);
    if (!result.success || !result.data) {
      notFound();
    }
    rule = result.data;
  }

  const usersResult = await getUsers({ limit: 100 });
  const users = usersResult.success ? usersResult.data.users : [];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/approval-rules">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to Rules
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? "Create Approval Rule" : `Edit: ${rule?.name}`}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isNew
            ? "Define conditions and an approval chain for automatic routing."
            : "Update rule settings, conditions, and the approval chain."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ApprovalRuleForm
          rule={rule}
          users={users}
        />
        <ChainBuilder
          ruleId={isNew ? null : rule?.id ?? null}
          initialSteps={rule?.approverChain ?? []}
          users={users}
        />
      </div>
    </div>
  );
}
