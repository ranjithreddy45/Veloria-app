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
      <div className="space-y-10">
        <Link
          href="/portal"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-[13px] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to my portal
        </Link>

        <Card className="shadow-card mx-auto max-w-2xl rounded-2xl py-0">
          <CardContent className="flex flex-col items-center px-6 py-16 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <ClipboardX className="text-muted-foreground/60 size-8" />
            </div>
            <h2 className="font-editorial text-foreground mt-5 text-[22px] font-semibold">
              This survey has closed
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
              It&apos;s either finished collecting responses or the link has
              moved on. Do get in touch if you still have something to tell us —
              we&apos;d love to hear it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const survey = result.data;

  return (
    <div className="space-y-10">
      <Link
        href="/portal"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-[13px] transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to my portal
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
