"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, Minus, RefreshCw, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDateTime } from "@/lib/utils";
import {
  getWhatsAppInboundEvent,
  replayWhatsAppInboundEvent,
} from "@/actions/whatsapp-inbound.actions";
import type { InboundEventDetail, InboundEventRow } from "@/lib/whatsapp/inbound-capture";

// ============================================================
// Inbound events viewer — table of the latest 200 captures, a detail dialog
// with redacted headers + pretty raw JSON, a "problems only" filter (server-
// side via ?problems=1 so it is the latest 200 PROBLEMS, not a client sieve of
// the latest 200 rows), and the "send a test" verification hint.
// ============================================================

interface Props {
  events: InboundEventRow[];
  problemsOnly: boolean;
  canReplay: boolean;
  loadError: string | null;
}

/** ✓ / ✗ / — as a compact glyph with a title for hover. */
function Tri({ value, yes, no, none }: { value: boolean | null; yes: string; no: string; none?: string }) {
  if (value === true) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" title={yes}>
        <Check className="size-3.5" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-md bg-destructive/10 text-destructive" title={no}>
        <X className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground" title={none ?? "Not evaluated"}>
      <Minus className="size-3.5" />
    </span>
  );
}

function isProblem(e: InboundEventRow): boolean {
  return (
    e.signatureValid === false ||
    !!e.parseError ||
    !e.handled ||
    (!!e.fromPhone && !e.matchedContactId)
  );
}

function prettyJson(text: string | null): string {
  if (!text) return "(none)";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function InboundEventsViewer({ events, problemsOnly, canReplay, loadError }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboundEventDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);

  function setProblems(on: boolean) {
    startTransition(() => {
      router.push(on ? `${pathname}?problems=1` : pathname);
    });
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function open(id: string) {
    setOpenId(id);
    setDetail(null);
    setDetailError(null);
    const res = await getWhatsAppInboundEvent(id);
    if (res.success) setDetail(res.data);
    else setDetailError(res.error);
  }

  async function replay() {
    if (!detail) return;
    setReplaying(true);
    try {
      const res = await replayWhatsAppInboundEvent(detail.id);
      if (res.success) {
        toast.success(
          res.data.handled
            ? `Replayed: ${res.data.eventType ?? "event"} handled${res.data.matchedContactId ? " and matched to a contact" : ""}`
            : `Replayed, but not handled: ${res.data.parseError ?? "unrecognised payload"}`
        );
        await open(detail.id);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setReplaying(false);
    }
  }

  const problemCount = events.filter(isProblem).length;

  return (
    <div className="space-y-6">
      {/* ---- Verification hint ------------------------------------------ */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-body font-semibold">Send a test — how to verify inbound works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-detail text-muted-foreground">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              From a personal phone (not the business number), send any WhatsApp text to the business
              number — e.g. <span className="font-mono text-foreground">test inbound</span>.
            </li>
            <li>
              Within a few seconds press <span className="font-medium text-foreground">Refresh</span> here.
              A new row should appear with your number under <span className="font-medium text-foreground">From</span>.
            </li>
            <li>
              <span className="font-medium text-foreground">Signature ✓, Parsed ✓, Handled ✓ and a Contact link</span> means
              the whole pipeline works — the message is also in that contact&apos;s WhatsApp thread.
            </li>
            <li>
              <span className="font-medium text-foreground">No row at all</span> → the provider is not delivering to this
              deployment. In Weflux → Outbound endpoints, register the exact URL shown on the WhatsApp settings page
              (<span className="font-mono">/api/webhooks/weflux?token=…</span>) and tick the message received / sent /
              status events. For Meta, check the app&apos;s webhook subscription and the verify token.
            </li>
            <li>
              <span className="font-medium text-foreground">Row appears but Signature ✗</span> → the verify token or signing
              secret saved here does not match the provider&apos;s. <span className="font-medium text-foreground">Parsed ✓
              but Handled ✗</span> → the provider sent an event name or shape the parser does not recognise: open the row,
              read the raw JSON, fix the parser, then use <span className="font-medium text-foreground">Replay</span> on
              that same row to prove the fix against the real payload.
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* ---- Toolbar ----------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="problems-only" checked={problemsOnly} onCheckedChange={setProblems} disabled={isPending} />
            <Label htmlFor="problems-only" className="text-detail">Problems only</Label>
          </div>
          <span className="text-meta text-muted-foreground">
            {problemsOnly
              ? `${events.length} problem${events.length === 1 ? "" : "s"} (latest 200)`
              : `${events.length} event${events.length === 1 ? "" : "s"} shown · ${problemCount} with problems`}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
          <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-detail text-destructive">
          <AlertTriangle className="size-4" />
          {loadError}
        </div>
      )}

      {/* ---- Table ------------------------------------------------------- */}
      {events.length === 0 ? (
        <EmptyState
          title={problemsOnly ? "No problem events" : "No inbound events captured yet"}
          description={
            problemsOnly
              ? "Every captured event authenticated, parsed and was handled. Switch the filter off to see them."
              : "Nothing has hit the webhook since this log was enabled. Send a test message (steps above) and refresh."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Sig</TableHead>
                <TableHead className="text-center">Parsed</TableHead>
                <TableHead className="text-center">Handled</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Preview / error</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => {
                const problem = isProblem(e);
                return (
                  <TableRow key={e.id} className={cn(problem && "bg-destructive/[0.04]")}>
                    <TableCell className="whitespace-nowrap text-detail numeric">{formatDateTime(e.receivedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-meta">{e.provider}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-detail">{e.fromPhone ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-detail">{e.eventType ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <Tri value={e.signatureValid} yes="Authenticated" no="Auth failed" none="Auth not evaluated" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Tri value={e.parsedOk} yes="Parsed" no={e.parseError ? e.parseError : "Not parsed (still processing, or rejected before parsing)"} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Tri value={e.handled} yes="Handled" no="Nothing was done with this event" />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-detail">
                      {e.matchedContactId ? (
                        <Link
                          href={`/contacts/${e.matchedContactId}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {e.matchedContactName || e.matchedContactId}
                          <ExternalLink className="size-3" />
                        </Link>
                      ) : e.fromPhone ? (
                        <span className="text-destructive">Unmatched</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[28rem]">
                      {e.parseError ? (
                        <span className="line-clamp-2 text-detail text-destructive" title={e.parseError}>{e.parseError}</span>
                      ) : (
                        <span className="line-clamp-2 text-detail text-muted-foreground" title={e.textPreview ?? undefined}>
                          {e.textPreview ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => open(e.id)}>View</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ---- Detail dialog ----------------------------------------------- */}
      <Dialog open={!!openId} onOpenChange={(o) => { if (!o) { setOpenId(null); setDetail(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-body">Inbound event</DialogTitle>
            <DialogDescription className="text-detail">
              Exactly what the provider sent, as received. Secret-bearing headers are stored only as a presence marker.
            </DialogDescription>
          </DialogHeader>

          {detailError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-detail text-destructive">{detailError}</div>
          )}
          {!detail && !detailError && <p className="text-detail text-muted-foreground">Loading…</p>}

          {detail && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-detail sm:grid-cols-3">
                <div><dt className="text-meta uppercase tracking-wide text-muted-foreground">Received</dt><dd className="numeric">{formatDateTime(detail.receivedAt)}</dd></div>
                <div><dt className="text-meta uppercase tracking-wide text-muted-foreground">Provider</dt><dd>{detail.provider}</dd></div>
                <div><dt className="text-meta uppercase tracking-wide text-muted-foreground">Event type</dt><dd>{detail.eventType ?? "—"}</dd></div>
                <div><dt className="text-meta uppercase tracking-wide text-muted-foreground">From</dt><dd className="font-mono">{detail.fromPhone ?? "—"}</dd></div>
                <div><dt className="text-meta uppercase tracking-wide text-muted-foreground">Message id</dt><dd className="break-all font-mono">{detail.messageId ?? "—"}</dd></div>
                <div>
                  <dt className="text-meta uppercase tracking-wide text-muted-foreground">Contact</dt>
                  <dd>
                    {detail.matchedContactId ? (
                      <Link href={`/contacts/${detail.matchedContactId}`} className="text-primary hover:underline">
                        {detail.matchedContactName || detail.matchedContactId}
                      </Link>
                    ) : "—"}
                  </dd>
                </div>
                <div className="flex items-center gap-2"><dt className="text-meta uppercase tracking-wide text-muted-foreground">Signature</dt><dd><Tri value={detail.signatureValid} yes="Authenticated" no="Auth failed" /></dd></div>
                <div className="flex items-center gap-2"><dt className="text-meta uppercase tracking-wide text-muted-foreground">Parsed</dt><dd><Tri value={detail.parsedOk} yes="Parsed" no="Not parsed" /></dd></div>
                <div className="flex items-center gap-2"><dt className="text-meta uppercase tracking-wide text-muted-foreground">Handled</dt><dd><Tri value={detail.handled} yes="Handled" no="Not handled" /></dd></div>
              </dl>

              {detail.parseError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-detail text-destructive">{detail.parseError}</div>
              )}
              {detail.truncated && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-detail">
                  Raw body was truncated at 64 KB. It can be read but not replayed.
                </div>
              )}

              <div>
                <p className="mb-1 text-meta uppercase tracking-wide text-muted-foreground">Headers (redacted)</p>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-meta leading-relaxed">{prettyJson(detail.headers)}</pre>
              </div>
              <div>
                <p className="mb-1 text-meta uppercase tracking-wide text-muted-foreground">Raw body</p>
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-meta leading-relaxed">{prettyJson(detail.rawBody)}</pre>
              </div>

              {canReplay && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <p className="text-detail text-muted-foreground">
                    Re-run the parse/handle pipeline on this exact payload (auth is not re-checked; stored messages dedupe on message id).
                  </p>
                  <Button size="sm" variant="secondary" onClick={replay} disabled={replaying || detail.truncated}>
                    <RotateCcw className={cn("size-3.5", replaying && "animate-spin")} />
                    {replaying ? "Replaying…" : "Replay"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
