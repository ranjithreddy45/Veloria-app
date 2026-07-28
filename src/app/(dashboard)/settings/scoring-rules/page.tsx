import type { Metadata } from "next";
import { GaugeIcon } from "lucide-react";

import { getScoringRuleSets } from "@/actions/scoring-rule.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ScoringRuleSetsTable } from "./_components/scoring-rule-sets-table";

export const metadata: Metadata = { title: "Scoring Rules" };

export default async function ScoringRulesPage() {
  const result = await getScoringRuleSets();
  const ruleSets = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Automation"
        icon={GaugeIcon}
        accent="violet"
        title="Scoring Rules"
        description="Score leads, contacts and deals automatically from your own criteria. Rules run in order and the running total is capped at the rule set's maximum."
      />
      <ScoringRuleSetsTable initialData={ruleSets} />
    </div>
  );
}
