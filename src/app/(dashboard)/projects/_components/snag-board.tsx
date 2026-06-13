"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Camera, CheckCircle2, Undo2, AlertTriangle, Loader2 } from "lucide-react";
import { createSnag, updateSnag, verifySnag, reopenSnag, addSnagPhoto } from "@/actions/snags.actions";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null);

export function SnagBoard({ projectId, snags, perms }: { projectId: string; snags: Snag[]; perms: Perms }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", location: "", severity: "MAJOR", description: "", dueDate: "" });

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

  const openCM = snags.filter((s) => ["CRITICAL", "MAJOR"].includes(s.severity) && s.status !== "VERIFIED_CLOSED").length;
  const unverified = snags.filter((s) => s.status !== "VERIFIED_CLOSED").length;

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
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-rose-500" /> {openCM} open critical/major</span>
          <span className="text-muted-foreground">· {unverified} not yet verified-closed</span>
        </div>
        {(perms.canUpdate || perms.canAudit) && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)}><Plus className="h-4 w-4" /> Raise snag</Button>
        )}
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
        <p className="py-6 text-center text-sm text-muted-foreground">No snags logged. A defect-free venue is the goal — raise one if you spot an issue.</p>
      ) : (
        snags.map((s) => (
          <SnagRow key={s.id} snag={s} perms={perms} busy={busy} run={run} />
        ))
      )}
    </div>
  );
}

function SnagRow({ snag, perms, busy, run }: { snag: Snag; perms: Perms; busy: string | null; run: (k: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<"BEFORE" | "AFTER">("AFTER");
  const [uploading, setUploading] = useState(false);

  function pickPhoto(kind: "BEFORE" | "AFTER") {
    setUploadKind(kind);
    fileRef.current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 6_500_000) return toast.error("Image too large (max ~6MB). Try a smaller photo.");
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

  const before = snag.photos.filter((p) => p.kind === "BEFORE");
  const after = snag.photos.filter((p) => p.kind === "AFTER");

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{snag.title}</span>
              <StatusPill label={snag.severity} hue={SEV_HUE[snag.severity] ?? "slate"} size="xs" />
              <StatusPill label={STATUS_LABEL[snag.status] ?? snag.status} hue={STATUS_HUE[snag.status] ?? "slate"} size="xs" />
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
            {before.map((p) => <PhotoThumb key={p.id} p={p} tag="Before" />)}
            {after.map((p) => <PhotoThumb key={p.id} p={p} tag="After" />)}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={onFile} />
          {snag.status !== "VERIFIED_CLOSED" && (perms.canUpdate || perms.canAudit) && (
            <>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => pickPhoto("BEFORE")}><Camera className="h-3.5 w-3.5" /> Before</Button>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => pickPhoto("AFTER")}><Camera className="h-3.5 w-3.5" /> After</Button>
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </>
          )}
          {perms.canUpdate && (snag.status === "OPEN" || snag.status === "REOPENED") && (
            <Button size="sm" variant="outline" disabled={busy === snag.id} onClick={() => run(snag.id, () => updateSnag(snag.id, { status: "IN_PROGRESS" }), "Marked in progress.")}>Start fix</Button>
          )}
          {perms.canUpdate && snag.status === "IN_PROGRESS" && (
            <Button size="sm" variant="outline" disabled={busy === snag.id} onClick={() => run(snag.id, () => updateSnag(snag.id, { status: "FIXED_PENDING_VERIFICATION" }), "Marked fixed — pending Ops verification.")}>Mark fixed</Button>
          )}
          {perms.canAudit && snag.status === "FIXED_PENDING_VERIFICATION" && (
            <Button size="sm" disabled={busy === snag.id} onClick={() => run(snag.id, () => verifySnag(snag.id), "Snag verified-closed.")}><CheckCircle2 className="h-3.5 w-3.5" /> Verify & close</Button>
          )}
          {(perms.canUpdate || perms.canAudit) && ["FIXED_PENDING_VERIFICATION", "VERIFIED_CLOSED"].includes(snag.status) && (
            <Button size="sm" variant="ghost" disabled={busy === snag.id} onClick={() => { const r = prompt("Reason for re-opening this snag?"); if (r) run(snag.id, () => reopenSnag(snag.id, r), "Snag re-opened."); }}><Undo2 className="h-3.5 w-3.5" /> Re-open</Button>
          )}
          {snag.status === "VERIFIED_CLOSED" && snag.verifiedByName && <span className="text-xs text-emerald-600">✓ verified by {snag.verifiedByName}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function PhotoThumb({ p, tag }: { p: Photo; tag: string }) {
  const isImg = p.url.startsWith("data:image") || /\.(png|jpe?g|webp|gif)$/i.test(p.url);
  return (
    <a href={p.url} target="_blank" rel="noopener noreferrer" className="group relative block h-16 w-16 overflow-hidden rounded border">
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.url} alt={tag} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">PDF</span>
      )}
      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[9px] text-white">{tag}</span>
    </a>
  );
}
