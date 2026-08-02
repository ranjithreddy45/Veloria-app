"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Clock,
  Loader2,
  Plus,
  Paperclip,
  Trash2,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import {
  createBgvCheck,
  updateBgvCheck,
  deleteBgvCheck,
  type BgvCheckRow,
} from "@/actions/recruit-bgv.actions";
import { FileUpload } from "@/components/ui/file-upload";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate } from "@/lib/utils";

// ============================================================
// Option lists (kept in the client — the "use server" actions file may only
// export async functions). Must stay in sync with the server validators.
// ============================================================

const BGV_TYPES = [
  "IDENTITY",
  "EDUCATION",
  "EMPLOYMENT",
  "CRIMINAL",
  "ADDRESS",
  "REFERENCE",
] as const;
type BgvType = (typeof BGV_TYPES)[number];

const BGV_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "CLEARED",
  "FLAGGED",
  "FAILED",
] as const;
type BgvStatus = (typeof BGV_STATUSES)[number];

const TYPE_LABEL: Record<BgvType, string> = {
  IDENTITY: "Identity",
  EDUCATION: "Education",
  EMPLOYMENT: "Employment",
  CRIMINAL: "Criminal",
  ADDRESS: "Address",
  REFERENCE: "Reference",
};

const STATUS_LABEL: Record<BgvStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  CLEARED: "Cleared",
  FLAGGED: "Flagged",
  FAILED: "Failed",
};

const STATUS_HUE: Record<BgvStatus, Hue> = {
  PENDING: "slate",
  IN_PROGRESS: "blue",
  CLEARED: "emerald",
  FLAGGED: "amber",
  FAILED: "red",
};

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  stage: string;
}

// ============================================================
// New-check dialog
// ============================================================

function NewCheckDialog({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({
    candidateId: "",
    type: "IDENTITY" as BgvType,
    vendor: "",
    remarks: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.candidateId) {
      toast.error("Pick a candidate.");
      return;
    }
    setPending(true);
    const res = await createBgvCheck({
      candidateId: form.candidateId,
      type: form.type,
      vendor: form.vendor || undefined,
      remarks: form.remarks || undefined,
    });
    setPending(false);
    if (res.success) {
      toast.success("Check created.");
      setForm({ candidateId: "", type: "IDENTITY", vendor: "", remarks: "" });
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={candidates.length === 0}>
          <Plus className="size-4" /> New check
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New background check</DialogTitle>
            <DialogDescription>
              Raise a verification request against a candidate.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="space-y-1.5">
              <Label>Candidate</Label>
              <Select
                value={form.candidateId}
                onValueChange={(v) => set("candidateId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a candidate…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.email ? ` · ${c.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Check type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => set("type", v as BgvType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BGV_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                placeholder="AuthBridge, First Advantage…"
                value={form.vendor}
                onChange={(e) => set("vendor", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                rows={3}
                placeholder="Scope, reference details, notes…"
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
              />
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
              {pending ? "Creating…" : "Create check"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Inline status control
// ============================================================

function StatusCell({
  row,
  canWrite,
  onChanged,
}: {
  row: BgvCheckRow;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const status = row.status as BgvStatus;

  if (!canWrite) {
    return (
      <StatusPill
        label={STATUS_LABEL[status] ?? row.status}
        hue={STATUS_HUE[status] ?? "neutral"}
        size="sm"
      />
    );
  }

  async function onChange(next: string) {
    if (next === row.status) return;
    setPending(true);
    const res = await updateBgvCheck(row.id, { status: next });
    setPending(false);
    if (res.success) {
      toast.success(`Marked ${STATUS_LABEL[next as BgvStatus]}`);
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger size="sm" className="h-7 w-[140px] text-detail">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BGV_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-detail">
            {STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================
// Attachment cell — link when present; upload/clear for write users
// ============================================================

function AttachmentCell({
  row,
  canWrite,
  onChanged,
}: {
  row: BgvCheckRow;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = React.useState(false);

  async function save(url: string) {
    setPending(true);
    const res = await updateBgvCheck(row.id, {
      status: row.status,
      attachmentUrl: url,
    });
    setPending(false);
    if (res.success) {
      toast.success(url ? "Report attached." : "Report removed.");
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  if (row.attachmentUrl) {
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={row.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-detail font-medium text-primary hover:underline"
        >
          <FileText className="size-3.5" /> Report
        </a>
        {canWrite && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-muted-foreground"
            onClick={() => save("")}
            disabled={pending}
            title="Remove report"
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
        maxMB={2}
        label="Attach"
        variant="ghost"
        size="sm"
        disabled={pending}
        onUploaded={(dataUrl) => save(dataUrl)}
      />
    );
  }

  return <span className="text-detail text-muted-foreground">—</span>;
}

// ============================================================
// Delete control
// ============================================================

function DeleteCell({ row, onChanged }: { row: BgvCheckRow; onChanged: () => void }) {
  const [pending, setPending] = React.useState(false);

  async function onDelete() {
    setPending(true);
    const res = await deleteBgvCheck(row.id);
    setPending(false);
    if (res.success) {
      toast.success("Check deleted.");
      onChanged();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="size-7 p-0 text-muted-foreground hover:text-destructive"
      onClick={onDelete}
      disabled={pending}
      title="Delete check"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}

// ============================================================
// Main
// ============================================================

export function BgvWorkspace({
  checks,
  candidates,
  canWrite,
}: {
  checks: BgvCheckRow[];
  candidates: Candidate[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const refresh = React.useCallback(() => router.refresh(), [router]);

  const counts = React.useMemo(() => {
    const c = { PENDING: 0, IN_PROGRESS: 0, CLEARED: 0, FLAGGED: 0, FAILED: 0 } as Record<
      BgvStatus,
      number
    >;
    for (const check of checks) {
      const s = check.status as BgvStatus;
      if (s in c) c[s] += 1;
    }
    return c;
  }, [checks]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Pending"
          value={counts.PENDING}
          accent="cyan"
          icon={<Clock />}
        />
        <StatTile
          label="In Progress"
          value={counts.IN_PROGRESS}
          accent="blue"
          icon={<Loader2 />}
        />
        <StatTile
          label="Cleared"
          value={counts.CLEARED}
          accent="emerald"
          icon={<ShieldCheck />}
        />
        <StatTile
          label="Flagged / Failed"
          value={counts.FLAGGED + counts.FAILED}
          accent="rose"
          icon={<ShieldAlert />}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">
          {checks.length} check{checks.length === 1 ? "" : "s"} across{" "}
          {new Set(checks.map((c) => c.candidateId)).size} candidate
          {new Set(checks.map((c) => c.candidateId)).size === 1 ? "" : "s"}
        </p>
        {canWrite && <NewCheckDialog candidates={candidates} />}
      </div>

      <Card className="min-w-0 overflow-hidden p-0 shadow-card">
        {checks.length === 0 ? (
          <EmptyState
            icon={<ShieldQuestion className="size-5" />}
            title="No background checks yet"
            description={
              canWrite
                ? "Raise your first verification request against a candidate."
                : "No verification requests have been raised."
            }
            action={
              canWrite && candidates.length > 0 ? (
                <NewCheckDialog candidates={candidates} />
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>
                    <Paperclip className="inline size-3.5" /> Report
                  </TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  {canWrite && <TableHead className="w-[44px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.map((row) => (
                  <TableRow key={row.id} className="transition-premium hover:bg-muted/40">
                    <TableCell>
                      <div className="min-w-0 leading-tight">
                        <a
                          href={`/recruitment/candidates/${row.candidateId}`}
                          className="block truncate text-body font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {row.candidateName}
                        </a>
                        {row.candidateEmail && (
                          <span className="block truncate text-meta text-muted-foreground">
                            {row.candidateEmail}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-body text-foreground/80">
                      {TYPE_LABEL[row.type as BgvType] ?? row.type}
                    </TableCell>
                    <TableCell>
                      <StatusCell row={row} canWrite={canWrite} onChanged={refresh} />
                    </TableCell>
                    <TableCell className="text-body text-foreground/80">
                      {row.vendor || "—"}
                    </TableCell>
                    <TableCell>
                      <AttachmentCell row={row} canWrite={canWrite} onChanged={refresh} />
                    </TableCell>
                    <TableCell className="text-right text-detail tabular-nums text-muted-foreground">
                      {formatDate(row.requestedAt)}
                    </TableCell>
                    <TableCell className="text-right text-detail tabular-nums text-muted-foreground">
                      {row.completedAt ? formatDate(row.completedAt) : "—"}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <DeleteCell row={row} onChanged={refresh} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
