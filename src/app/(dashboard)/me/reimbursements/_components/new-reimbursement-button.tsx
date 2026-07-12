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
import { submitReimbursement } from "@/actions/hr-reimbursement.actions";

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
  const [claimDate, setClaimDate] = React.useState(today());
  const [billUrl, setBillUrl] = React.useState<string | null>(null);
  const [billName, setBillName] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  // Reset the form each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setCategory("");
      setTitle("");
      setAmount("");
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

    startTransition(async () => {
      const res = await submitReimbursement({
        category,
        title: title.trim(),
        amount: amt,
        claimDate: new Date(claimDate).toISOString(),
        billUrl: billUrl || undefined,
        note: note.trim() || undefined,
      });
      if (!res.success) { setError(res.error); return; }
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
            <Label className="text-[12.5px]">Category</Label>
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
            <Label className="text-[12.5px]">Description</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Client site visit — cab fare"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Amount (₹)</Label>
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
              <Label className="text-[12.5px]">Claim date</Label>
              <Input
                type="date"
                value={claimDate}
                max={today()}
                onChange={(e) => setClaimDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Receipt (optional)</Label>
            <div className="flex items-center gap-2">
              <FileUpload
                label={billUrl ? "Replace bill" : "Attach bill"}
                onUploaded={(dataUrl, file) => { setBillUrl(dataUrl); setBillName(file.name); }}
              />
              {billName && (
                <span className="flex min-w-0 items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5 shrink-0" />
                  <span className="truncate">{billName}</span>
                </span>
              )}
              {!billName && (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Paperclip className="size-3.5" /> Image or PDF, up to 5 MB
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything HR should know about this expense…"
              rows={2}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

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
