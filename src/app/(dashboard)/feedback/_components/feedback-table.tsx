"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, RefreshCw, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  resolveFeedback,
  manualEnqueueReviewRequest,
} from "@/actions/review-request.actions";

// ============================================================
// INTERNAL feedback table — review-request funnel + private feedback.
// ============================================================

interface FeedbackRow {
  id: string;
  status: string;
  gateRating: number | null;
  sentAt: string | null;
  ratedAt: string | null;
  createdAt: string;
  failReason: string | null;
  customerName: string;
  bookingId: string;
  bookingNumber: string;
  eventName: string;
  eventDate: string;
  venueName: string;
  feedback: {
    id: string;
    rating: number;
    comment: string | null;
    isResolved: boolean;
    resolvedAt: string | null;
    createdAt: string;
  } | null;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  SENT: "outline",
  RATED: "secondary",
  ROUTED_PUBLIC: "success",
  ROUTED_PRIVATE: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
  SKIPPED: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  RATED: "Rated",
  ROUTED_PUBLIC: "To Google",
  ROUTED_PRIVATE: "Private",
  COMPLETED: "Completed",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function FeedbackTable({ rows }: { rows: FeedbackRow[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onResolve = (reviewRequestId: string) => {
    setBusyId(reviewRequestId);
    setNotice(null);
    startTransition(async () => {
      const res = await resolveFeedback(reviewRequestId);
      setNotice(res.success ? "Feedback marked resolved." : res.error || "Failed to resolve.");
      setBusyId(null);
    });
  };

  const onResend = (reviewRequestId: string, bookingId: string) => {
    setBusyId(reviewRequestId);
    setNotice(null);
    startTransition(async () => {
      const res = await manualEnqueueReviewRequest(bookingId);
      setNotice(
        res.success ? res.data?.message ?? "Sent." : res.error || "Failed to send.",
      );
      setBusyId(null);
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-card">
        No review requests yet. They’re enqueued automatically when bookings are
        marked completed.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notice && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          {notice}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Private feedback</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const isPrivate = r.status === "ROUTED_PRIVATE";
              const fb = r.feedback;
              const rowBusy = busyId === r.id && pending;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.customerName}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.eventName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.venueName} · {fmtDate(r.eventDate)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    {r.status === "FAILED" && r.failReason && (
                      <div className="mt-1 max-w-[200px] truncate text-xs text-rose-500" title={r.failReason}>
                        {r.failReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.gateRating != null ? (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {r.gateRating}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    {fb?.comment ? (
                      <span className="text-sm">{fb.comment}</span>
                    ) : isPrivate ? (
                      <span className="text-xs text-muted-foreground">
                        (rating only)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {fb?.isResolved && (
                      <div className="mt-1">
                        <Badge variant="success">Resolved</Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(r.sentAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isPrivate && fb && !fb.isResolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rowBusy}
                          onClick={() => onResolve(r.id)}
                        >
                          {rowBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-1 size-3.5" /> Resolve
                            </>
                          )}
                        </Button>
                      )}
                      {(r.status === "FAILED" ||
                        r.status === "PENDING" ||
                        r.status === "SENT") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={rowBusy}
                          onClick={() => onResend(r.id, r.bookingId)}
                          title="Re-send the review request"
                        >
                          {rowBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
