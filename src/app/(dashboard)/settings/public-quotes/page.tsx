import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { listPublicQuoteDrafts } from "@/actions/public-quotes-admin.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Public Quotes — Veloria Grand" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PRICED: "secondary",
  LINK_SENT: "default",
  PAID: "default",
  CONVERTED: "default",
  ABANDONED: "outline",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PublicQuotesPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "publicquotes:read")) {
    redirect("/not-authorized");
  }

  const res = await listPublicQuoteDrafts({ limit: 100 });
  const rows = res.success ? res.data.data : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Public Quotes"
        description="Self-serve quotes built by customers on the public configurator (/configure). Triage hot leads, follow up on advance links, and promote drafts to full sales quotations."
      />

      {!res.success ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {res.error}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No public quotes yet. Share{" "}
            <span className="font-medium text-foreground">/configure</span> to start collecting
            self-serve quotes.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Grand total</TableHead>
                  <TableHead className="text-right">Advance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.customerName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.customerPhone || ""}
                        {r.customerPhone && r.customerEmail ? " · " : ""}
                        {r.customerEmail || ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{r.occasion || "Event"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.venueName ? `${r.venueName} · ` : ""}
                        {r.guestCount ? `${r.guestCount} guests` : ""}
                        {r.eventDate ? ` · ${fmtDate(r.eventDate)}` : ""}
                        {r.timeSlot ? ` · ${r.timeSlot}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.grandTotal > 0 ? formatINR(r.grandTotal) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.advanceAmount > 0 ? formatINR(r.advanceAmount) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(r.createdAt)}
                    </TableCell>
                    <TableCell className="space-x-2 text-right text-xs">
                      {r.paymentLinkUrl && (
                        <a
                          href={r.paymentLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          Pay link
                        </a>
                      )}
                      {r.invoiceId && (
                        <Link
                          href={`/invoices/${r.invoiceId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          Invoice
                        </Link>
                      )}
                      {r.leadId && (
                        <Link
                          href={`/leads/${r.leadId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          Lead
                        </Link>
                      )}
                      {r.salesQuotationId && (
                        <Link
                          href={`/quotations/${r.salesQuotationId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          Quotation
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
