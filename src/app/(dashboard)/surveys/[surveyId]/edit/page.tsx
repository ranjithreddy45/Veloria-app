import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSurveyById } from "@/actions/survey.actions";
import { PageHeader } from "@/components/layout/page-header";
import { SurveyForm } from "../../_components/survey-form";

export const metadata: Metadata = { title: "Edit Survey" };

// ============================================================
// Edit Survey Page
// ============================================================

interface EditSurveyPageProps {
  params: Promise<{ surveyId: string }>;
}

export default async function EditSurveyPage({
  params,
}: EditSurveyPageProps) {
  const { surveyId } = await params;
  const result = await getSurveyById(surveyId);

  if (!result.success || !result.data) {
    notFound();
  }

  const survey = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Survey"
        description={`Editing "${survey.title}"`}
      />
      <div className="mx-auto max-w-3xl">
        <SurveyForm survey={survey} />
      </div>
    </div>
  );
}
