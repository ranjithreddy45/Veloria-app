import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EscalationRuleForm } from "../_components/escalation-rule-form";

export const metadata: Metadata = {
  title: "New Escalation Rule",
};

// ============================================================
// Create Escalation Rule Page
// ============================================================

export default function NewEscalationRulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Escalation Rule"
        description="Define when and how overdue tasks should be escalated."
      />
      <div className="mx-auto max-w-3xl">
        <EscalationRuleForm />
      </div>
    </div>
  );
}
