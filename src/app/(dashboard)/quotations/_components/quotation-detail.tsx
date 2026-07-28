"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";

import { computeQuotation, type QuotationInput, type QuotationResult } from "@/lib/sales/quotation-calc";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  approveSalesQuotation,
  rejectSalesQuotation,
  sendSalesQuotation,
  submitSalesQuotation,
  newSalesQuotationVersion,
  deleteSalesQuotation,
} from "@/actions/sales-quotation.actions";

import { StatusPill } from "@/components/shared/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QUOTE_STATUS_META } from "./quotations-table";
import { QuotationCalculator } from "./quotation-calculator";
import { SlotBlockCard } from "./slot-block-card";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const statusMeta = (s: string) => QUOTE_STATUS_META[s] ?? { label: s, hue: "slate" as const };

interface LeadOpt {
  id: string;
  title: string;
  contactId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
}
interface VenueOpt { id: string; name: string }

interface QuoteRow {
  id: string;
  quoteNumber: string;
  version: number;
  status: string;
  inputsJson: QuotationInput;
  outputsJson: QuotationResult | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  occasion: string | null;
  eventDate: string | null;
  timeSlot: string | null;
  guestCount: number;
  notes: string | null;
  rejectedReason: string | null;
  pdfUrl: string | null;
  bookingId: string | null;
  slotBlockedAt: string | null;
  invoiceId: string | null;
  sentChannel: string | null;
  sentTo: string | null;
  sentAt: string | null;
  createdBy?: { name: string | null } | null;
  submittedBy?: { name: string | null } | null;
  approvedBy?: { name: string | null } | null;
  sentBy?: { name: string | null } | null;
  lead?: { id: string; title: string } | null;
  contact?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null;
  venue?: { id: string; name: string } | null;
  transitions?: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; actor?: { name: string | null } | null }[];
}

interface Props {
  quote: QuoteRow;
  perms: { canApprove: boolean; canSend: boolean; canCreate: boolean; canEdit: boolean };
  leads: LeadOpt[];
  venues: VenueOpt[];
  advancePaid?: boolean;
  isSuperAdmin?: boolean;
}

export function QuotationDetail({ quote, perms, leads, venues, advancePaid, isSuperAdmin }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendMethod, setSendMethod] = useState<"EMAIL" | "WHATSAPP" | "MANUAL_DOWNLOAD">("EMAIL");
  const [sendTo, setSendTo] = useState(quote.clientEmail ?? quote.contact?.email ?? "");

  const isDraft = quote.status === "DRAFT";
  const result: QuotationResult = quote.outputsJson ?? computeQuotation(quote.inputsJson);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.success) return toast.error(res.error);
      toast.success(ok);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ---- DRAFT: editable calculator ----
  if (isDraft && perms.canEdit) {
    const initial = {
      id: quote.id,
      input: quote.inputsJson,
      meta: {
        leadId: quote.lead?.id ?? null,
        venueId: quote.venue?.id ?? null,
        contactId: quote.contact?.id ?? null,
        clientName: quote.clientName ?? undefined,
        clientPhone: quote.clientPhone ?? undefined,
        clientEmail: quote.clientEmail ?? undefined,
        occasion: quote.occasion ?? undefined,
        eventDate: quote.eventDate ?? null,
        timeSlot: quote.timeSlot ?? undefined,
        notes: quote.notes ?? undefined,
      },
    };
    return (
      <div className="space-y-6">
        <Header quote={quote} />
        {quote.rejectedReason && (
          <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-xl border p-4 text-[13px]">
            <strong>Returned for changes:</strong> {quote.rejectedReason}
          </div>
        )}
        <QuotationCalculator leads={leads} venues={venues} initial={initial} />
      </div>
    );
  }

  const client =
    quote.clientName ||
    [quote.contact?.firstName, quote.contact?.lastName].filter(Boolean).join(" ") ||
    "—";

  return (
    <div className="space-y-6">
      <Header quote={quote} />

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {isDraft && perms.canCreate && (
          <Button onClick={() => run(() => submitSalesQuotation(quote.id), "Submitted for approval.")} disabled={busy}>
            <Send className="h-4 w-4" /> Submit for Approval
          </Button>
        )}
        {quote.status === "PENDING_APPROVAL" && perms.canApprove && (
          <>
            <Button onClick={() => run(() => approveSalesQuotation(quote.id), "Approved.")} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
            <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={busy}>
              <XCircle className="h-4 w-4" /> Return for Changes
            </Button>
          </>
        )}
        {(quote.status === "APPROVED" || quote.status === "SENT") && (
          <>
            <Button asChild variant="outline">
              <a href={quote.pdfUrl ?? `/api/quotations/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" /> View / Download PDF
              </a>
            </Button>
            {perms.canSend && (
              <Button onClick={() => setSendOpen(true)} disabled={busy}>
                <Mail className="h-4 w-4" /> Send to Customer
              </Button>
            )}
            {perms.canCreate && (
              <Button variant="outline" onClick={() => run(async () => {
                const res = await newSalesQuotationVersion(quote.id);
                if (res.success) router.push(`/quotations/${res.data.id}`);
                return res;
              }, "New version created.")} disabled={busy}>
                <Copy className="h-4 w-4" /> New Version
              </Button>
            )}
          </>
        )}
        {perms.canEdit && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => {
              if (!confirm("Delete this quotation? This cannot be undone.")) return;
              run(async () => {
                const res = await deleteSalesQuotation(quote.id);
                if (res.success) router.push("/quotations");
                return res;
              }, "Quotation deleted.");
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>

      {quote.sentAt && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-[13px] text-blue-700">
          Sent via {quote.sentChannel} {quote.sentTo ? `to ${quote.sentTo}` : ""} on{" "}
          {formatDateTime(quote.sentAt)}.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Quote summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Quotation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
              <Detail label="Client" value={client} />
              <Detail label="Phone" value={quote.clientPhone || "—"} numeric />
              <Detail label="Occasion" value={quote.occasion || "—"} />
              <Detail label="Event Date" value={quote.eventDate ? formatDate(quote.eventDate) : "—"} numeric />
              <Detail label="Time Slot" value={quote.timeSlot || "—"} />
              <Detail label="Hall" value={quote.venue?.name || "—"} />
              <Detail label="Guests" value={String(quote.guestCount || "—")} numeric />
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Particulars</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plan</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((l) => (
                    <tr key={l.sl} className="border-t transition-colors hover:bg-muted/40">
                      <td className="px-4 py-2.5">{l.particulars}</td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{l.plan}</td>
                      <td className="numeric px-4 py-2.5 text-right font-medium">{inr(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {quote.notes && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Remarks</p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{quote.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals + schedule + timeline */}
        <div className="space-y-4">
          {(quote.status === "APPROVED" || quote.status === "SENT") && perms.canSend && (
            <SlotBlockCard
              quotationId={quote.id}
              venues={venues}
              defaultVenueId={quote.venue?.id ?? null}
              defaultDateISO={quote.eventDate}
              defaultPlannerSlot={quote.timeSlot}
              blocked={quote.bookingId ? { bookingId: quote.bookingId, at: quote.slotBlockedAt } : null}
              invoiceId={quote.invoiceId}
              advancePaid={advancePaid}
              isSuperAdmin={isSuperAdmin}
            />
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Totals</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={inr(result.subtotal)} />
              {result.discountAmount > 0 && (
                <Row label={`Discount (${result.discountPct}%)`} value={`− ${inr(result.discountAmount)}`} muted />
              )}
              <Row
                label={`Tax (${
                  result.subtotal - result.discountAmount > 0
                    ? Math.round((result.tax / (result.subtotal - result.discountAmount)) * 100)
                    : 5
                }%)`}
                value={inr(result.tax)}
              />
              <div className="mt-2 flex items-baseline justify-between gap-4 border-t pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grand Total</span>
                <span className="numeric text-lg font-bold tracking-[-0.02em]">{inr(result.grandTotal)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Payment Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {result.paymentSchedule.map((p, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {p.label} <span className="numeric text-muted-foreground">({p.pct}%)</span>
                    </div>
                    <div className="text-[13px] text-muted-foreground">{p.dueHint}</div>
                  </div>
                  <span className="numeric shrink-0 font-semibold">{inr(p.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {quote.transitions && quote.transitions.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 text-[13px]">
                {quote.transitions.map((t) => (
                  <div key={t.id} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-medium">{statusMeta(t.toStatus).label}</span>
                      {t.note ? <span className="text-muted-foreground"> — {t.note}</span> : null}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                      {t.actor?.name ?? "—"} · <span className="numeric">{formatDate(t.createdAt)}</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return for changes</DialogTitle>
            <DialogDescription>Tell the rep what needs to change. This returns the quote to draft.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              disabled={busy || !rejectReason.trim()}
              onClick={() =>
                run(async () => {
                  const res = await rejectSalesQuotation(quote.id, rejectReason);
                  if (res.success) { setRejectOpen(false); setRejectReason(""); }
                  return res;
                }, "Returned for changes.")
              }
            >
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send quotation to customer</DialogTitle>
            <DialogDescription>Share the approved quotation PDF.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={sendMethod === "EMAIL" ? "default" : "outline"} onClick={() => setSendMethod("EMAIL")}>
                <Mail className="h-4 w-4" /> Email
              </Button>
              <Button type="button" size="sm" variant={sendMethod === "WHATSAPP" ? "default" : "outline"} onClick={() => setSendMethod("WHATSAPP")}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button type="button" size="sm" variant={sendMethod === "MANUAL_DOWNLOAD" ? "default" : "outline"} onClick={() => setSendMethod("MANUAL_DOWNLOAD")}>
                <Download className="h-4 w-4" /> Mark Downloaded
              </Button>
            </div>
            {sendMethod === "EMAIL" && (
              <div className="space-y-1.5">
                <Label>Recipient email</Label>
                <Input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="customer@email.com" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await sendSalesQuotation(quote.id, { method: sendMethod, to: sendTo });
                  if (res.success) setSendOpen(false);
                  return res;
                }, "Quotation sent.")
              }
            >
              <Send className="h-4 w-4" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Header({ quote }: { quote: QuoteRow }) {
  return (
    <PageHeader
      icon={FileText}
      accent="blue"
      eyebrow={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Sales · Quotation</span>
          <span className="h-3 w-px bg-border" />
          <span className="numeric text-foreground/80">v{quote.version}</span>
        </div>
      }
      title={quote.quoteNumber}
      help={<StatusPill {...statusMeta(quote.status)} size="sm" />}
    >
      <Button asChild variant="outline" size="sm">
        <a href="/quotations"><ArrowLeft className="h-4 w-4" /> All quotations</a>
      </Button>
    </PageHeader>
  );
}

/** Quiet uppercase micro-label over a confident value — the module's field anatomy. */
function Detail({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={numeric ? "numeric font-medium" : "font-medium"}>{value}</div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${muted ? "text-success" : ""}`}>
      <span className={muted ? "" : "text-muted-foreground"}>{label}</span>
      <span className="numeric">{value}</span>
    </div>
  );
}
