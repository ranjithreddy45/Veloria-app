"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createSurvey, updateSurvey } from "@/actions/survey.actions";
import { SURVEY_QUESTION_TYPE_LABELS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

interface QuestionDraft {
  id: string;
  question: string;
  type: "RATING" | "TEXT" | "MULTIPLE_CHOICE" | "NPS";
  options: string[];
  isRequired: boolean;
  order: number;
}

interface ExistingSurvey {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  questions: {
    id: string;
    question: string;
    type: string;
    options: unknown;
    isRequired: boolean;
    order: number;
  }[];
}

interface SurveyFormProps {
  survey?: ExistingSurvey;
}

// ============================================================
// Survey Form Component (with Question Builder)
// ============================================================

export function SurveyForm({ survey }: SurveyFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState(survey?.title ?? "");
  const [description, setDescription] = useState(survey?.description ?? "");
  const [isActive, setIsActive] = useState(survey?.isActive ?? true);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    survey?.questions.map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type as QuestionDraft["type"],
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      isRequired: q.isRequired,
      order: q.order,
    })) ?? []
  );

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        question: "",
        type: "RATING",
        options: [],
        isRequired: true,
        order: prev.length,
      },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateQuestionField<K extends keyof QuestionDraft>(
    index: number,
    field: K,
    value: QuestionDraft[K]
  ) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  }

  function moveQuestion(index: number, direction: "up" | "down") {
    const newQuestions = [...questions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;
    [newQuestions[index], newQuestions[targetIndex]] = [
      newQuestions[targetIndex],
      newQuestions[index],
    ];
    setQuestions(newQuestions.map((q, i) => ({ ...q, order: i })));
  }

  function addOption(qIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, options: [...q.options, ""] } : q
      )
    );
  }

  function updateOption(qIndex: number, optIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const opts = [...q.options];
        opts[optIndex] = value;
        return { ...q, options: opts };
      })
    );
  }

  function removeOption(qIndex: number, optIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        return { ...q, options: q.options.filter((_, oi) => oi !== optIndex) };
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (questions.length === 0) {
      toast.error("Add at least one question");
      return;
    }

    for (const q of questions) {
      if (!q.question.trim()) {
        toast.error("All questions must have text");
        return;
      }
      if (
        q.type === "MULTIPLE_CHOICE" &&
        q.options.filter((o) => o.trim()).length < 2
      ) {
        toast.error("Multiple choice questions need at least 2 options");
        return;
      }
    }

    setLoading(true);

    const payload = {
      title,
      description: description || null,
      isActive,
      questions: questions.map((q, i) => ({
        question: q.question,
        type: q.type,
        options:
          q.type === "MULTIPLE_CHOICE"
            ? q.options.filter((o) => o.trim())
            : null,
        isRequired: q.isRequired,
        order: i,
      })),
    };

    const result = survey
      ? await updateSurvey(survey.id, payload)
      : await createSurvey(payload);

    setLoading(false);

    if (result.success) {
      toast.success(survey ? "Survey updated" : "Survey created");
      router.push("/surveys");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Survey Details */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-zinc-900">
            Survey Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Post-Event Feedback Survey"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this survey..."
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active (accepting responses)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Questions Builder */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-zinc-900">
            Questions ({questions.length})
          </CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addQuestion}>
            <PlusIcon className="mr-2 size-4" />
            Add Question
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-8">
              <p className="text-sm text-zinc-500">No questions added yet</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={addQuestion}
              >
                <PlusIcon className="mr-2 size-4" />
                Add First Question
              </Button>
            </div>
          )}

          {questions.map((q, index) => (
            <div
              key={q.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-zinc-400 flex-shrink-0" />
                  <Badge variant="outline" className="text-xs">
                    Q{index + 1}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
                  >
                    {SURVEY_QUESTION_TYPE_LABELS[q.type] || q.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    onClick={() => moveQuestion(index, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    onClick={() => moveQuestion(index, "down")}
                    disabled={index === questions.length - 1}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 text-red-500 hover:text-red-700"
                    onClick={() => removeQuestion(index)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <Label>Question Text *</Label>
                <Input
                  value={q.question}
                  onChange={(e) =>
                    updateQuestionField(index, "question", e.target.value)
                  }
                  placeholder="Enter your question..."
                />
              </div>

              {/* Question Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={q.type}
                    onValueChange={(val) =>
                      updateQuestionField(
                        index,
                        "type",
                        val as QuestionDraft["type"]
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SURVEY_QUESTION_TYPE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <Switch
                    id={`required-${index}`}
                    checked={q.isRequired}
                    onCheckedChange={(val) =>
                      updateQuestionField(index, "isRequired", val)
                    }
                  />
                  <Label htmlFor={`required-${index}`} className="cursor-pointer text-sm">
                    Required
                  </Label>
                </div>
              </div>

              {/* Multiple Choice Options */}
              {q.type === "MULTIPLE_CHOICE" && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={(e) =>
                          updateOption(index, optIndex, e.target.value)
                        }
                        placeholder={`Option ${optIndex + 1}`}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-red-500 hover:text-red-700"
                        onClick={() => removeOption(index, optIndex)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(index)}
                  >
                    <PlusIcon className="mr-1 size-3.5" />
                    Add Option
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/surveys")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? survey
              ? "Updating..."
              : "Creating..."
            : survey
              ? "Update Survey"
              : "Create Survey"}
        </Button>
      </div>
    </form>
  );
}
