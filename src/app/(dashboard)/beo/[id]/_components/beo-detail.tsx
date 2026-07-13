"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Lock,
  Undo2,
  Plus,
  Trash2,
  GripVertical,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  updateBeo,
  setBeoStatus,
  addBeoIncident,
  resolveBeoIncident,
  type BeoDetail,
  type RunOfShowItem,
} from "@/actions/beo.actions";
import { STATUS_HUE, STATUS_LABEL } from "../../_components/beo-dashboard";
import { BeoPackageSnapshots } from "./beo-package-snapshots";

const SEVERITY_HUE: Record<string, Hue> = { LOW: "slate", MEDIUM: "amber", HIGH: "rose" };
const SEVERITY_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const SECTIONS: { key: keyof BeoDetail; label: string; placeholder: string }[] = [
  { key: "menuNotes", label: "Menu & F&B", placeholder: "Courses, counters, dietary notes, beverage plan…" },
  { key: "floorPlanNotes", label: "Floor plan & seating", placeholder: "Layout, table count, stage, entry/exit flow…" },
  { key: "avNotes", label: "AV & technical", placeholder: "Sound, lighting, screens, mic count, cues…" },
  { key: "decorNotes", label: "Décor & styling", placeholder: "Theme, florals, centrepieces, signage…" },
  { key: "staffingNotes", label: "Staffing & service", placeholder: "Captain, stewards, kitchen brigade, call times…" },
  { key: "specialInstructions", label: "Special instructions", placeholder: "VIP notes, client requests, watch-outs…" },
];

export function BeoDetailView({ beo, canWrite }: { beo: BeoDetail; canWrite: boolean }) {
  const router = useRouter();
  const locked = beo.status === "LOCKED";
  const editable = canWrite && !locked;
  const [busy, setBusy] = React.useState<string | null>(null);

  async function changeStatus(status: "DRAFT" | "PUBLISHED" | "LOCKED") {
    setBusy(status);
    try {
      const res = await setBeoStatus(beo.id, status);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(`Function sheet ${STATUS_LABEL[status].toLowerCase()}`);
      router.refresh();
    } catch {
      toast.error("Couldn't update status.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Link href="/beo" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Function sheets
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-medium leading-tight tracking-[-0.01em] text-foreground">{beo.beoNumber}</h1>
            <StatusPill label={STATUS_LABEL[beo.status] ?? beo.status} hue={STATUS_HUE[beo.status] ?? "slate"} />
          </div>
          <p className="text-[13px] text-muted-foreground">
            {beo.eventName ?? "—"}
            {beo.eventType ? ` · ${beo.eventType}` : ""}
            {beo.venueName ? ` · ${beo.venueName}` : ""}
            {" · "}{fmtDate(beo.date)}
            {beo.covers != null ? ` · ${beo.covers} covers` : ""}
          </p>
          {beo.publishedAt && (
            <p className="text-[11.5px] text-muted-foreground">Published {fmtDateTime(beo.publishedAt)}</p>
          )}
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {beo.status === "DRAFT" && (
              <Button size="sm" onClick={() => changeStatus("PUBLISHED")} disabled={busy !== null}>
                {busy === "PUBLISHED" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Publish
              </Button>
            )}
            {beo.status === "PUBLISHED" && (
              <>
                <Button size="sm" variant="outline" onClick={() => changeStatus("DRAFT")} disabled={busy !== null}>
                  <Undo2 className="size-3.5" /> Un-publish
                </Button>
                <Button size="sm" onClick={() => changeStatus("LOCKED")} disabled={busy !== null}>
                  {busy === "LOCKED" ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />} Lock
                </Button>
              </>
            )}
            {locked && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-[12px] text-muted-foreground">
                <Lock className="size-3.5" /> Locked — read only
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <CoversCard beo={beo} editable={editable} />
          <RunOfShowCard beo={beo} editable={editable} />
          <SectionsCard beo={beo} editable={editable} />
        </div>
        <div className="flex flex-col gap-5">
          <IncidentLog beo={beo} canWrite={canWrite} />
          <BeoPackageSnapshots beoId={beo.id} locked={locked} />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Covers
// ------------------------------------------------------------
function CoversCard({ beo, editable }: { beo: BeoDetail; editable: boolean }) {
  const router = useRouter();
  const [covers, setCovers] = React.useState(beo.covers != null ? String(beo.covers) : "");
  const [busy, setBusy] = React.useState(false);
  const dirty = covers !== (beo.covers != null ? String(beo.covers) : "");

  async function save() {
    setBusy(true);
    try {
      const res = await updateBeo(beo.id, { covers: covers === "" ? null : Number(covers) });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Covers updated");
      router.refresh();
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-[15px]">Covers</CardTitle></CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label>Confirmed covers</Label>
          <Input
            inputMode="numeric"
            className="w-40"
            value={covers}
            onChange={(e) => setCovers(e.target.value)}
            disabled={!editable}
          />
        </div>
        {editable && (
          <Button size="sm" variant="outline" onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Run of show
// ------------------------------------------------------------
function RunOfShowCard({ beo, editable }: { beo: BeoDetail; editable: boolean }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<RunOfShowItem[]>(beo.runOfShow);
  const [busy, setBusy] = React.useState(false);

  const dirty = React.useMemo(() => JSON.stringify(rows) !== JSON.stringify(beo.runOfShow), [rows, beo.runOfShow]);

  function update(i: number, field: keyof RunOfShowItem, value: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function add() {
    setRows((rs) => [...rs, { time: "", activity: "", owner: "", notes: "" }]);
  }
  function remove(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true);
    try {
      const res = await updateBeo(beo.id, { runOfShow: rows });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Run-of-show saved");
      router.refresh();
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[15px]">Run of show</CardTitle>
        {editable && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={add}><Plus className="size-3.5" /> Add row</Button>
            <Button size="sm" variant="outline" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">No timeline yet.{editable ? " Add the first row." : ""}</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[90px_1fr_140px_1fr_32px] gap-2 px-1 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Time</span><span>Activity</span><span>Owner</span><span>Notes</span><span />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border/70 p-2 sm:grid-cols-[90px_1fr_140px_1fr_32px] sm:border-0 sm:p-0">
                <Input value={r.time} onChange={(e) => update(i, "time", e.target.value)} placeholder="18:00" disabled={!editable} className="h-9" />
                <Input value={r.activity} onChange={(e) => update(i, "activity", e.target.value)} placeholder="Guest arrival" disabled={!editable} className="h-9" />
                <Input value={r.owner} onChange={(e) => update(i, "owner", e.target.value)} placeholder="Captain" disabled={!editable} className="h-9" />
                <Input value={r.notes} onChange={(e) => update(i, "notes", e.target.value)} placeholder="Notes" disabled={!editable} className="h-9" />
                {editable ? (
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-rose-600" onClick={() => remove(i)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : (
                  <span className="hidden sm:flex sm:h-9 sm:w-9 sm:items-center sm:justify-center text-muted-foreground/40"><GripVertical className="size-4" /></span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Section notes
// ------------------------------------------------------------
function SectionsCard({ beo, editable }: { beo: BeoDetail; editable: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-[15px]">Department briefs</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <SectionField key={s.key} beoId={beo.id} field={s.key} label={s.label} placeholder={s.placeholder} value={(beo[s.key] as string | null) ?? ""} editable={editable} />
        ))}
      </CardContent>
    </Card>
  );
}

function SectionField({
  beoId,
  field,
  label,
  placeholder,
  value,
  editable,
}: {
  beoId: string;
  field: keyof BeoDetail;
  label: string;
  placeholder: string;
  value: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [val, setVal] = React.useState(value);
  const [busy, setBusy] = React.useState(false);
  const dirty = val !== value;

  async function save() {
    setBusy(true);
    try {
      const res = await updateBeo(beoId, { [field]: val } as Record<string, string>);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(`${label} saved`);
      router.refresh();
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {editable && dirty && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11.5px]" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        )}
      </div>
      <Textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={!editable}
        className="resize-y text-[13px]"
      />
    </div>
  );
}

// ------------------------------------------------------------
// Incident log
// ------------------------------------------------------------
function IncidentLog({ beo, canWrite }: { beo: BeoDetail; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const openCount = beo.incidents.filter((i) => i.status === "OPEN").length;

  async function resolve(id: string) {
    try {
      const res = await resolveBeoIncident(id);
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Incident resolved");
      router.refresh();
    } catch {
      toast.error("Couldn't resolve.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <AlertTriangle className="size-4 text-rose-500" /> Incident log
          {openCount > 0 && <span className="rounded-md bg-rose-100 px-1.5 text-[11px] font-medium text-rose-700">{openCount} open</span>}
        </CardTitle>
        {canWrite && <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="size-3.5" /> Log</Button>}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {beo.incidents.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">No incidents logged.</p>
        ) : (
          beo.incidents.map((i) => (
            <div key={i.id} className="rounded-lg border border-border/70 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <StatusPill label={SEVERITY_LABEL[i.severity] ?? i.severity} hue={SEVERITY_HUE[i.severity] ?? "slate"} size="xs" />
                    {i.status === "RESOLVED" ? (
                      <StatusPill label="Resolved" hue="emerald" size="xs" />
                    ) : (
                      <StatusPill label="Open" hue="rose" size="xs" />
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] font-medium text-foreground">{i.title}</p>
                  {i.description && <p className="mt-0.5 text-[12px] text-muted-foreground">{i.description}</p>}
                  {i.photoUrl && (
                    <a href={i.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11.5px] text-indigo-600 hover:underline">View photo</a>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{i.reporterName ?? "—"} · {fmtDateTime(i.createdAt)}</p>
                </div>
                {canWrite && i.status === "OPEN" && (
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-[11.5px]" onClick={() => resolve(i.id)}>
                    <CheckCircle2 className="size-3.5" /> Resolve
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
      {canWrite && <AddIncidentDialog beoId={beo.id} open={open} onOpenChange={setOpen} />}
    </Card>
  );
}

function AddIncidentDialog({ beoId, open, onOpenChange }: { beoId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [severity, setSeverity] = React.useState<"LOW" | "MEDIUM" | "HIGH">("LOW");
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) { setTitle(""); setDescription(""); setSeverity("LOW"); setPhotoUrl(""); }
  }, [open]);

  async function submit() {
    if (!title.trim()) { toast.error("A title is required."); return; }
    setBusy(true);
    try {
      const res = await addBeoIncident(beoId, {
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        photoUrl: photoUrl.trim() || undefined,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Incident logged");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Couldn't log incident.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log incident</DialogTitle>
          <DialogDescription>Record a day-of issue so it can be tracked and resolved.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AC failure in main hall" /></div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as "LOW" | "MEDIUM" | "HIGH")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What happened, who's affected, action taken…" /></div>
          <div className="space-y-1.5"><Label>Photo URL (optional)</Label><Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !title.trim()}>{busy ? "Logging…" : "Log incident"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
