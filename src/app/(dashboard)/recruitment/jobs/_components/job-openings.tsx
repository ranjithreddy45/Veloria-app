"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase, Plus, CheckCircle2, Layers, Sparkles, Pencil } from "lucide-react";

import {
  createJobOpening,
  updateJobOpening,
  setJobStatus,
} from "@/actions/recruit.actions";
import { REC_JOB_STATUSES } from "@/lib/recruit/constants";
import { formatDate } from "@/lib/utils";

import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { FacetFilterRail, type FacetDef } from "@/components/shared/facet-filter-rail";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Types — derived from the recruit.actions exports.
// ============================================================
type Opening = {
  id: string;
  postingTitle: string;
  department: string | null;
  city: string | null;
  status: "IN_PROGRESS" | "ON_HOLD" | "INACTIVE" | "FILLED" | "CANCELLED";
  numberOfPositions: number;
  targetDate: string | null;
  hiringManager: string | null;
  assignedRecruiter: string | null;
  hiringManagerId: string | null;
  assignedRecruiterId: string | null;
  description: string | null;
  applications: number;
  createdAt: string;
};

type Options = {
  users: { id: string; name: string }[];
  openings: { id: string; title: string }[];
  candidates: { id: string; name: string }[];
};

const ACTIVE_STATUSES = new Set(["IN_PROGRESS", "ON_HOLD"]);

const STATUS_HUE: Record<Opening["status"], Hue> = {
  IN_PROGRESS: "blue",
  ON_HOLD: "amber",
  INACTIVE: "slate",
  FILLED: "emerald",
  CANCELLED: "rose",
};

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  INACTIVE: "Inactive",
  FILLED: "Filled",
  CANCELLED: "Cancelled",
};

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

// ============================================================
// Component
// ============================================================
export function JobOpenings({
  openings,
  options,
  canWrite,
}: {
  openings: Opening[];
  options: Options;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [filtered, setFiltered] = React.useState<Opening[]>(openings);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Opening | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  // Keep the filtered view in sync when the underlying data refreshes.
  React.useEffect(() => {
    setFiltered(openings);
  }, [openings]);

  const stats = React.useMemo(() => {
    const totalOpenings = openings.length;
    const activeOpenings = openings.filter((o) => o.status === "IN_PROGRESS").length;
    const filledOpenings = openings.filter((o) => o.status === "FILLED").length;
    const openPositions = openings
      .filter((o) => ACTIVE_STATUSES.has(o.status))
      .reduce((s, o) => s + o.numberOfPositions, 0);
    return { totalOpenings, activeOpenings, filledOpenings, openPositions };
  }, [openings]);

  const facets = React.useMemo<FacetDef<Opening>[]>(
    () => [
      { key: "status", label: "Status", get: (o) => o.status, format: statusLabel },
      { key: "department", label: "Department", get: (o) => o.department },
      { key: "city", label: "City", get: (o) => o.city },
    ],
    [],
  );

  const handleFiltered = React.useCallback((rows: Opening[]) => {
    setFiltered(rows);
  }, []);

  async function handleStatusChange(id: string, status: string) {
    setSavingId(id);
    const res = await setJobStatus(id, status);
    setSavingId(null);
    if (res.success) {
      toast.success(`Status updated to ${statusLabel(status)}.`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Total openings"
          value={stats.totalOpenings}
          accent="indigo"
          icon={<Briefcase className="size-4" />}
        />
        <StatTile
          label="Active"
          value={stats.activeOpenings}
          accent="blue"
          icon={<Sparkles className="size-4" />}
          sub="In progress"
        />
        <StatTile
          label="Filled"
          value={stats.filledOpenings}
          accent="emerald"
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatTile
          label="Open positions"
          value={stats.openPositions}
          accent="amber"
          icon={<Layers className="size-4" />}
          sub="Across active openings"
        />
      </div>

      {/* New opening */}
      {canWrite && (
        <div className="flex justify-end">
          <NewOpeningDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            options={options}
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> New opening
              </Button>
            }
          />
        </div>
      )}

      {/* Edit opening — controlled, no trigger; opened from a row action. */}
      {canWrite && (
        <NewOpeningDialog
          open={editing !== null}
          onOpenChange={(v) => {
            if (!v) setEditing(null);
          }}
          options={options}
          opening={editing}
        />
      )}

      {/* Filter rail + table */}
      <div className="flex items-start gap-4">
        <FacetFilterRail
          items={openings}
          facets={facets}
          onChange={handleFiltered}
          className="hidden lg:block"
        />

        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="size-5" />}
                title={openings.length === 0 ? "No job openings yet" : "No openings match your filters"}
                description={
                  openings.length === 0
                    ? "Create your first opening to start tracking roles through the hiring pipeline."
                    : "Try clearing a filter to widen the results."
                }
                action={
                  canWrite && openings.length === 0 ? (
                    <Button size="sm" onClick={() => setDialogOpen(true)}>
                      <Plus className="size-4" /> New opening
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Posting Title</TableHead>
                      <TableHead>Assigned Recruiter</TableHead>
                      <TableHead>Target Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Hiring Manager</TableHead>
                      <TableHead className="text-right"># Positions</TableHead>
                      <TableHead className="text-right">Applications</TableHead>
                      {canWrite && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => (
                      <TableRow key={o.id} className="card-hover-tint transition-premium">
                        <TableCell className="font-medium text-foreground">
                          {o.postingTitle}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {o.assignedRecruiter ?? "--"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatDate(o.targetDate)}
                        </TableCell>
                        <TableCell>
                          {canWrite ? (
                            <Select
                              value={o.status}
                              onValueChange={(v) => handleStatusChange(o.id, v)}
                              disabled={savingId === o.id}
                            >
                              <SelectTrigger size="sm" className="h-7 w-[150px] border-0 bg-transparent px-0 shadow-none hover:bg-muted/50">
                                <SelectValue>
                                  <StatusPill
                                    label={statusLabel(o.status)}
                                    hue={STATUS_HUE[o.status]}
                                    size="xs"
                                  />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {REC_JOB_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {statusLabel(s)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <StatusPill
                              label={statusLabel(o.status)}
                              hue={STATUS_HUE[o.status]}
                              size="xs"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {o.department ?? "--"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {o.hiringManager ?? "--"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {o.numberOfPositions}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {o.applications}
                        </TableCell>
                        {canWrite && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditing(o)}
                            >
                              <Pencil className="size-3.5" /> Edit
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// New-opening dialog
// ============================================================
function NewOpeningDialog({
  open,
  onOpenChange,
  options,
  trigger,
  opening,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  options: Options;
  trigger?: React.ReactNode;
  opening?: Opening | null;
}) {
  const router = useRouter();
  const isEdit = !!opening;
  const [submitting, setSubmitting] = React.useState(false);

  const [postingTitle, setPostingTitle] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [city, setCity] = React.useState("");
  const [numberOfPositions, setNumberOfPositions] = React.useState("1");
  const [targetDate, setTargetDate] = React.useState("");
  const [hiringManagerId, setHiringManagerId] = React.useState("");
  const [assignedRecruiterId, setAssignedRecruiterId] = React.useState("");
  const [description, setDescription] = React.useState("");

  function reset() {
    setPostingTitle("");
    setDepartment("");
    setCity("");
    setNumberOfPositions("1");
    setTargetDate("");
    setHiringManagerId("");
    setAssignedRecruiterId("");
    setDescription("");
  }

  // Prefill (edit) or clear (create) the form whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    if (opening) {
      setPostingTitle(opening.postingTitle);
      setDepartment(opening.department ?? "");
      setCity(opening.city ?? "");
      setNumberOfPositions(String(opening.numberOfPositions));
      // <input type="date"> wants YYYY-MM-DD.
      setTargetDate(opening.targetDate ? opening.targetDate.slice(0, 10) : "");
      setHiringManagerId(opening.hiringManagerId ?? "");
      setAssignedRecruiterId(opening.assignedRecruiterId ?? "");
      setDescription(opening.description ?? "");
    } else {
      reset();
    }
  }, [open, opening]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!postingTitle.trim()) {
      toast.error("Posting title is required.");
      return;
    }
    const positions = Number.parseInt(numberOfPositions, 10);
    const payload = {
      postingTitle: postingTitle.trim(),
      department: department.trim() || undefined,
      city: city.trim() || undefined,
      numberOfPositions: Number.isFinite(positions) && positions > 0 ? positions : undefined,
      targetDate: targetDate || undefined,
      hiringManagerId: hiringManagerId || undefined,
      assignedRecruiterId: assignedRecruiterId || undefined,
      description: description.trim() || undefined,
    };
    setSubmitting(true);
    const res = opening
      ? await updateJobOpening(opening.id, payload)
      : await createJobOpening(payload);
    setSubmitting(false);
    if (res.success) {
      toast.success(isEdit ? "Job opening updated." : "Job opening created.");
      reset();
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{isEdit ? "Edit job opening" : "New job opening"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the details for this role. Only the posting title is required."
                : "Add a role you're hiring for. Only the posting title is required."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="postingTitle">Posting title</Label>
              <Input
                id="postingTitle"
                value={postingTitle}
                onChange={(e) => setPostingTitle(e.target.value)}
                placeholder="e.g. Senior Event Operations Lead"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Operations"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="numberOfPositions"># Positions</Label>
                <Input
                  id="numberOfPositions"
                  type="number"
                  min={1}
                  value={numberOfPositions}
                  onChange={(e) => setNumberOfPositions(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="targetDate">Target date</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Hiring manager</Label>
                <Select value={hiringManagerId} onValueChange={setHiringManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Assigned recruiter</Label>
                <Select value={assignedRecruiterId} onValueChange={setAssignedRecruiterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Role summary, must-haves, etc."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create opening"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
