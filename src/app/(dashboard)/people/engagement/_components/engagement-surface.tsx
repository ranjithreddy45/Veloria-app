"use client";

// ============================================================
// Engagement surface — pulse surveys.
// Everyone: answer active pulses (1–5 + optional comment), see "Thanks, recorded".
// Managers: create a survey, close/reopen, and read anonymised results.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HeartPulse, Plus, Loader2, CheckCircle2, BarChart3, MessageSquareQuote,
  Lock, Users, Sparkles,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  respondToSurvey, createSurvey, closeSurvey,
  getSurveyResults, type ActiveSurveyForMe, type SurveyResults,
} from "@/actions/engagement.actions";

const SCORE_LABELS: Record<number, string> = {
  1: "Very low", 2: "Low", 3: "Okay", 4: "Good", 5: "Great",
};

// ------------------------------------------------------------
// A single answerable pulse card.
// ------------------------------------------------------------
function PulseAnswerCard({ survey }: { survey: ActiveSurveyForMe }) {
  const router = useRouter();
  const [score, setScore] = useState<number>(survey.myResponse?.score ?? 0);
  const [comment, setComment] = useState<string>(survey.myResponse?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const answered = !!survey.myResponse;

  async function submit() {
    if (score < 1 || score > 5) {
      toast.error("Pick a score from 1 to 5.");
      return;
    }
    setSaving(true);
    try {
      const res = await respondToSurvey(survey.id, { score, comment: comment || null });
      if (!res.success) return toast.error(res.error);
      toast.success("Thanks, recorded");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">{survey.title}</h3>
            {answered && (
              <Badge className="shrink-0 border-transparent bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 size-3" /> Recorded
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{survey.question}</p>
        </div>
        <div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                aria-label={`${n} — ${SCORE_LABELS[n]}`}
                className={`flex h-11 flex-1 items-center justify-center rounded-full border text-base font-semibold tabular-nums transition-all duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
                  n === score
                    ? "scale-105 border-transparent bg-gradient-to-br from-violet-500 to-violet-400 text-white shadow-md"
                    : "border-border bg-background text-muted-foreground hover:-translate-y-0.5 hover:border-violet-400 hover:text-foreground hover:shadow-sm"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {score > 0 && (
            <p className="mt-2 text-[12px] font-medium text-violet-600 dark:text-violet-300">{SCORE_LABELS[score]}</p>
          )}
        </div>
        <Textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment (optional, anonymous)…"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Your comment is anonymous.</p>
          <Button size="sm" onClick={submit} disabled={saving || score < 1}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {answered ? "Update response" : "Submit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Create-survey dialog (managers).
// ------------------------------------------------------------
function CreateSurveyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");

  async function submit() {
    if (!title.trim() || !question.trim()) {
      toast.error("Add a title and a question.");
      return;
    }
    setSaving(true);
    try {
      const res = await createSurvey({ title, question });
      if (!res.success) return toast.error(res.error);
      toast.success("Survey created");
      setOpen(false);
      setTitle("");
      setQuestion("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> Create survey</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a pulse survey</DialogTitle>
          <DialogDescription>
            A single 1–5 question the team answers anonymously. Keep it short and specific.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly team pulse" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Question</label>
            <Textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How supported did you feel this week?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Results view for one survey (managers) — loaded on demand.
// ------------------------------------------------------------
function ResultsDialog({ surveyId, title }: { surveyId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SurveyResults | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await getSurveyResults(surveyId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setResults(res.data);
    } finally {
      setLoading(false);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  const maxCount = results ? Math.max(1, ...results.distribution.map((d) => d.count)) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><BarChart3 className="size-4" /> Results</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title} — results</DialogTitle>
          <DialogDescription>Anonymous. No response is tied to a person.</DialogDescription>
        </DialogHeader>
        {loading || !results ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 py-1">
            <div className="flex items-end gap-6">
              <div>
                <div className="text-4xl font-bold tabular-nums">
                  {results.count > 0 ? results.average.toFixed(2) : "—"}
                </div>
                <div className="text-[12px] text-muted-foreground">Average score</div>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-4" /> {results.count} response{results.count === 1 ? "" : "s"}
              </div>
            </div>

            <div className="space-y-1.5">
              {results.distribution
                .slice()
                .reverse()
                .map((d) => (
                  <div key={d.score} className="flex items-center gap-2 text-[13px]">
                    <span className="w-3 text-right font-medium tabular-nums">{d.score}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                        style={{ width: `${(d.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums text-muted-foreground">{d.count}</span>
                  </div>
                ))}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <MessageSquareQuote className="size-4 text-muted-foreground" /> Comments
              </div>
              {results.comments.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {results.comments.map((c, i) => (
                    <li key={i} className="rounded-lg border border-border/70 p-2.5 text-[13px]">
                      <Badge variant="secondary" className="mb-1 text-[10px]">Scored {c.score}/5</Badge>
                      <p>{c.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Manager row — one live survey with results + close/reopen.
// ------------------------------------------------------------
function ManagerSurveyRow({ survey }: { survey: ActiveSurveyForMe }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function close() {
    setBusy(true);
    try {
      const res = await closeSurvey(survey.id);
      if (!res.success) return toast.error(res.error);
      toast.success("Survey closed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{survey.title}</p>
        <p className="truncate text-[12px] text-muted-foreground">{survey.question}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ResultsDialog surveyId={survey.id} title={survey.title} />
        <Button size="sm" variant="ghost" disabled={busy} onClick={close}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Close
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Top-level surface.
// ------------------------------------------------------------
export function EngagementSurface({
  surveys,
  canManage,
}: {
  surveys: ActiveSurveyForMe[];
  canManage: boolean;
}) {
  const answered = surveys.filter((s) => !!s.myResponse);
  const myAvg = answered.length > 0
    ? answered.reduce((sum, s) => sum + (s.myResponse?.score ?? 0), 0) / answered.length
    : null;

  return (
    <div className="space-y-8">
      {surveys.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label="Active pulses"
            value={surveys.length}
            accent="pink"
            icon={<HeartPulse className="size-4" />}
            sub="open right now"
          />
          <StatTile
            label="Answered"
            value={answered.length}
            accent="emerald"
            icon={<CheckCircle2 className="size-4" />}
            sub={`of ${surveys.length} by you`}
          />
          <StatTile
            label="Your avg score"
            value={myAvg != null ? myAvg.toFixed(1) : "—"}
            accent="violet"
            icon={<Sparkles className="size-4" />}
            sub="across answered pulses"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      )}

      {canManage && (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 px-5 py-5">
            <div className="flex flex-row items-center justify-between">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                <BarChart3 className="size-4 text-muted-foreground" /> Manage surveys
              </h2>
              <CreateSurveyDialog />
            </div>
            {surveys.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No active surveys. Create one to start collecting the team pulse.
              </p>
            ) : (
              <div className="space-y-2">
                {surveys.map((s) => (
                  <ManagerSurveyRow key={s.id} survey={s} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <HeartPulse className="size-4" /> Your pulse
        </h2>
        {surveys.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-1 py-10 text-center text-muted-foreground">
              <HeartPulse className="size-6" />
              <p className="text-sm">No active pulse surveys right now.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {surveys.map((s) => (
              <PulseAnswerCard key={s.id} survey={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
