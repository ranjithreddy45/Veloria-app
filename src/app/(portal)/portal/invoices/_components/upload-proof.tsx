"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { submitPaymentProof } from "@/actions/portal.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Method = "UPI" | "BANK_TRANSFER" | "CASH" | "CHEQUE";

export function UploadProof({
  userId,
  invoiceId,
  balanceDue,
}: {
  userId: string;
  invoiceId: string;
  balanceDue: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(balanceDue)));
  const [method, setMethod] = useState<Method>("UPI");
  const [fileName, setFileName] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Please upload an image under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDataUrl(String(reader.result || ""));
      setFileName(f.name);
    };
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!dataUrl) return toast.error("Attach a payment screenshot first.");
    const amt = parseFloat(amount);
    if (!(amt > 0)) return toast.error("Enter a valid amount.");
    setBusy(true);
    try {
      const res = await submitPaymentProof(userId, {
        invoiceId,
        amount: amt,
        method: method as never,
        receiptUrl: dataUrl,
        notes,
      });
      if (!res.success) return toast.error(res.error);
      toast.success("Payment proof submitted — our team will verify it shortly.");
      setOpen(false);
      setDataUrl("");
      setFileName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (balanceDue <= 0) return null;

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Already paid? Upload payment proof
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Upload payment proof</p>
      <p className="text-xs text-muted-foreground">
        Paid via UPI / bank transfer? Upload your screenshot and we&rsquo;ll verify and confirm your booking.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Amount paid (₹)</Label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
              <SelectItem value="CHEQUE">Cheque</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Screenshot / receipt</Label>
        <Input type="file" accept="image/*,application/pdf" onChange={onFile} />
        {fileName && (
          <p className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> {fileName} attached
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Reference / note (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="UTR / transaction reference" />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button size="sm" className="flex-1" onClick={submit} disabled={busy || !dataUrl}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Submit proof
        </Button>
      </div>
    </div>
  );
}
