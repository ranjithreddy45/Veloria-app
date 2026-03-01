import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEscalationRuleById } from "@/actions/escalation.actions";
import { PageHeader } from "@/components/layout/page-header";
import { EscalationRuleForm } from "../../_components/escalation-rule-form";

export const metadata: Metadata = {
  title: "Edit Escalation Rule | Veloria Grand",
};

// ============================================================
// Edit Escalation Rule Page
// ============================================================

interface EditEscalationRulePageProps {
  params: Promise<{ ruleId: string }>;
}

export default async function EditEscalationRulePage({
  params,
}: EditEscalationRulePageProps) {
  const { ruleId } = await params;
  const result = await getEscalationRuleById(ruleId);

  if (!result.success || !result.data) {
    notFound();
  }

  const rule = result.data;

  const initialData = {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    priority: rule.priority,
    delayThresholdMinutes: rule.delayThresholdMinutes,
    level: rule.level,
    notifyUserIds: rule.notifyUserIds as string[],
    notifyRoles: rule.notifyRoles as string[],
    isActive: rule.isActive,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Escalation Rule"
        description={`Editing "${rule.name}"`}
      />
      <div className="mx-auto max-w-3xl">
        <EscalationRuleForm initialData={initialData} />
      </div>
    </div>
  );
}
