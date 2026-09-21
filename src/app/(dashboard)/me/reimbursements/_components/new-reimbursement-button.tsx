"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Paperclip, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import { submitReimbursement, addClaimAttachments } from "@/actions/hr-reimbursement.actions";

// Human labels for the raw category codes (TRAVEL, MEDICAL, …).
const CATEGORY_LABELS: Record<string, string> = {
  TRAVEL: "Travel",
  MEDICAL: "Medical",
  TELEPHONE: "Telephone",
  FUEL: "Fuel",
  BOOKS: "Books & periodicals",
  OTHER: "Other",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function NewReimbursementButton({ categories }: { categories: readonly string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [category, setCategory] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [fuelLiters, setFuelLiters] = React.useState("");
  const [claimDate, setClaimDate] = React.useState(today());
  const [billUrl, setBillUrl] = React.useState<string | null>(null);
  // Multiple bills. A trip is a hotel bill AND a cab receipt AND a meal
  // receipt; one slot meant the other two arrived by WhatsApp or not at all.
  // Held client-side until the claim exists, so an employee can add, remove and
  // replace freely before committing anything.
  const [attachments, setAttachments] = React.useState<
    { fileName: string; mimeType: string; data: string; bytes: number }[]
  >([]);
  const extraRef = React.useRef<HTMLInputElement>(null);

  /** Read picked files and hold them until the claim is saved. */
  async function onExtraFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file after removing it
    if (!files.length) return;
    for (const file of files) {
      try {
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error(`Could not read ${file.name}.`));
          r.readAsDataURL(file);
        });
        setAttachments((xs) => [
          ...xs,
          { fileName: file.name, mimeType: file.type, data, bytes: file.size },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that file.");
      }
    }
  }
  const [billName, setBillName] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  // Reset the form each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setCategory("");
      setTitle("");
      setAmount("");
      setFuelLiters("");
      setClaimDate(today());
      setBillUrl(null);
      setBillName(null);
      setNote("");
      setError(null);
    }
  }, [open]);

  function submit() {
    setError(null);
    if (!category) { setError("Pick a category."); return; }
    if (!title.trim()) { setError("Add a short description."); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Claim amount must be greater than zero."); return; }
    if (!claimDate) { setError("Pick the claim date."); return; }

    let fl: number | undefined = undefined;
    if (category === "FUEL") {
      fl = Number(fuelLiters);
      if (!Number.isFinite(fl) || fl <= 0) { setError("Liters are required for fuel claims."); return; }
    }

    startTransition(async () => {
      const res = await submitReimbursement({
        category,
        title: title.trim(),
        amount: amt,
        fuelLiters: fl,
        claimDate: new Date(claimDate).toISOString(),
        billUrl: billUrl || undefined,
        note: note.trim() || undefined,
      });
      if (!res.success) { setError(res.error); return; }

      // Attach the rest now the claim has an id. Reported separately because
      // the claim IS saved at this point — a failed attachment must never read
      // as "your claim was not submitted".
      if (attachments.length > 0 && res.data?.id) {
        const att = await addClaimAttachments(
          res.data.id,
          attachments.map((a) => ({ fileName: a.fileName, mimeType: a.mimeType, data: a.data }))
        );
        if (!att.success) {
          setError(`Claim saved, but the extra bills were not attached: ${att.error}`);
          router.refresh();
          return;
        }
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New claim
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New reimbursement claim</DialogTitle>
          <DialogDescription>
            HR reviews each claim and disburses approved amounts in a pay run.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-detail">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-detail">Description</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Client site visit — cab fare"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-detail">Amount (₹)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-detail">Claim date</Label>
              <Input
                type="date"
                value={claimDate}
                max={today()}
                onChange={(e) => setClaimDate(e.target.value)}
              />
            </div>
          </div>

          {category === "FUEL" && (
            <div className="space-y-1.5">
              <Label className="text-detail">Fuel (Liters)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={fuelLiters}
                onChange={(e) => setFuelLiters(e.target.value)}
                placeholder="0.0"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-detail">Receipts (optional)</Label>
            <div className="flex items-center gap-2">
              <FileUpload
                label={billUrl ? "Replace bill" : "Attach bill"}
                onUploaded={(dataUrl, file) => { setBillUrl(dataUrl); setBillName(file.name); }}
              />
              {billName && (
                <span className="flex min-w-0 items-center gap-1 text-detail text-success">
                  <Check className="size-3.5 shrink-0" />
                  <span className="truncate">{billName}</span>
                </span>
              )}
              {!billName && (
                <span className="flex items-center gap-1 text-detail text-muted-foreground">
                  <Paperclip className="size-3.5" /> Image or PDF
                </span>
              )}
            </div>

            {/* Every OTHER bill for this claim. Held client-side until the claim
                is saved, so add / remove / replace are free actions with nothing
                written yet — which is what "before submitting" means. */}
            <input
              ref={extraRef}
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onExtraFiles}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-8"
                onClick={() => extraRef.current?.click()}>
                <Paperclip className="mr-1.5 size-3.5" />
                Add more bills
              </Button>
              <span className="text-detail text-muted-foreground">
                {attachments.length > 0
                  ? `${attachments.length} more attached`
                  : "Attach every supporting bill for this claim"}
              </span>
            </div>

            {attachments.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {attachments.map((a, i) => (
                  <li key={`${a.fileName}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-detail">
                      {a.fileName}{" "}
                      <span className="text-muted-foreground">
                        ({a.bytes >= 1_000_000
                          ? `${(a.bytes / 1_000_000).toFixed(1)} MB`
                          : `${Math.max(1, Math.round(a.bytes / 1000))} KB`})
                      </span>
                    </span>
                    <Button type="button" variant="ghost" size="sm"
                      className="h-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setAttachments((xs) => xs.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-detail">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything HR should know about this expense…"
              rows={2}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="size-4 animate-spin" />} Submit claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
