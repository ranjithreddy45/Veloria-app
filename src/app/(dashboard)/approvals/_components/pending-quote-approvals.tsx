"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CheckCircle2Icon,
  XCircleIcon,
  EyeIcon,
  Loader2Icon,
  FileTextIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  approveSalesQuotation,
  rejectSalesQuotation,
  type PendingQuoteApproval,
} from "@/actions/sales-quotation.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/utils";

interface Props {
  quotes: PendingQuoteApproval[];
}

// Pending quote approvals — quote approvals are tracked as a SalesQuotation
// status, not as generic ApprovalRequest rows, so they need their own section
// here that calls the quote-specific approve/reject actions.
export function PendingQuoteApprovals({ quotes: initial }: Props) {
  const router = useRouter();
  const [quotes, setQuotes] = React.useState(initial);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  React.useEffect(() => {
    setQuotes(initial);
  }, [initial]);

  if (quotes.length === 0) return null;

  async function handleApprove(id: string) {
    setLoadingId(id);
    const res = await approveSalesQuotation(id);
    if (res.success) {
      toast.success("Quotation approved");
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setLoadingId(null);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      toast.error("A comment is required when returning a quote");
      return;
    }
    setLoadingId(id);
    const res = await rejectSalesQuotation(id, rejectReason.trim());
    if (res.success) {
      toast.success("Quotation returned for changes");
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      setRejectReason("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setLoadingId(null);
  }

  return (
    <Card className="border-purple-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileTextIcon className="size-4 text-purple-600" />
          Pending quote approvals
          <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
            {quotes.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {quotes.map((q) => {
          const isLoading = loadingId === q.id;
          return (
            <div
              key={q.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-purple-200 bg-purple-100 text-xs font-medium text-purple-700"
                  >
                    QUOTE
                  </Badge>
                  <Link
                    href={`/quotations/${q.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {q.quoteNumber} · v{q.version}
                    {q.clientName ? ` — ${q.clientName}` : ""}
                  </Link>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {q.occasion && <span>{q.occasion}</span>}
                  <span className="font-medium text-foreground">{formatINR(q.grandTotal)}</span>
                  <span>
                    By:{" "}
                    <span className="font-medium">{q.submittedByName ?? "Unknown"}</span>
                  </span>
                  {q.submittedAt && (
                    <span>{format(new Date(q.submittedAt), "dd MMM yyyy, HH:mm")}</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleApprove(q.id)}
                  disabled={isLoading}
                  title="Approve"
                  className="text-success hover:bg-success/10 hover:text-success"
                >
                  {isLoading ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2Icon className="size-4" />
                  )}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isLoading}
                      title="Return for changes"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircleIcon className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Return quote for changes</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tell the rep what needs to change. This returns the quote to
                        draft.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                      placeholder="Reason..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setRejectReason("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleReject(q.id)}
                        className="bg-destructive text-white hover:bg-destructive/90"
                        disabled={!rejectReason.trim()}
                      >
                        Return
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/quotations/${q.id}`}>
                    <EyeIcon className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
