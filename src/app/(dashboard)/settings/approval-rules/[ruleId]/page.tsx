import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";

import { getApprovalRule } from "@/actions/approval.actions";
import { getUsers } from "@/actions/user.actions";
import { PageHeader } from "@/components/layout/page-header";
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
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 h-8 text-muted-foreground hover:text-foreground"
        >
          <Link href="/settings/approval-rules">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to Rules
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Settings · Governance"
        icon={ShieldCheckIcon}
        accent="emerald"
        title={isNew ? "Create Approval Rule" : rule?.name ?? "Approval Rule"}
        description={
          isNew
            ? "Define the conditions that trigger this rule, then build the chain of approvers a matching request has to clear."
            : "Update this rule's settings, matching conditions and approval chain. Changes apply to requests raised from now on."
        }
      />

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
