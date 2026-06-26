"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCwIcon, PhoneIncoming } from "lucide-react";

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
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { retryMissedCallWhatsApp } from "@/actions/missed-call-rescue.actions";

// ============================================================
// Types (mirror the action's serialized return shape)
// ============================================================

interface MissedCallRow {
  id: string;
  provider: string;
  externalCallId: string | null;
  callerPhone: string;
  receivedAt: string;
  wasKnownNumber: boolean;
  leadId: string | null;
  contactId: string | null;
  contactName: string | null;
  leadTitle: string | null;
  whatsappSent: boolean;
  whatsappMessageId: string | null;
  failReason: string | null;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const handleRetry = () => {
    startTransition(async () => {
      const res = await retryMissedCallWhatsApp(id);
      if (res.success) {
        toast.success("Instant WhatsApp re-sent.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRetry}
      disabled={pending}
      className="h-7 gap-1.5 text-xs"
    >
      <RefreshCwIcon className={pending ? "size-3 animate-spin" : "size-3"} />
      Retry
    </Button>
  );
}

export function MissedCallsBoard({
  initialRows,
  total,
}: {
  initialRows: MissedCallRow[];
  total: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneIncoming className="size-4 text-muted-foreground" />
          Inbound ring log
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {total} ring{total === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        {initialRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No inbound rings rescued yet. Point your telephony / IVR
            StatusCallback at{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              /api/webhooks/telephony/inbound?provider=…
            </code>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialRows.map((r) => {
                  const knownHue: Hue = r.wasKnownNumber ? "amber" : "blue";
                  const waHue: Hue = r.whatsappSent
                    ? "emerald"
                    : r.wasKnownNumber
                      ? "slate"
                      : "rose";
                  const waLabel = r.whatsappSent
                    ? "Sent"
                    : r.wasKnownNumber
                      ? "N/A"
                      : "Failed";
                  // Retry only for UNKNOWN rescues whose message didn't land
                  // and that have a linked lead to message against.
                  const canRetry =
                    !r.whatsappSent &&
                    !r.wasKnownNumber &&
                    !!r.leadId &&
                    !!r.contactId;

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium tabular-nums">
                        {r.callerPhone}
                        {r.contactName ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {r.contactName}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          label={r.wasKnownNumber ? "Known" : "Unknown"}
                          hue={knownHue}
                          size="xs"
                        />
                      </TableCell>
                      <TableCell>
                        {r.leadId ? (
                          <Link
                            href={`/leads/${r.leadId}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {r.leadTitle || "View lead"}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPill label={waLabel} hue={waHue} size="xs" />
                        {!r.whatsappSent && r.failReason ? (
                          <span
                            className="block max-w-[220px] truncate text-[11px] text-muted-foreground"
                            title={r.failReason}
                          >
                            {r.failReason}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.provider}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatWhen(r.receivedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {canRetry ? <RetryButton id={r.id} /> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
