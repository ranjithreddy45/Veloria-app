"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCwIcon, AlertTriangle, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { retrySpeedToLead } from "@/actions/speed-to-lead.actions";

// ============================================================
// Types (mirror the action's serialized return shape)
// ============================================================

interface BreachRow {
  leadId: string;
  title: string;
  contactName: string;
  assignedToName: string | null;
  firstContactDue: string | null;
  minutesOverdue: number;
}

interface RecentRow {
  leadId: string;
  contactName: string;
  status: string;
  channel: string;
  latencyMs: number | null;
  assignedToName: string | null;
  sentAt: string | null;
  failReason: string | null;
}

interface SlaCockpitProps {
  breaches: BreachRow[];
  recent: RecentRow[];
}

// ============================================================
// Helpers
// ============================================================

const STATUS_HUE: Record<string, Hue> = {
  SENT: "emerald",
  PENDING: "blue",
  FAILED: "rose",
  SKIPPED: "amber",
};

function formatLatency(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatOverdue(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// Retry button
// ============================================================

function RetryButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleRetry() {
    startTransition(async () => {
      const res = await retrySpeedToLead(leadId);
      if (res.success) {
        toast.success(
          res.data.status === "SENT"
            ? "First-response re-sent"
            : `Retry: ${res.data.status.toLowerCase()}`
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRetry}
      disabled={pending}
      className="h-7 px-2 text-xs"
    >
      <RefreshCwIcon className={`size-3.5 ${pending ? "animate-spin" : ""}`} />
      Retry
    </Button>
  );
}

// ============================================================
// Cockpit
// ============================================================

export function SlaCockpit({ breaches, recent }: SlaCockpitProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Breached first-contact SLAs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-rose-600" />
            Breached first-contact SLA
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs numeric text-muted-foreground">
              {breaches.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {breaches.length === 0 ? (
            <EmptyState
              className="py-10"
              tone="success"
              icon={<AlertTriangle />}
              title="No breached SLAs"
              description="Every new enquiry has been responded to inside its first-contact window."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breaches.map((b) => (
                  <TableRow key={b.leadId}>
                    <TableCell>
                      <Link
                        href={`/leads/${b.leadId}`}
                        className="font-medium hover:underline"
                      >
                        {b.title}
                      </Link>
                      <div className="text-[13px] text-muted-foreground">
                        {b.contactName}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.assignedToName ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[13px] font-semibold numeric text-rose-600">
                        {formatOverdue(b.minutesOverdue)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent automated first-responses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="size-4 text-emerald-600" />
            Recent first-responses
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs numeric text-muted-foreground">
              {recent.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {recent.length === 0 ? (
            <EmptyState
              className="py-10"
              icon={<Zap />}
              title="No first-responses yet"
              description="Automated WhatsApp first-responses will be logged here as new leads arrive."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">When</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => {
                  const canRetry = r.status === "FAILED" || r.status === "SKIPPED";
                  return (
                    <TableRow key={r.leadId}>
                      <TableCell>
                        <Link
                          href={`/leads/${r.leadId}`}
                          className="font-medium hover:underline"
                        >
                          {r.contactName}
                        </Link>
                        {r.failReason && (
                          <div className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {r.failReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          label={r.status}
                          hue={STATUS_HUE[r.status] ?? "neutral"}
                          size="xs"
                        />
                      </TableCell>
                      <TableCell className="text-right text-[13px] numeric text-muted-foreground">
                        {formatLatency(r.latencyMs)}
                      </TableCell>
                      <TableCell className="numeric text-right text-[12px] text-muted-foreground">
                        {formatTime(r.sentAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {canRetry ? <RetryButton leadId={r.leadId} /> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
