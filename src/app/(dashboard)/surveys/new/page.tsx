import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SurveyForm } from "../_components/survey-form";

export const metadata: Metadata = { title: "New Survey" };

// ============================================================
// Create Survey Page
// ============================================================

export default function NewSurveyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Survey"
        description="Create a new feedback survey with a question builder."
      />
      <div className="mx-auto max-w-3xl">
        <SurveyForm />
      </div>
    </div>
  );
}
