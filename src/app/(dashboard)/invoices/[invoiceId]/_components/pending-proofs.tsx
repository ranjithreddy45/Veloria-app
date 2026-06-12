"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, FileText } from "lucide-react";
import { verifyPaymentProof } from "@/actions/payment.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

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
    // data-URL or external link — open in a new tab for review.
    const w = window.open();
    if (w) {
      if (receiptUrl.startsWith("data:")) {
        w.document.write(
          `<iframe src="${receiptUrl}" style="border:0;width:100vw;height:100vh"></iframe>`
        );
      } else {
        w.location.href = receiptUrl;
      }
    }
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
              <span className="font-medium tabular-nums">{inr(Number(p.amount))}</span>
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
