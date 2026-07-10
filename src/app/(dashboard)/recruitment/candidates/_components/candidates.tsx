"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Star, Users, X } from "lucide-react";
import { toast } from "sonner";

import {
  createCandidate,
  setCandidateStage,
  updateCandidateResume,
} from "@/actions/recruit.actions";
import { FileUpload } from "@/components/ui/file-upload";
import { REC_CANDIDATE_STAGES } from "@/lib/recruit/constants";
import { FacetFilterRail, type FacetDef } from "@/components/shared/facet-filter-rail";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
import { formatDate, cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

type Stage = (typeof REC_CANDIDATE_STAGES)[number];

interface CandidateRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string | null;
  rating: number;
  stage: Stage;
  resumeUrl: string | null;
  owner: string | null;
  modifiedAt: string;
}

interface CandidatesData {
  rows: CandidateRow[];
  stageCounts: Record<string, number>;
}

// ============================================================
// Stage theming — one hue per stage, used by the funnel + pills
// ============================================================

const STAGE_HUE: Record<Stage, Hue> = {
  NEW: "slate",
  IN_REVIEW: "blue",
  AVAILABLE: "cyan",
  ENGAGED: "violet",
  OFFERED: "amber",
  HIRED: "emerald",
  REJECTED: "rose",
};

const STAGE_LABEL: Record<Stage, string> = {
  NEW: "New",
  IN_REVIEW: "In Review",
  AVAILABLE: "Available",
  ENGAGED: "Engaged",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

// Funnel cell accents — bordered/tinted strip cells, per stage hue.
const STAGE_CELL: Record<Stage, string> = {
  NEW: "border-slate-200/80 bg-slate-50/60 text-slate-700",
  IN_REVIEW: "border-blue-200/80 bg-blue-50/60 text-blue-700",
  AVAILABLE: "border-cyan-200/80 bg-cyan-50/60 text-cyan-700",
  ENGAGED: "border-violet-200/80 bg-violet-50/60 text-violet-700",
  OFFERED: "border-amber-200/80 bg-amber-50/60 text-amber-700",
  HIRED: "border-emerald-200/80 bg-emerald-50/60 text-emerald-700",
  REJECTED: "border-rose-200/80 bg-rose-50/60 text-rose-700",
};

// Deterministic avatar tint by name.
const AVATAR_TINTS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-teal-100 text-teal-700",
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

// ============================================================
// Stage funnel strip
// ============================================================

function StageStrip({ counts }: { counts: Record<string, number> }) {
  return (
    <Card className="overflow-hidden p-0 shadow-card">
      <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0">
        {REC_CANDIDATE_STAGES.map((stage) => (
          <div
            key={stage}
            className={cn("flex flex-col gap-0.5 border-l-2 px-4 py-3.5", STAGE_CELL[stage])}
          >
            <span className="text-[22px] font-semibold leading-none tabular-nums">
              {counts[stage] ?? 0}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              {STAGE_LABEL[stage]}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Rating — N/5 with star glyphs
// ============================================================

function Rating({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="inline-flex items-center gap-1" title={`${v}/5`}>
      <div className="flex items-center gap-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i < v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{v}/5</span>
    </div>
  );
}

// ============================================================
// Inline stage control — Select (write) or StatusPill (read-only)
// ============================================================

function StageCell({
  row,
  canWrite,
  onChanged,
}: {
  row: CandidateRow;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = React.useState(false);

  if (!canWrite) {
    return (
      <StatusPill label={STAGE_LABEL[row.stage]} hue={STAGE_HUE[row.stage]} size="sm" />
    );
  }

  async function onChange(next: string) {
    if (next === row.stage) return;
    setPending(true);
    const res = await setCandidateStage(row.id, next);
    setPending(false);
    if (res.success) {
      toast.success(`Moved ${row.name} to ${STAGE_LABEL[next as Stage]}`);
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Select value={row.stage} onValueChange={onChange} disabled={pending}>
      <SelectTrigger size="sm" className="h-7 w-[140px] text-[12.5px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {REC_CANDIDATE_STAGES.map((s) => (
          <SelectItem key={s} value={s} className="text-[12.5px]">
            {STAGE_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================
// Resume cell — link when present; attach control for write users
// ============================================================

function ResumeCell({
  row,
  canWrite,
  onChanged,
}: {
  row: CandidateRow;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = React.useState(false);

  async function save(url: string | null) {
    setPending(true);
    const res = await updateCandidateResume(row.id, url);
    setPending(false);
    if (res.success) {
      toast.success(url ? "Resume attached." : "Resume removed.");
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  if (row.resumeUrl) {
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={row.resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
        >
          <FileText className="size-3.5" /> Resume
        </a>
        {canWrite && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-muted-foreground"
            onClick={() => save(null)}
            disabled={pending}
            title="Remove resume"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    );
  }

  if (canWrite) {
    return (
      <FileUpload
        accept=".pdf,image/*"
        maxMB={1}
        label="Attach"
        variant="ghost"
        size="sm"
        disabled={pending}
        onUploaded={(dataUrl) => save(dataUrl)}
      />
    );
  }

  return <span className="text-[12.5px] text-muted-foreground">No resume</span>;
}

// ============================================================
// New-candidate dialog
// ============================================================

function NewCandidateDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [resume, setResume] = React.useState<{ url: string; name: string } | null>(null);
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    source: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) {
      toast.error("First name is required.");
      return;
    }
    setPending(true);
    const res = await createCandidate({
      firstName: form.firstName,
      lastName: form.lastName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      city: form.city || undefined,
      source: form.source || undefined,
      resumeUrl: resume?.url || undefined,
    });
    setPending(false);
    if (res.success) {
      toast.success("Candidate added.");
      setForm({ firstName: "", lastName: "", email: "", phone: "", city: "", source: "" });
      setResume(null);
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
          <Plus className="size-4" /> New candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New candidate</DialogTitle>
            <DialogDescription>Add a candidate to your talent pool.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                placeholder="Referral, LinkedIn, Direct…"
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Resume</Label>
              {resume ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/40 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-foreground">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{resume.name}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground"
                    onClick={() => setResume(null)}
                    disabled={pending}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <FileUpload
                  accept=".pdf,image/*"
                  maxMB={1}
                  label="Attach resume (PDF or image)"
                  variant="outline"
                  disabled={pending}
                  className="w-full"
                  onUploaded={(dataUrl, file) => setResume({ url: dataUrl, name: file.name })}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add candidate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Main
// ============================================================

const FACETS: FacetDef<CandidateRow>[] = [
  { key: "stage", label: "Stage", get: (c) => c.stage, format: (v) => STAGE_LABEL[v as Stage] ?? v },
  { key: "city", label: "City", get: (c) => c.city, max: 8 },
  { key: "source", label: "Source", get: (c) => c.source, max: 8 },
];

export function Candidates({
  data,
  canWrite,
}: {
  data: CandidatesData;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [faceted, setFaceted] = React.useState<CandidateRow[]>(data.rows);

  const handleFacetChange = React.useCallback((rows: CandidateRow[]) => {
    setFaceted(rows);
  }, []);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faceted;
    return faceted.filter((r) => r.name.toLowerCase().includes(q));
  }, [faceted, query]);

  return (
    <div className="space-y-5">
      <StageStrip counts={data.stageCounts} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="h-9 pl-8"
          />
        </div>
        {canWrite && <NewCandidateDialog />}
      </div>

      <div className="flex gap-4">
        <FacetFilterRail
          items={data.rows}
          facets={FACETS}
          onChange={handleFacetChange}
          className="hidden lg:block"
        />

        <Card className="min-w-0 flex-1 overflow-hidden p-0 shadow-card">
          {visible.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title={data.rows.length === 0 ? "No candidates yet" : "No matching candidates"}
              description={
                data.rows.length === 0
                  ? "Add your first candidate to start building the talent pool."
                  : "Try clearing filters or adjusting your search."
              }
              action={data.rows.length === 0 && canWrite ? <NewCandidateDialog /> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-[130px]">Rating</TableHead>
                    <TableHead>Candidate Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Candidate Stage</TableHead>
                    <TableHead>Resume</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Modified Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => (
                    <TableRow key={row.id} className="transition-premium hover:bg-muted/40">
                      <TableCell>
                        <Rating value={row.rating} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar size="sm">
                            <AvatarFallback
                              className={cn("text-[10.5px] font-semibold", tintFor(row.id))}
                            >
                              {initialsOf(row.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 leading-tight">
                            <a
                              href={`/recruitment/candidates/${row.id}`}
                              className="block truncate text-[13px] font-medium text-foreground hover:text-primary hover:underline"
                            >
                              {row.name}
                            </a>
                            {row.email && (
                              <span className="block truncate text-[11.5px] text-muted-foreground">
                                {row.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-foreground/80">
                        {row.city || "—"}
                      </TableCell>
                      <TableCell>
                        <StageCell row={row} canWrite={canWrite} onChanged={() => router.refresh()} />
                      </TableCell>
                      <TableCell>
                        <ResumeCell row={row} canWrite={canWrite} onChanged={() => router.refresh()} />
                      </TableCell>
                      <TableCell className="text-[13px] text-foreground/80">
                        {row.source || "—"}
                      </TableCell>
                      <TableCell className="text-[13px] text-foreground/80">
                        {row.owner || "—"}
                      </TableCell>
                      <TableCell className="text-right text-[12.5px] tabular-nums text-muted-foreground">
                        {formatDate(row.modifiedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
