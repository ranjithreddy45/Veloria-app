"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarPlus,
  CalendarClock,
  FileText,
  Plus,
  Star,
  Video,
  Phone,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

import {
  scheduleInterview,
  setInterviewOutcome,
  createOffer,
  setOfferStatus,
} from "@/actions/recruit-candidate.actions";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";

import {
  APP_STAGE_HUE,
  APP_STAGE_LABEL,
  INTERVIEW_MODES,
  INTERVIEW_MODE_LABEL,
  INTERVIEW_STATUSES,
  INTERVIEW_STATUS_HUE,
  INTERVIEW_STATUS_LABEL,
  OFFER_STATUS_HUE,
  OFFER_STATUS_LABEL,
  type ApplicationView,
  type InterviewView,
  type JobOption,
  type OfferView,
} from "./shared";

// ============================================================
// Mode glyph
// ============================================================
function ModeIcon({ mode }: { mode: string }) {
  if (mode === "VIDEO") return <Video className="size-3.5" />;
  if (mode === "PHONE") return <Phone className="size-3.5" />;
  return <MapPin className="size-3.5" />;
}

function MiniStars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  if (v === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${v}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3",
            i < v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"
          )}
        />
      ))}
    </span>
  );
}

// ============================================================
// Schedule interview dialog
// ============================================================
function ScheduleInterviewDialog({
  candidateId,
  applications,
}: {
  candidateId: string;
  applications: ApplicationView[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({
    round: "",
    mode: "VIDEO" as string,
    scheduledAt: "",
    applicationId: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.round.trim()) {
      toast.error("Round is required.");
      return;
    }
    if (!form.scheduledAt) {
      toast.error("Pick a date & time.");
      return;
    }
    setPending(true);
    const res = await scheduleInterview({
      candidateId,
      applicationId: form.applicationId || undefined,
      round: form.round,
      mode: form.mode,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
    });
    setPending(false);
    if (res.success) {
      toast.success("Interview scheduled.");
      setForm({ round: "", mode: "VIDEO", scheduledAt: "", applicationId: "" });
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarPlus className="size-4" /> Schedule interview
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Schedule interview</DialogTitle>
            <DialogDescription>Set up an interview round for this candidate.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="round">Round</Label>
              <Input
                id="round"
                value={form.round}
                onChange={(e) => set("round", e.target.value)}
                placeholder="Phone, Technical, HR…"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mode">Mode</Label>
              <Select value={form.mode} onValueChange={(v) => set("mode", v)}>
                <SelectTrigger id="mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {INTERVIEW_MODE_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="scheduledAt">Date &amp; time</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => set("scheduledAt", e.target.value)}
                required
              />
            </div>
            {applications.length > 0 && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="application">Application (optional)</Label>
                <Select
                  value={form.applicationId || "none"}
                  onValueChange={(v) => set("applicationId", v === "none" ? "" : v)}
                >
                  <SelectTrigger id="application" className="w-full">
                    <SelectValue placeholder="No specific role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific role</SelectItem>
                    {applications.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.jobTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Set-outcome dialog (per interview)
// ============================================================
function OutcomeDialog({ interview }: { interview: InterviewView }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState(interview.status);
  const [rating, setRating] = React.useState(String(interview.rating || 0));
  const [feedback, setFeedback] = React.useState(interview.feedback ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await setInterviewOutcome(interview.id, {
      status,
      rating: Number(rating) || 0,
      feedback,
    });
    setPending(false);
    if (res.success) {
      toast.success("Outcome saved.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-detail">
          Set outcome
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{interview.round} — outcome</DialogTitle>
            <DialogDescription>Record the result and feedback for this round.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INTERVIEW_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rating">Rating</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger id="rating" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 0 ? "Not rated" : `${n}/5`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                placeholder="Notes from the interview…"
                className="resize-none text-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save outcome"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Create offer dialog
// ============================================================
function CreateOfferDialog({
  candidateId,
  jobOptions,
}: {
  candidateId: string;
  jobOptions: JobOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({
    ctc: "",
    joiningDate: "",
    jobOpeningId: "",
    notes: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ctc = Number(form.ctc);
    if (!isFinite(ctc) || ctc <= 0) {
      toast.error("Enter a valid CTC.");
      return;
    }
    setPending(true);
    const res = await createOffer({
      candidateId,
      jobOpeningId: form.jobOpeningId || undefined,
      ctc,
      joiningDate: form.joiningDate
        ? new Date(form.joiningDate).toISOString()
        : undefined,
      notes: form.notes || undefined,
    });
    setPending(false);
    if (res.success) {
      toast.success("Offer created.");
      setForm({ ctc: "", joiningDate: "", jobOpeningId: "", notes: "" });
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Create offer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Create offer</DialogTitle>
            <DialogDescription>Draft an offer for this candidate.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="ctc">CTC (₹ / year)</Label>
              <Input
                id="ctc"
                type="number"
                min="0"
                step="1000"
                value={form.ctc}
                onChange={(e) => set("ctc", e.target.value)}
                placeholder="1200000"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="joiningDate">Joining date</Label>
              <Input
                id="joiningDate"
                type="date"
                value={form.joiningDate}
                onChange={(e) => set("joiningDate", e.target.value)}
              />
            </div>
            {jobOptions.length > 0 && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="offerJob">Role (optional)</Label>
                <Select
                  value={form.jobOpeningId || "none"}
                  onValueChange={(v) => set("jobOpeningId", v === "none" ? "" : v)}
                >
                  <SelectTrigger id="offerJob" className="w-full">
                    <SelectValue placeholder="No specific role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific role</SelectItem>
                    {jobOptions.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="offerNotes">Notes</Label>
              <Textarea
                id="offerNotes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="Terms, conditions, comments…"
                className="resize-none text-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create offer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Offer status actions
// ============================================================
function OfferActions({ offer }: { offer: OfferView }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function act(status: string) {
    setPending(true);
    const res = await setOfferStatus(offer.id, status);
    setPending(false);
    if (res.success) {
      toast.success(`Offer ${OFFER_STATUS_LABEL[status]?.toLowerCase() ?? "updated"}.`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  // Allowed transitions per current status.
  const actions: { label: string; status: string }[] = [];
  if (offer.status === "DRAFT") actions.push({ label: "Send", status: "SENT" });
  if (offer.status === "SENT") {
    actions.push({ label: "Accept", status: "ACCEPTED" });
    actions.push({ label: "Decline", status: "DECLINED" });
  }
  if (offer.status === "DRAFT" || offer.status === "SENT") {
    actions.push({ label: "Withdraw", status: "WITHDRAWN" });
  }
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a) => (
        <Button
          key={a.status}
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-detail"
          disabled={pending}
          onClick={() => act(a.status)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================================
// Tab panels
// ============================================================
function ApplicationsPanel({ applications }: { applications: ApplicationView[] }) {
  if (applications.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="size-5" />}
        title="No applications"
        description="This candidate isn't linked to any job opening yet."
      />
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {applications.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Briefcase className="size-4" />
            </span>
            <span className="truncate text-body font-medium text-foreground">
              {a.jobTitle}
            </span>
          </div>
          <StatusPill
            label={APP_STAGE_LABEL[a.stage] ?? a.stage}
            hue={APP_STAGE_HUE[a.stage] ?? "neutral"}
            size="sm"
          />
        </li>
      ))}
    </ul>
  );
}

function InterviewsPanel({
  interviews,
  canWrite,
}: {
  interviews: InterviewView[];
  canWrite: boolean;
}) {
  if (interviews.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-5" />}
        title="No interviews scheduled"
        description={
          canWrite
            ? "Schedule the first interview round for this candidate."
            : "No interview rounds have been scheduled yet."
        }
      />
    );
  }
  return (
    <ol className="relative space-y-4 px-4 py-4 before:absolute before:left-[26px] before:top-5 before:bottom-5 before:w-px before:bg-border/70">
      {interviews.map((iv) => (
        <li key={iv.id} className="relative flex gap-3.5">
          <span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border">
            <ModeIcon mode={iv.mode} />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-medium text-foreground">{iv.round}</span>
              <span className="text-meta text-muted-foreground">
                {INTERVIEW_MODE_LABEL[iv.mode] ?? iv.mode}
              </span>
              <StatusPill
                label={INTERVIEW_STATUS_LABEL[iv.status] ?? iv.status}
                hue={INTERVIEW_STATUS_HUE[iv.status] ?? "neutral"}
                size="xs"
              />
              <MiniStars value={iv.rating} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-detail text-muted-foreground">
              <span className="tabular-nums">{formatDateTime(iv.scheduledAt)}</span>
              {iv.interviewerName && <span>· {iv.interviewerName}</span>}
            </div>
            {iv.feedback && (
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-detail text-foreground/80">
                {iv.feedback}
              </p>
            )}
            {canWrite && (
              <div className="pt-0.5">
                <OutcomeDialog interview={iv} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function OffersPanel({
  offers,
  canWrite,
}: {
  offers: OfferView[];
  canWrite: boolean;
}) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="No offers"
        description={
          canWrite
            ? "Create an offer once the candidate clears interviews."
            : "No offers have been extended to this candidate."
        }
      />
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {offers.map((o) => (
        <li key={o.id} className="space-y-2.5 px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-copy font-semibold tabular-nums text-foreground">
                {formatINR(o.ctc)}
              </span>
              <span className="text-meta text-muted-foreground">/ year</span>
              <StatusPill
                label={OFFER_STATUS_LABEL[o.status] ?? o.status}
                hue={OFFER_STATUS_HUE[o.status] ?? "neutral"}
                size="sm"
              />
            </div>
            {canWrite && <OfferActions offer={o} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-detail text-muted-foreground">
            {o.jobTitle && <span>{o.jobTitle}</span>}
            <span className="tabular-nums">Joining {formatDate(o.joiningDate)}</span>
          </div>
          {o.notes && (
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-detail text-foreground/80">
              {o.notes}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// Main
// ============================================================
export function CandidateActivity({
  candidateId,
  applications,
  interviews,
  offers,
  jobOptions,
  canWrite,
}: {
  candidateId: string;
  applications: ApplicationView[];
  interviews: InterviewView[];
  offers: OfferView[];
  jobOptions: JobOption[];
  canWrite: boolean;
}) {
  return (
    <Tabs defaultValue="interviews" className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="applications">
            Applications
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {applications.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="interviews">
            Interviews
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {interviews.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="offers">
            Offers
            <span className="ml-1.5 tabular-nums text-muted-foreground">{offers.length}</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="applications">
        <Card className="overflow-hidden p-0 shadow-card">
          <ApplicationsPanel applications={applications} />
        </Card>
      </TabsContent>

      <TabsContent value="interviews" className="space-y-3">
        {canWrite && (
          <div className="flex justify-end">
            <ScheduleInterviewDialog candidateId={candidateId} applications={applications} />
          </div>
        )}
        <Card className="overflow-hidden p-0 shadow-card">
          <InterviewsPanel interviews={interviews} canWrite={canWrite} />
        </Card>
      </TabsContent>

      <TabsContent value="offers" className="space-y-3">
        {canWrite && (
          <div className="flex justify-end">
            <CreateOfferDialog candidateId={candidateId} jobOptions={jobOptions} />
          </div>
        )}
        <Card className="overflow-hidden p-0 shadow-card">
          <OffersPanel offers={offers} canWrite={canWrite} />
        </Card>
      </TabsContent>
    </Tabs>
  );
}
