"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Camera, CheckCircle2, Undo2, AlertTriangle, Loader2, ClipboardCheck } from "lucide-react";
import { createSnag, updateSnag, verifySnag, reopenSnag, addSnagPhoto } from "@/actions/snags.actions";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface Photo { id: string; kind: string; url: string; caption: string | null }
interface Snag {
  id: string; title: string; description: string | null; category: string; location: string | null;
  severity: string; status: string; raisedInStage: string; raisedByName: string | null;
  dueDate: string | null; verifiedByName: string | null; photos: Photo[];
}
interface Perms { canUpdate: boolean; canAudit: boolean }

const SEV_HUE: Record<string, "rose" | "amber" | "slate"> = { CRITICAL: "rose", MAJOR: "amber", MINOR: "slate" };
const STATUS_HUE: Record<string, "slate" | "blue" | "amber" | "emerald" | "rose"> = {
  OPEN: "slate", IN_PROGRESS: "blue", FIXED_PENDING_VERIFICATION: "amber", VERIFIED_CLOSED: "emerald", REOPENED: "rose",
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In progress", FIXED_PENDING_VERIFICATION: "Fixed — pending verification",
  VERIFIED_CLOSED: "Verified closed", REOPENED: "Re-opened",
};
// Left-accent border color per severity, matching StatusPill's palette.
const SEV_ACCENT: Record<string, string> = {
  CRITICAL: "border-l-rose-500", MAJOR: "border-l-amber-500", MINOR: "border-l-slate-300 dark:border-l-slate-600",
};
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null);

// Summary tiles double as filters. `null` = all.
type SevFilter = "CRITICAL" | "MAJOR" | "MINOR" | null;
type StatusFilter = "OPEN_SET" | "VERIFIED_CLOSED" | null;

export function SnagBoard({ projectId, snags, perms }: { projectId: string; snags: Snag[]; perms: Perms }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", location: "", severity: "MAJOR", description: "", dueDate: "" });
  const [sevFilter, setSevFilter] = useState<SevFilter>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) { toast.error(res.error); return; }
      toast.success(ok);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const counts = useMemo(() => {
    const open = (s: Snag) => s.status !== "VERIFIED_CLOSED";
    return {
      critical: snags.filter((s) => s.severity === "CRITICAL" && open(s)).length,
      major: snags.filter((s) => s.severity === "MAJOR" && open(s)).length,
      minor: snags.filter((s) => s.severity === "MINOR" && open(s)).length,
      openTotal: snags.filter(open).length,
      closed: snags.filter((s) => s.status === "VERIFIED_CLOSED").length,
    };
  }, [snags]);

  const filtered = useMemo(
    () =>
      snags.filter((s) => {
        if (sevFilter && s.severity !== sevFilter) return false;
        if (statusFilter === "OPEN_SET" && s.status === "VERIFIED_CLOSED") return false;
        if (statusFilter === "VERIFIED_CLOSED" && s.status !== "VERIFIED_CLOSED") return false;
        return true;
      }),
    [snags, sevFilter, statusFilter]
  );

  const filterActive = sevFilter !== null || statusFilter !== null;

  function submitForm() {
    if (!form.title.trim() || !form.category.trim()) return toast.error("Title and category are required.");
    run("create", () => createSnag(projectId, { title: form.title, category: form.category, location: form.location || undefined, severity: form.severity, description: form.description || undefined, dueDate: form.dueDate || undefined }), "Snag raised.").then(() => {
      setForm({ title: "", category: "", location: "", severity: "MAJOR", description: "", dueDate: "" });
      setShowForm(false);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Snags &amp; defects</p>
        {(perms.canUpdate || perms.canAudit) && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)}><Plus className="h-4 w-4" /> Raise snag</Button>
        )}
      </div>

      {/* Summary tiles — double as filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryTile label="Critical" hue="rose" count={counts.critical} active={sevFilter === "CRITICAL"} onClick={() => setSevFilter((p) => (p === "CRITICAL" ? null : "CRITICAL"))} />
        <SummaryTile label="Major" hue="amber" count={counts.major} active={sevFilter === "MAJOR"} onClick={() => setSevFilter((p) => (p === "MAJOR" ? null : "MAJOR"))} />
        <SummaryTile label="Minor" hue="slate" count={counts.minor} active={sevFilter === "MINOR"} onClick={() => setSevFilter((p) => (p === "MINOR" ? null : "MINOR"))} />
        <SummaryTile label="Open" hue="blue" count={counts.openTotal} active={statusFilter === "OPEN_SET"} onClick={() => setStatusFilter((p) => (p === "OPEN_SET" ? null : "OPEN_SET"))} />
        <SummaryTile label="Verified closed" hue="emerald" count={counts.closed} active={statusFilter === "VERIFIED_CLOSED"} onClick={() => setStatusFilter((p) => (p === "VERIFIED_CLOSED" ? null : "VERIFIED_CLOSED"))} />
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Raise a snag</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="Category * (e.g. Painting)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input placeholder="Location (e.g. Hall A — east wall)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <div className="flex gap-2">
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{["CRITICAL", "MAJOR", "MINOR"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy === "create"} onClick={submitForm}>Add snag</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {snags.length === 0 ? (
        <EmptyState
          tone="success"
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="No snags logged"
          description="A defect-free venue is the goal — raise one if you spot an issue."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          tone="neutral"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Nothing matches this filter"
          description="No snags in this bucket right now."
          action={
            <Button size="sm" variant="outline" onClick={() => { setSevFilter(null); setStatusFilter(null); }}>
              Clear filter
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filterActive && (
            <button
              type="button"
              onClick={() => { setSevFilter(null); setStatusFilter(null); }}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-ring rounded"
            >
              Showing {filtered.length} of {snags.length} · clear filter
            </button>
          )}
          {filtered.map((s) => (
            <SnagRow key={s.id} snag={s} perms={perms} busy={busy} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label, hue, count, active, onClick,
}: {
  label: string;
  hue: "rose" | "amber" | "slate" | "blue" | "emerald";
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const ACCENT: Record<string, { dot: string; ring: string; tint: string }> = {
    rose: { dot: "bg-rose-500", ring: "ring-rose-300", tint: "bg-rose-50/60 dark:bg-rose-950/30" },
    amber: { dot: "bg-amber-500", ring: "ring-amber-300", tint: "bg-amber-50/60 dark:bg-amber-950/30" },
    slate: { dot: "bg-slate-400", ring: "ring-slate-300", tint: "bg-slate-50/60 dark:bg-slate-900/40" },
    blue: { dot: "bg-blue-500", ring: "ring-blue-300", tint: "bg-blue-50/60 dark:bg-blue-950/30" },
    emerald: { dot: "bg-emerald-500", ring: "ring-emerald-300", tint: "bg-emerald-50/60 dark:bg-emerald-950/30" },
  };
  const a = ACCENT[hue];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-ring flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-premium shadow-card",
        active ? cn("ring-2 ring-inset", a.ring, a.tint) : "hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-1.5 text-meta font-medium text-muted-foreground">
        <span className={cn("inline-block size-1.5 shrink-0 rounded-full", a.dot)} aria-hidden />
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums leading-none">{count}</span>
    </button>
  );
}

function SnagRow({ snag, perms, busy, run }: { snag: Snag; perms: Perms; busy: string | null; run: (k: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<"BEFORE" | "AFTER">("AFTER");
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ p: Photo; tag: string } | null>(null);
  // Optimistic status — null means "use server value".
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const status = optimisticStatus ?? snag.status;

  function pickPhoto(kind: "BEFORE" | "AFTER") {
    setUploadKind(kind);
    fileRef.current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) return toast.error("Image too large (max ~5MB). Try a smaller photo.");
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result || "");
      const res = await addSnagPhoto(snag.id, { url, kind: uploadKind });
      setUploading(false);
      if (!res.success) return toast.error(res.error);
      toast.success(`${uploadKind === "AFTER" ? "After" : "Before"}-photo added.`);
      location.reload();
    };
    reader.onerror = () => { setUploading(false); toast.error("Could not read the file."); };
    reader.readAsDataURL(file);
  }

  // Optimistic status change: flip the pill immediately, call the action, roll back on failure.
  async function runStatus(next: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    const prev = status;
    setOptimisticStatus(next);
    await run(snag.id, async () => {
      const res = await fn();
      if (!res.success) setOptimisticStatus(prev);
      return res;
    }, ok);
  }

  const before = snag.photos.filter((p) => p.kind === "BEFORE");
  const after = snag.photos.filter((p) => p.kind === "AFTER");

  return (
    <Card className={cn("border-l-4 transition-premium card-hover-tint shadow-card hover:shadow-card-hover", SEV_ACCENT[snag.severity] ?? "border-l-slate-300")}>
      <CardContent className="space-y-2 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{snag.title}</span>
              <StatusPill label={snag.severity} hue={SEV_HUE[snag.severity] ?? "slate"} size="xs" />
              <StatusPill label={STATUS_LABEL[status] ?? status} hue={STATUS_HUE[status] ?? "slate"} size="xs" />
            </div>
            <div className="text-xs text-muted-foreground">
              {snag.category}{snag.location ? ` · ${snag.location}` : ""}{snag.dueDate ? ` · due ${fmtDate(snag.dueDate)}` : ""}
              {snag.raisedByName ? ` · raised by ${snag.raisedByName} (${snag.raisedInStage === "OPS_AUDIT" ? "Ops audit" : "QC"})` : ""}
            </div>
            {snag.description && <p className="mt-1 text-sm text-muted-foreground">{snag.description}</p>}
          </div>
        </div>

        {/* Photos */}
        {(before.length > 0 || after.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {before.map((p) => <PhotoThumb key={p.id} p={p} tag="Before" onOpen={() => setLightbox({ p, tag: "Before" })} />)}
            {after.map((p) => <PhotoThumb key={p.id} p={p} tag="After" onOpen={() => setLightbox({ p, tag: "After" })} />)}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={onFile} />
          {status !== "VERIFIED_CLOSED" && (perms.canUpdate || perms.canAudit) && (
            <>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => pickPhoto("BEFORE")}><Camera className="h-3.5 w-3.5" /> Before</Button>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => pickPhoto("AFTER")}><Camera className="h-3.5 w-3.5" /> After</Button>
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </>
          )}
          {perms.canUpdate && (status === "OPEN" || status === "REOPENED") && (
            <Button size="sm" variant="outline" disabled={busy === snag.id} onClick={() => runStatus("IN_PROGRESS", () => updateSnag(snag.id, { status: "IN_PROGRESS" }), "Marked in progress.")}>Start fix</Button>
          )}
          {perms.canUpdate && status === "IN_PROGRESS" && (
            <Button size="sm" variant="outline" disabled={busy === snag.id} onClick={() => runStatus("FIXED_PENDING_VERIFICATION", () => updateSnag(snag.id, { status: "FIXED_PENDING_VERIFICATION" }), "Marked fixed — pending Ops verification.")}>Mark fixed</Button>
          )}
          {perms.canAudit && status === "FIXED_PENDING_VERIFICATION" && (
            <Button size="sm" disabled={busy === snag.id} onClick={() => runStatus("VERIFIED_CLOSED", () => verifySnag(snag.id), "Snag verified-closed.")}><CheckCircle2 className="h-3.5 w-3.5" /> Verify &amp; close</Button>
          )}
          {(perms.canUpdate || perms.canAudit) && ["FIXED_PENDING_VERIFICATION", "VERIFIED_CLOSED"].includes(status) && (
            <Button size="sm" variant="ghost" disabled={busy === snag.id} onClick={() => { const r = prompt("Reason for re-opening this snag?"); if (r) runStatus("REOPENED", () => reopenSnag(snag.id, r), "Snag re-opened."); }}><Undo2 className="h-3.5 w-3.5" /> Re-open</Button>
          )}
          {status === "VERIFIED_CLOSED" && snag.verifiedByName && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> verified by {snag.verifiedByName}</span>}
        </div>
      </CardContent>

      {/* Lightbox */}
      <Dialog open={lightbox !== null} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="text-sm">
            {lightbox?.tag}-photo · {snag.title}
          </DialogTitle>
          {lightbox && (() => {
            const isImg = lightbox.p.url.startsWith("data:image") || /\.(png|jpe?g|webp|gif)$/i.test(lightbox.p.url);
            return isImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.p.url} alt={lightbox.tag} className="max-h-[70vh] w-full rounded-lg object-contain" />
            ) : (
              <a href={lightbox.p.url} target="_blank" rel="noopener noreferrer" className="flex h-40 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                Open attachment (PDF) ↗
              </a>
            );
          })()}
          {lightbox?.p.caption && <p className="text-xs text-muted-foreground">{lightbox.p.caption}</p>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PhotoThumb({ p, tag, onOpen }: { p: Photo; tag: string; onOpen: () => void }) {
  const isImg = p.url.startsWith("data:image") || /\.(png|jpe?g|webp|gif)$/i.test(p.url);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group focus-ring relative block h-16 w-16 overflow-hidden rounded-lg border transition-premium hover:opacity-90"
    >
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.url} alt={tag} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-meta text-muted-foreground">PDF</span>
      )}
      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-meta text-white">{tag}</span>
    </button>
  );
}
