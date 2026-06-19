"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  PenLineIcon,
  Loader2Icon,
  CopyIcon,
  SendIcon,
  XCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import {
  createSignatureRequest,
  getSignatureRequestsForBooking,
  sendSignatureRequest,
  voidSignatureRequest,
} from "@/actions/signature.actions";

// ============================================================
// Booking → E-Signature panel (INTERNAL)
// Lists signature requests for a booking and lets a permitted user
// create / send / copy / void a tokenized sign link. Gated via
// usePermissions() since /bookings already maps to bookings:read.
// ============================================================

interface SignatureRequestRow {
  id: string;
  token: string;
  status: string;
  signUrl: string;
  signerName: string | null;
  signerEmail: string | null;
  signerPhone: string | null;
  signatureType: string | null;
  signedAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  isLocked: boolean;
  expiresAt: string | null;
  declinedReason: string | null;
  createdAt: string;
  createdBy: { name: string | null } | null;
}

interface Props {
  bookingId: string;
  /** When false, the create button is disabled with an explanatory hint. */
  canRequest: boolean;
}

const STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: { label: "Draft", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  SENT: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200" },
  VIEWED: { label: "Viewed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  SIGNED: { label: "Signed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DECLINED: { label: "Declined", className: "bg-rose-50 text-rose-700 border-rose-200" },
  EXPIRED: { label: "Expired", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  VOIDED: { label: "Voided", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

export function SignaturePanel({ bookingId, canRequest }: Props) {
  const { can } = usePermissions();
  const [rows, setRows] = useState<SignatureRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const canRead = can("esign:read");
  const canCreate = can("esign:create");
  const canSend = can("esign:send");
  const canVoid = can("esign:update");

  const load = useCallback(async () => {
    const res = await getSignatureRequestsForBooking(bookingId);
    if (res.success) {
      setRows(res.data as unknown as SignatureRequestRow[]);
    }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    void load();
  }, [canRead, load]);

  if (!canRead) return null;

  function handleCreate() {
    startTransition(async () => {
      const res = await createSignatureRequest({ bookingId, expiresInDays: 14 });
      if (res.success) {
        toast.success("Signature request created. Share the link to collect a signature.");
        await load();
      } else {
        toast.error(res.error || "Failed to create signature request");
      }
    });
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Sign link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  function handleSend(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await sendSignatureRequest(id, { method: "WHATSAPP" });
      if (res.success) {
        toast.success("Sign link sent via WhatsApp");
        await load();
      } else {
        toast.error(res.error || "Failed to send");
      }
      setBusyId(null);
    });
  }

  function handleVoid(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await voidSignatureRequest(id);
      if (res.success) {
        toast.success("Signature request voided");
        await load();
      } else {
        toast.error(res.error || "Failed to void");
      }
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLineIcon className="size-4 text-violet-600" />
            E-Signature
          </CardTitle>
          <CardDescription>
            Send the booking confirmation &amp; T&amp;C for the client to sign.
          </CardDescription>
        </div>
        {canCreate && (
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={isPending || !canRequest}
            title={
              canRequest
                ? undefined
                : "Only confirmed bookings can be sent for signature."
            }
          >
            {isPending && busyId === null ? (
              <Loader2Icon className="mr-1.5 size-4 animate-spin" />
            ) : (
              <PenLineIcon className="mr-1.5 size-4" />
            )}
            Request signature
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No signature requests yet.
            {!canRequest &&
              " Confirm this booking to send the confirmation for signature."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const terminal =
                r.isLocked ||
                ["SIGNED", "DECLINED", "VOIDED", "EXPIRED"].includes(r.status);
              return (
                <li key={r.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span className="text-sm font-medium text-foreground">
                        {r.signerName || "Unnamed signer"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(r.createdAt), "d MMM yyyy")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {r.status === "SIGNED" && r.signedAt ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2Icon className="size-3.5" />
                        Signed {format(new Date(r.signedAt), "d MMM, h:mm a")}
                        {r.signatureType
                          ? ` (${r.signatureType.toLowerCase()})`
                          : ""}
                      </span>
                    ) : r.status === "DECLINED" ? (
                      <span className="inline-flex items-center gap-1 text-rose-600">
                        <XCircleIcon className="size-3.5" />
                        Declined
                        {r.declinedReason ? `: ${r.declinedReason}` : ""}
                      </span>
                    ) : r.expiresAt ? (
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="size-3.5" />
                        Expires {format(new Date(r.expiresAt), "d MMM yyyy")}
                      </span>
                    ) : null}
                  </div>

                  {!terminal && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(r.signUrl)}
                      >
                        <CopyIcon className="mr-1.5 size-3.5" />
                        Copy link
                      </Button>
                      {canSend && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending && busyId === r.id}
                          onClick={() => handleSend(r.id)}
                        >
                          {isPending && busyId === r.id ? (
                            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <SendIcon className="mr-1.5 size-3.5" />
                          )}
                          Send via WhatsApp
                        </Button>
                      )}
                      {canVoid && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700"
                          disabled={isPending && busyId === r.id}
                          onClick={() => handleVoid(r.id)}
                        >
                          <XCircleIcon className="mr-1.5 size-3.5" />
                          Void
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
