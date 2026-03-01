import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardX } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { getPublicSurvey } from "@/actions/survey.actions";
import { SurveyFeedbackForm } from "./_components/survey-feedback-form";

// ============================================================
// Portal Survey Feedback Page
// ============================================================

export default async function PortalSurveyPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  const result = await getPublicSurvey(surveyId);

  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
        >
          <ArrowLeft className="size-4" />
          Back to Portal
        </Link>

        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ClipboardX className="size-16 text-zinc-300" />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900">
              Survey Not Available
            </h2>
            <p className="mt-2 text-sm text-zinc-500 max-w-md">
              This survey is either not found or no longer accepting responses.
              Please contact us if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const survey = result.data;

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
      >
        <ArrowLeft className="size-4" />
        Back to Portal
      </Link>

      <div className="mx-auto max-w-2xl">
        <SurveyFeedbackForm
          surveyId={survey.id}
          title={survey.title}
          description={survey.description}
          questions={survey.questions}
        />
      </div>
    </div>
  );
}
