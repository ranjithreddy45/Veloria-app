import type { Metadata } from "next";
import { getScoringRuleSets } from "@/actions/scoring-rule.actions";
import { ScoringRuleSetsTable } from "./_components/scoring-rule-sets-table";

export const metadata: Metadata = { title: "Scoring Rules" };

export default async function ScoringRulesPage() {
  const result = await getScoringRuleSets();
  const ruleSets = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scoring Rules</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure scoring rule sets to automatically score leads, contacts,
          and deals based on custom criteria. Rules are evaluated in order and
          the total score is capped at the configured maximum.
        </p>
      </div>
      <ScoringRuleSetsTable initialData={ruleSets} />
    </div>
  );
}
