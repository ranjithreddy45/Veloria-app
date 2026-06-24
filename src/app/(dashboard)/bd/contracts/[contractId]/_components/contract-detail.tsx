"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, Send, FileSignature, Play, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { acqCan } from "@/lib/acq/rbac";
import {
  ACQ_CONTRACT_PHASE,
  ACQ_CONTRACT_PHASE_LABEL,
  ACQ_CONTRACT_LIFECYCLE_LABEL,
} from "@/lib/acq/constants";
import {
  approveAcqContract,
  sendAcqContractForEsign,
  markAcqContractSignedCLM,
  activateAcqContract,
  terminateAcqContract,
  addAcqContractDocument,
  addAcqContractNote,
  updateAcqContract,
  submitContractForApproval,
  rejectAcqContract,
  sendAcqContractToOwner,
  restoreAcqContractVersion,
} from "@/actions/acq-contract.actions";
import { defaultManagementAgreement } from "@/lib/acq/contract-template";
import { FileDown, FileText } from "lucide-react";

export interface ContractFull {
  id: string;
  title: string;
  propertyName: string;
  ownerName: string;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  model?: string | null;
  baseFeePct?: number | string | null;
  incentivePct?: number | string | null;
  termYears?: number | null;
  contractValue?: number | string | null;
  phase: string;
  status: string;
  body?: string | null;
  signByDate?: string | null;
  signedAt?: string | null;
  startDate?: string | null;
  terminatedAt?: string | null;
  terminationGainLoss?: number | string | null;
  esignProvider?: string | null;
  esignStatus?: string | null;
  documents: { id: string; label: string | null; url: string; createdAt: string }[];
  activities: { id: string; type: string; detail: string | null; createdAt: string; actorName?: string | null }[];
  versions: { id: string; version: number; body: string; createdAt: string }[];
}

const STATUS_HUE: Record<string, "slate" | "blue" | "indigo" | "emerald" | "amber" | "rose"> = {
  DRAFT: "slate", APPROVED: "indigo", NEGOTIATED: "amber", SIGNED: "blue", ACTIVE: "emerald", TERMINATED: "rose",
};
function inr(v?: number | string | null): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—";
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ContractDetail({ contract, userRole }: { contract: ContractFull; userRole?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const canApprove = acqCan(userRole, "bdhead:approve");
  const canMove = acqCan(userRole, "deal:transition");
  const canWrite = acqCan(userRole, "lead:write");

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) { toast.error(res.error); return; }
      toast.success(ok);
      router.refresh();
    } catch {
      toast.error("Something went wrong — please try again.");
    } finally {
      setBusy(null);
    }
  }

  const phaseIdx = ACQ_CONTRACT_PHASE.indexOf(contract.phase as (typeof ACQ_CONTRACT_PHASE)[number]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/bd/contracts" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to Contracts
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground">{contract.title}</h1>
              <StatusPill label={ACQ_CONTRACT_LIFECYCLE_LABEL[contract.status as keyof typeof ACQ_CONTRACT_LIFECYCLE_LABEL] ?? contract.status} hue={STATUS_HUE[contract.status] ?? "slate"} size="xs" />
              <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {ACQ_CONTRACT_PHASE_LABEL[contract.phase as keyof typeof ACQ_CONTRACT_PHASE_LABEL] ?? contract.phase}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">{contract.propertyName} · {contract.ownerName}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/bd/contracts/${contract.id}/pdf`, "_blank")}
          >
            <FileDown className="size-3.5" /> Preview / Download PDF
          </Button>
        </div>
      </div>

      <ContractAuthoring contract={contract} />


      {/* Lifecycle stepper */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          {ACQ_CONTRACT_PHASE.map((p, i) => (
            <React.Fragment key={p}>
              <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${i <= phaseIdx ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {i < phaseIdx ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : i === phaseIdx ? <Circle className="size-3.5 fill-foreground/20 text-foreground" /> : <Circle className="size-3.5 text-muted-foreground/40" />}
                {ACQ_CONTRACT_PHASE_LABEL[p]}
              </span>
              {i < ACQ_CONTRACT_PHASE.length - 1 && <span className="text-muted-foreground/40">→</span>}
            </React.Fragment>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-[15px]">Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <F label="Owner" value={contract.ownerName} />
              <F label="Email" value={contract.ownerEmail || "—"} />
              <F label="Phone" value={contract.ownerPhone || "—"} />
              <F label="Model" value={contract.model || "—"} />
              <F label="Base fee %" value={contract.baseFeePct != null ? String(contract.baseFeePct) : "—"} />
              <F label="Incentive %" value={contract.incentivePct != null ? String(contract.incentivePct) : "—"} />
              <F label="Term (years)" value={contract.termYears != null ? String(contract.termYears) : "—"} />
              <F label="Contract value" value={inr(contract.contractValue)} />
              <F label="Sign by" value={fmtDate(contract.signByDate)} />
              <F label="Signed at" value={fmtDate(contract.signedAt)} />
              <F label="E-sign" value={contract.esignStatus ? `${contract.esignProvider ?? ""} ${contract.esignStatus}` : "—"} />
              {contract.status === "TERMINATED" && <F label="Gain / loss" value={inr(contract.terminationGainLoss)} />}
            </dl>
          </CardContent>
        </Card>

        {/* Lifecycle actions */}
        <Card>
          <CardHeader><CardTitle className="text-[15px]">Actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {contract.status === "DRAFT" && contract.phase !== "APPROVAL" && canWrite && (
              <Button size="sm" disabled={busy !== null} onClick={() => run("submit", () => submitContractForApproval(contract.id), "Submitted for approval")}>
                {busy === "submit" && <Loader2 className="size-3.5 animate-spin" />} Submit for approval
              </Button>
            )}
            {contract.status === "DRAFT" && contract.phase === "APPROVAL" && canApprove && (
              <>
                <Button size="sm" disabled={busy !== null} onClick={() => run("approve", () => approveAcqContract(contract.id), "Approved")}>
                  {busy === "approve" && <Loader2 className="size-3.5 animate-spin" />} Approve
                </Button>
                <RejectBox contractId={contract.id} busy={busy} run={run} />
              </>
            )}
            {contract.status === "DRAFT" && contract.phase === "APPROVAL" && !canApprove && (
              <p className="text-[12px] text-muted-foreground">Awaiting BD Head / manager approval before it can go to the owner.</p>
            )}
            {(contract.status === "APPROVED" || contract.status === "NEGOTIATED") && canMove && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => run("sendmail", () => sendAcqContractToOwner(contract.id, "EMAIL"), "Emailed to owner")}>
                  Email owner
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => run("sendwa", () => sendAcqContractToOwner(contract.id, "WHATSAPP"), "Sent to owner on WhatsApp")}>
                  WhatsApp owner
                </Button>
              </div>
            )}
            {(contract.status === "APPROVED" || contract.status === "NEGOTIATED") && canMove && (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run("esign", async () => {
                const r = await sendAcqContractForEsign(contract.id);
                if (r.success && !r.data.configured) toast.message("E-sign not connected yet — upload the signed PDF below.");
                return r;
              }, "Sent for signature")}>
                {busy === "esign" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Send for e-signature
              </Button>
            )}
            {contract.status === "NEGOTIATED" && canMove && (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run("sign", () => markAcqContractSignedCLM(contract.id), "Marked signed")}>
                <FileSignature className="size-3.5" /> Mark signed (manual)
              </Button>
            )}
            {contract.status === "SIGNED" && canMove && (
              <Button size="sm" disabled={busy !== null} onClick={() => run("activate", () => activateAcqContract(contract.id), "Activated")}>
                {busy === "activate" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Activate
              </Button>
            )}
            {contract.status === "ACTIVE" && canApprove && (
              <TerminateBox contractId={contract.id} busy={busy} run={run} />
            )}
            {/* The contract advances only through the gated lifecycle actions
                above (Submit → Approve → Send → Sign → Activate → Terminate),
                which keep phase and status in lockstep. The old free-form
                "Move phase" control was removed (audit P-4/P-7/P-9/O-3): it let
                phase and status desync and skip approvals. The read-only stepper
                at the top shows progress. */}
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <ContractDocs contractId={contract.id} docs={contract.documents} />

      {/* Version history */}
      <ContractVersions contractId={contract.id} versions={contract.versions} />

      {/* Activity */}
      <Card>
        <CardHeader><CardTitle className="text-[15px]">Activity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <AddNote contractId={contract.id} />
          {contract.activities.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {contract.activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-[13px]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                  <div>
                    <div className="text-foreground"><span className="font-medium">{a.type.replaceAll("_", " ")}</span>{a.detail ? ` · ${a.detail}` : ""}</div>
                    <div className="text-[11.5px] text-muted-foreground">{fmtDate(a.createdAt)} · {a.actorName ?? "—"}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContractAuthoring({ contract }: { contract: ContractFull }) {
  const router = useRouter();
  const [body, setBody] = React.useState(contract.body ?? "");
  const [busy, setBusy] = React.useState(false);

  function insertTemplate() {
    const merged = defaultManagementAgreement({
      ownerName: contract.ownerName,
      propertyName: contract.propertyName,
      model: contract.model,
      baseFeePct: contract.baseFeePct ?? null,
      incentivePct: contract.incentivePct ?? null,
      termYears: contract.termYears ?? null,
      contractValue: contract.contractValue ?? null,
    });
    if (body.trim() && !window.confirm("Replace the current draft with the standard template?")) return;
    setBody(merged);
    toast.message("Template inserted — review, edit, then Save.");
  }

  async function save() {
    setBusy(true);
    try {
      const res = await updateAcqContract(contract.id, { body });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Draft saved");
      router.refresh();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5 text-[15px]">
          <FileText className="size-4" /> Authoring
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={insertTemplate}>Insert standard template</Button>
          <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="Author the agreement here, or click 'Insert standard template' to start from the Veloria management agreement (auto-filled with this deal's terms)."
          className="font-mono text-[12.5px] leading-relaxed"
        />
        <p className="text-[11.5px] text-muted-foreground">
          Edit the clauses as needed. The <strong>Preview / Download PDF</strong> button renders this as a branded, signature-ready agreement.
        </p>
      </CardContent>
    </Card>
  );
}

function F({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] text-foreground">{value || "—"}</dd>
    </div>
  );
}

function TerminateBox({ contractId, busy, run }: { contractId: string; busy: string | null; run: (k: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [gl, setGl] = React.useState("");
  if (!open) return <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setOpen(true)}><Ban className="size-3.5" /> Terminate</Button>;
  return (
    <div className="space-y-1.5 rounded-md border border-rose-200 p-2.5">
      <Label className="text-[12px]">Gain / loss (₹, negative for loss)</Label>
      <Input inputMode="numeric" value={gl} onChange={(e) => setGl(e.target.value)} placeholder="e.g. -50000" className="h-8" />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" disabled={busy !== null}
          onClick={() => run("terminate", () => terminateAcqContract(contractId, Number(gl || 0)), "Terminated")}>Confirm</Button>
      </div>
    </div>
  );
}

function RejectBox({ contractId, busy, run }: { contractId: string; busy: string | null; run: (k: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  if (!open) return <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setOpen(true)}>Request changes</Button>;
  return (
    <div className="space-y-1.5 rounded-md border border-rose-200 p-2.5">
      <Label className="text-[12px]">What needs to change?</Label>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason / requested changes…" />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" disabled={busy !== null || !reason.trim()}
          onClick={() => run("reject", () => rejectAcqContract(contractId, reason), "Sent back with changes")}>Send back</Button>
      </div>
    </div>
  );
}

function ContractDocs({ contractId, docs }: { contractId: string; docs: ContractFull["documents"] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function onUploaded(dataUrl: string, file: File) {
    setBusy(true);
    try {
      const res = await addAcqContractDocument(contractId, {
        label: file.name,
        url: dataUrl,
        fileName: file.name,
        mimeType: file.type,
      });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Document uploaded");
      router.refresh();
    } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-[15px]">Documents</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <FileUpload onUploaded={onUploaded} label={busy ? "Uploading…" : "Upload document"} disabled={busy} />
          <span className="text-[11.5px] text-muted-foreground">Images or PDF, up to ~5 MB.</span>
        </div>
        {docs.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No documents yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {docs.map((d) => (
              <li key={d.id}>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-primary hover:underline">{d.label ?? "Document"}</a>
                <span className="pl-2 text-[11.5px] text-muted-foreground">{fmtDate(d.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ContractVersions({ contractId, versions }: { contractId: string; versions: ContractFull["versions"] }) {
  const router = useRouter();
  const [view, setView] = React.useState<ContractFull["versions"][number] | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function restore(versionId: string) {
    setBusy(true);
    try {
      const res = await restoreAcqContractVersion(contractId, versionId);
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Version restored");
      setView(null);
      router.refresh();
    } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-[15px]">Version history</CardTitle></CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No saved versions yet. Each saved draft is snapshotted here.</p>
        ) : (
          <ul className="space-y-1.5">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-2 text-[13px]">
                <span className="text-foreground">Version {v.version}</span>
                <span className="flex items-center gap-3">
                  <span className="text-[11.5px] text-muted-foreground">{fmtDate(v.createdAt)}</span>
                  <button onClick={() => setView(v)} className="text-[12.5px] text-primary hover:underline">View</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!view} onOpenChange={(o) => { if (!o) setView(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version {view?.version}</DialogTitle>
            <DialogDescription>{view ? fmtDate(view.createdAt) : ""}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[12px] leading-relaxed">{view?.body}</pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setView(null)}>Close</Button>
            {view && <Button onClick={() => restore(view.id)} disabled={busy}>{busy ? "Restoring…" : "Restore this version"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AddNote({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await addAcqContractNote(contractId, body.trim());
      if (!res.success) { toast.error(res.error); return; }
      setBody(""); router.refresh();
    } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note / log activity…" rows={2} />
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={add} disabled={busy}>Add note</Button></div>
    </div>
  );
}
