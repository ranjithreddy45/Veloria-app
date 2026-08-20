"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SURVEY_QUESTION_TYPE_LABELS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

interface RatingResult {
  questionId: string;
  question: string;
  type: "RATING";
  totalAnswers: number;
  average: number;
  distribution: Record<string, number>;
}

interface NpsResult {
  questionId: string;
  question: string;
  type: "NPS";
  totalAnswers: number;
  average: number;
}

interface MultipleChoiceResult {
  questionId: string;
  question: string;
  type: "MULTIPLE_CHOICE";
  totalAnswers: number;
  optionCounts: Record<string, number>;
}

interface TextResult {
  questionId: string;
  question: string;
  type: "TEXT";
  totalAnswers: number;
  recentAnswers: string[];
}

type QuestionResult =
  | RatingResult
  | NpsResult
  | MultipleChoiceResult
  | TextResult;

interface SurveyResultsProps {
  questionResults: QuestionResult[];
}

// ============================================================
// Rating Stars Display
// ============================================================

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`size-4 ${
            star <= Math.round(value) ? "text-amber-400" : "text-zinc-200"
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ============================================================
// Survey Results Component
// ============================================================

export function SurveyResults({ questionResults }: SurveyResultsProps) {
  if (questionResults.length === 0) {
    return (
      <Card className="border-zinc-200/80 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">No question results to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {questionResults.map((result, index) => (
        <Card key={result.questionId} className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Q{index + 1}
                </Badge>
                <CardTitle className="text-sm font-semibold text-foreground">
                  {result.question}
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 flex-shrink-0"
              >
                {SURVEY_QUESTION_TYPE_LABELS[result.type]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {result.totalAnswers} response{result.totalAnswers !== 1 ? "s" : ""}
            </p>
          </CardHeader>
          <CardContent>
            {result.type === "RATING" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-foreground">
                    {result.average}
                  </span>
                  <StarRating value={result.average} />
                  <span className="text-sm text-muted-foreground">/ 5</span>
                </div>
                <div className="space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = result.distribution[String(star)] ?? 0;
                    const pct =
                      result.totalAnswers > 0
                        ? Math.round((count / result.totalAnswers) * 100)
                        : 0;
                    return (
                      <div
                        key={star}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="w-4 text-right text-muted-foreground">
                          {star}
                        </span>
                        <div className="flex-1">
                          <Progress value={pct} className="h-2" />
                        </div>
                        <span className="w-12 text-right text-xs text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result.type === "NPS" && (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-foreground">
                  {result.average}
                </span>
                <span className="text-sm text-muted-foreground">
                  average score out of 10
                </span>
              </div>
            )}

            {result.type === "MULTIPLE_CHOICE" && (
              <div className="space-y-2">
                {Object.entries(result.optionCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([option, count]) => {
                    const pct =
                      result.totalAnswers > 0
                        ? Math.round((count / result.totalAnswers) * 100)
                        : 0;
                    return (
                      <div key={option} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground/80">{option}</span>
                          <span className="text-xs text-muted-foreground">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
              </div>
            )}

            {result.type === "TEXT" && (
              <div className="space-y-2">
                {result.recentAnswers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No text responses yet</p>
                ) : (
                  result.recentAnswers.map((answer, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-zinc-100 bg-zinc-50 p-3"
                    >
                      <p className="text-sm text-foreground/80">{answer}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
