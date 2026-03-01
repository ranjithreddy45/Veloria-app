import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getScoringRuleSet } from "@/actions/scoring-rule.actions";
import { Button } from "@/components/ui/button";
import { ScoringRulesManager } from "./_components/scoring-rules-manager";

export const metadata: Metadata = { title: "Scoring Rules" };

interface Props {
  params: Promise<{ ruleSetId: string }>;
}

export default async function ScoringRuleSetDetailPage({ params }: Props) {
  const { ruleSetId } = await params;
  const result = await getScoringRuleSet(ruleSetId);

  if (!result.success) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/scoring-rules">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back
          </Button>
        </Link>
      </div>
      <ScoringRulesManager ruleSet={result.data} />
    </div>
  );
}
