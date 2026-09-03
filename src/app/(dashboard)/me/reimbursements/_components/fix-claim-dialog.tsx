"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addClaimAttachments, resubmitClaim } from "@/actions/hr-reimbursement.actions";

// ============================================================
// Fixing a claim HR sent back.
//
// Before this, an incomplete claim could only be REJECTED, so the employee
// raised a brand new one — losing the original claim date, the history, and any
// note explaining what happened. This keeps the same claim and returns it to
// HR's queue once the missing pieces are supplied.
//
// HR's request is shown at the top and not buried: it is the entire reason the
// dialog is open, and an employee who cannot see what was asked for will guess.
// ============================================================

export function FixClaimDialog({
  claim,
  onClose,
}: {
  claim: { id: string; title: string; amount: number; decisionNote: string | null } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [files, setFiles] = React.useState<
    { fileName: string; mimeType: string; data: string; bytes: number }[]
  >([]);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (claim) {
      setTitle(claim.title);
      setAmount(String(claim.amount));
      setNote("");
      setFiles([]);
    }
  }, [claim]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of picked) {
      try {
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error(`Could not read ${file.name}.`));
          r.readAsDataURL(file);
        });
        setFiles((xs) => [...xs, { fileName: file.name, mimeType: file.type, data, bytes: file.size }]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read that file.");
      }
    }
  }

  async function submit() {
    if (!claim) return;
    const amt = Number(amount);
    if (!title.trim()) { toast.error("A short description is required."); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Claim amount must be greater than zero."); return; }

    setBusy(true);
    try {
      // Attachments FIRST. If they fail, the claim stays in NEEDS_INFO and the
      // employee can retry — whereas resubmitting first would put an
      // still-incomplete claim back in HR's queue.
      if (files.length > 0) {
        const att = await addClaimAttachments(
          claim.id,
          files.map((f) => ({ fileName: f.fileName, mimeType: f.mimeType, data: f.data }))
        );
        if (!att.success) { toast.error(att.error); return; }
      }

      const res = await resubmitClaim(claim.id, {
        title: title.trim(),
        amount: amt,
        note: note.trim() || undefined,
      });
      if (!res.success) { toast.error(res.error); return; }

      toast.success("Sent back to HR for approval.");
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={claim !== null} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add the missing details</DialogTitle>
          <DialogDescription>
            HR sent this claim back. Update it and it returns to them for approval.
          </DialogDescription>
        </DialogHeader>

        {claim?.decisionNote && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-detail">
            <span className="font-semibold text-foreground">HR asked for: </span>
            <span className="text-foreground/80">{claim.decisionNote}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-detail">Description</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-detail">Amount (₹)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-detail">Add bills</Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFiles}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => fileRef.current?.click()}>
                <Paperclip className="mr-1.5 size-3.5" /> Attach
              </Button>
              <span className="text-detail text-muted-foreground">
                {files.length > 0 ? `${files.length} to upload` : "Image or PDF"}
              </span>
            </div>
            {files.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {files.map((f, i) => (
                  <li key={`${f.fileName}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="min-w-0 truncate text-detail">{f.fileName}</span>
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="h-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-detail">Note to HR (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Send back to HR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
