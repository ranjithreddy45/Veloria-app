"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, FileText } from "lucide-react";
import { verifyPaymentProof } from "@/actions/payment.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";

interface Proof {
  id: string;
  amount: string | number;
  method: string;
  status: string;
  notes: string | null;
  receiptUrl: string | null;
  receiptUploadedAt: string | null;
}

export function PendingProofs({ payments }: { payments: Proof[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const proofs = payments.filter((p) => p.status === "PENDING" && p.receiptUrl);
  if (proofs.length === 0) return null;

  async function verify(id: string) {
    setBusyId(id);
    try {
      const res = await verifyPaymentProof(id);
      if (!res.success) return toast.error(res.error);
      toast.success("Payment verified — booking auto-confirms if the advance is covered.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function view(receiptUrl: string) {
    const url = (receiptUrl || "").trim();
    const isImg = /^data:image\/(png|jpe?g|gif|webp);base64,/.test(url);
    const isPdf = /^data:application\/pdf;base64,/.test(url);
    const isHttps = /^https:\/\//i.test(url);
    // Reject anything that could execute (javascript:, data:text/html, …).
    if (!isImg && !isPdf && !isHttps) {
      toast.error("Unsupported receipt format.");
      return;
    }
    if (isHttps) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    // For data-URLs, build elements via the DOM and set `src` as a PROPERTY —
    // never interpolate the value into an HTML string. An <img>/<iframe> with a
    // validated image/pdf data-URL cannot execute page script.
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    const el = w.document.createElement(isImg ? "img" : "iframe");
    el.src = url;
    el.style.border = "0";
    el.style.maxWidth = "100vw";
    if (isPdf) {
      el.style.width = "100vw";
      el.style.height = "100vh";
    }
    w.document.body.style.margin = "0";
    w.document.body.appendChild(el);
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="text-base text-amber-700">
          Payment proofs to verify ({proofs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {proofs.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2 text-sm">
            <div>
              <span className="font-medium numeric">{formatINR(p.amount)}</span>
              <span className="text-muted-foreground"> · {p.method.replace("_", " ")}</span>
              {p.notes && <span className="block text-xs text-muted-foreground">{p.notes}</span>}
            </div>
            <div className="flex gap-2">
              {p.receiptUrl && (
                <Button variant="outline" size="sm" onClick={() => view(p.receiptUrl!)}>
                  <FileText className="h-4 w-4" /> View
                </Button>
              )}
              <Button size="sm" onClick={() => verify(p.id)} disabled={busyId === p.id}>
                {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Verify & confirm
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
