import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PencilIcon,
  ClipboardList,
  BarChart3,
  MessageSquare,
  Star,
} from "lucide-react";
import { getSurveyById, getSurveyResults } from "@/actions/survey.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { SURVEY_QUESTION_TYPE_LABELS } from "@/lib/constants";
import { NpsChart } from "./_components/nps-chart";
import { SurveyResults } from "./_components/survey-results";
import { SendInvitationDialog } from "./_components/send-invitation-dialog";

export const metadata = {
  title: "Survey Details",
};

// ============================================================
// Survey Detail Page
// ============================================================

interface SurveyDetailPageProps {
  params: Promise<{ surveyId: string }>;
}

export default async function SurveyDetailPage({
  params,
}: SurveyDetailPageProps) {
  const { surveyId } = await params;

  const [surveyResult, resultsResult] = await Promise.all([
    getSurveyById(surveyId),
    getSurveyResults(surveyId),
  ]);

  if (!surveyResult.success || !surveyResult.data) {
    notFound();
  }

  const survey = surveyResult.data;
  const results = resultsResult.success ? resultsResult.data : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={survey.title}
        description={survey.description || "No description provided"}
      >
        <Badge
          variant="outline"
          className={
            survey.isActive
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-zinc-100 text-zinc-600 border-zinc-200"
          }
        >
          {survey.isActive ? "Active" : "Inactive"}
        </Badge>
        <SendInvitationDialog surveyId={surveyId} />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/surveys/${surveyId}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50">
                <ClipboardList className="size-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Questions</p>
                <p className="text-xl font-bold text-foreground">
                  {survey._count.questions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50">
                <MessageSquare className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Responses</p>
                <p className="text-xl font-bold text-foreground">
                  {survey._count.responses}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Star className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Rating</p>
                <p className="text-xl font-bold text-foreground">
                  {results?.averageRating !== null && results?.averageRating !== undefined
                    ? `${results.averageRating.toFixed(1)} / 5`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <BarChart3 className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">NPS Score</p>
                <p className="text-xl font-bold text-foreground">
                  {results?.npsScore !== null && results?.npsScore !== undefined
                    ? results.npsScore > 0
                      ? `+${results.npsScore}`
                      : results.npsScore
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Results / Questions / Responses */}
      <Tabs defaultValue="results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="responses">Responses ({survey._count.responses})</TabsTrigger>
        </TabsList>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {results ? (
                <SurveyResults questionResults={results.questionResults} />
              ) : (
                <Card className="border-zinc-200/80 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      No results available yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
            <div>
              <NpsChart
                npsScore={results?.npsScore ?? null}
                breakdown={
                  results?.npsBreakdown ?? {
                    promoters: 0,
                    passives: 0,
                    detractors: 0,
                  }
                }
                totalResponses={results?.totalResponses ?? 0}
              />
            </div>
          </div>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions">
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Survey Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {survey.questions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No questions in this survey
                </p>
              ) : (
                <div className="space-y-3">
                  {survey.questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4"
                    >
                      <Badge
                        variant="outline"
                        className="mt-0.5 flex-shrink-0 text-xs"
                      >
                        Q{index + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {question.question}
                          {question.isRequired && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
                          >
                            {SURVEY_QUESTION_TYPE_LABELS[question.type]}
                          </Badge>
                          {question.type === "MULTIPLE_CHOICE" &&
                            Array.isArray(question.options) && (
                              <span className="text-xs text-muted-foreground">
                                {(question.options as string[]).length} options
                              </span>
                            )}
                        </div>
                        {question.type === "MULTIPLE_CHOICE" &&
                          Array.isArray(question.options) && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(question.options as string[]).map((opt, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {opt}
                                </Badge>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Responses Tab */}
        <TabsContent value="responses">
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Individual Responses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {survey.responses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="size-10 text-zinc-300" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">
                    No responses yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Share the survey link to start collecting feedback.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {survey.responses.map((response, rIndex) => (
                    <div
                      key={response.id}
                      className="rounded-lg border border-zinc-200 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            #{rIndex + 1}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(response.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {response.overallRating && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                            >
                              Rating: {response.overallRating}/5
                            </Badge>
                          )}
                          {response.npsScore !== null && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                            >
                              NPS: {response.npsScore}/10
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {response.answers.map((answer) => (
                          <div
                            key={answer.id}
                            className="flex gap-2 text-sm"
                          >
                            <span className="font-medium text-muted-foreground flex-shrink-0">
                              {answer.question?.question ?? "Question"}:
                            </span>
                            <span className="text-foreground/80">{answer.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
