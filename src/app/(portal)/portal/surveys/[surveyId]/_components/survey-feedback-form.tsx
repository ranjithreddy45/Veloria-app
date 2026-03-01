"use client";

import { useState } from "react";
import { Star, Send, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SURVEY_QUESTION_TYPE_LABELS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

interface Question {
  id: string;
  question: string;
  type: string;
  options: unknown;
  isRequired: boolean;
  order: number;
}

interface SurveyFeedbackFormProps {
  surveyId: string;
  title: string;
  description: string | null;
  questions: Question[];
}

// ============================================================
// Star Rating Input
// ============================================================

function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 transition-transform hover:scale-110"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={`size-7 transition-colors ${
              star <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-300"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm font-medium text-zinc-600">
          {value}/5
        </span>
      )}
    </div>
  );
}

// ============================================================
// NPS Score Input
// ============================================================

function NpsScoreInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => i).map((score) => (
          <button
            key={score}
            type="button"
            className={`flex-1 rounded-md border py-2 text-sm font-medium transition-all ${
              value === score
                ? score <= 6
                  ? "border-red-300 bg-red-100 text-red-700"
                  : score <= 8
                    ? "border-amber-300 bg-amber-100 text-amber-700"
                    : "border-emerald-300 bg-emerald-100 text-emerald-700"
                : "border-zinc-200 bg-white dark:bg-card text-zinc-600 hover:border-indigo-200 hover:bg-indigo-50"
            }`}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Survey Feedback Form
// ============================================================

export function SurveyFeedbackForm({
  surveyId,
  title,
  description,
  questions,
}: SurveyFeedbackFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [overallRating, setOverallRating] = useState<number>(0);
  const [npsScore, setNpsScore] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate required questions
    for (const q of questions) {
      if (q.isRequired && !answers[q.id]) {
        setError(`Please answer: "${q.question}"`);
        return;
      }
    }

    setLoading(true);

    // Determine overall rating and NPS from answers
    const ratingQuestion = questions.find((q) => q.type === "RATING");
    const npsQuestion = questions.find((q) => q.type === "NPS");
    const computedOverallRating = ratingQuestion
      ? parseInt(answers[ratingQuestion.id]) || null
      : overallRating > 0
        ? overallRating
        : null;
    const computedNps = npsQuestion
      ? parseInt(answers[npsQuestion.id]) || null
      : npsScore >= 0
        ? npsScore
        : null;

    try {
      const res = await fetch(`/api/surveys/${surveyId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallRating: computedOverallRating,
          npsScore: computedNps,
          answers: Object.entries(answers)
            .filter(([, value]) => value.trim() !== "")
            .map(([questionId, value]) => ({
              questionId,
              value,
            })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to submit feedback");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Success state
  if (submitted) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="size-16 text-emerald-600" />
          <h2 className="mt-4 text-xl font-bold text-emerald-900">
            Thank You!
          </h2>
          <p className="mt-2 text-sm text-emerald-700 max-w-md">
            Your feedback has been submitted successfully. We appreciate you
            taking the time to help us improve our services.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Survey Header */}
      <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-2 text-sm text-indigo-100">{description}</p>
          )}
          <p className="mt-3 text-xs text-indigo-200">
            {questions.filter((q) => q.isRequired).length} required question
            {questions.filter((q) => q.isRequired).length !== 1 ? "s" : ""}
          </p>
        </div>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Questions */}
      {questions.map((question, index) => (
        <Card key={question.id} className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-zinc-900">
              <span className="text-indigo-600 mr-1.5">Q{index + 1}.</span>
              {question.question}
              {question.isRequired && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </CardTitle>
            <p className="text-xs text-zinc-400">
              {SURVEY_QUESTION_TYPE_LABELS[question.type]}
            </p>
          </CardHeader>
          <CardContent>
            {question.type === "RATING" && (
              <StarRatingInput
                value={parseInt(answers[question.id] || "0")}
                onChange={(v) => updateAnswer(question.id, String(v))}
              />
            )}

            {question.type === "NPS" && (
              <NpsScoreInput
                value={parseInt(answers[question.id] ?? "-1")}
                onChange={(v) => updateAnswer(question.id, String(v))}
              />
            )}

            {question.type === "TEXT" && (
              <Textarea
                value={answers[question.id] || ""}
                onChange={(e) => updateAnswer(question.id, e.target.value)}
                placeholder="Type your answer here..."
                rows={3}
              />
            )}

            {question.type === "MULTIPLE_CHOICE" &&
              Array.isArray(question.options) && (
                <RadioGroup
                  value={answers[question.id] || ""}
                  onValueChange={(val) => updateAnswer(question.id, val)}
                >
                  <div className="space-y-2">
                    {(question.options as string[]).map((option) => (
                      <div
                        key={option}
                        className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-3 transition-colors hover:bg-zinc-50"
                      >
                        <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                        <Label
                          htmlFor={`${question.id}-${option}`}
                          className="cursor-pointer text-sm text-zinc-700 flex-1"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}
          </CardContent>
        </Card>
      ))}

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading} size="lg">
          {loading ? (
            "Submitting..."
          ) : (
            <>
              <Send className="mr-2 size-4" />
              Submit Feedback
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
