import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getSurveys } from "@/actions/survey.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SurveysTable } from "./_components/surveys-table";

export const metadata: Metadata = { title: "Surveys & Feedback" };

// ============================================================
// Surveys List Page
// ============================================================

export default async function SurveysPage() {
  const result = await getSurveys();

  const surveys = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surveys & Feedback"
        description="Create surveys to collect feedback from your clients."
      >
        <Button asChild>
          <Link href="/surveys/new">
            <PlusIcon className="mr-2 size-4" />
            New Survey
          </Link>
        </Button>
      </PageHeader>
      <SurveysTable data={surveys} />
    </div>
  );
}
