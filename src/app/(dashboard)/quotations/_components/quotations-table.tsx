"use client";

import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const QUOTE_STATUS_META: Record<string, { label: string; hue: "slate" | "amber" | "emerald" | "blue" | "rose" }> = {
  DRAFT: { label: "Draft", hue: "slate" },
  PENDING_APPROVAL: { label: "Pending Approval", hue: "amber" },
  APPROVED: { label: "Approved", hue: "emerald" },
  SENT: { label: "Sent", hue: "blue" },
  REJECTED: { label: "Rejected", hue: "rose" },
};
const statusMeta = (s: string) => QUOTE_STATUS_META[s] ?? { label: s, hue: "slate" as const };

export interface QuotationListRow {
  id: string;
  quoteNumber: string;
  status: string;
  clientName: string | null;
  occasion: string | null;
  eventDate: string | null;
  guestCount: number;
  grandTotal: string | number;
  createdAt: string;
  createdBy?: { name: string | null } | null;
  contact?: { firstName: string; lastName: string } | null;
}

export function QuotationsTable({ rows }: { rows: QuotationListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card shadow-card">
        <EmptyState
          icon={<FileTextIcon />}
          title="No quotations yet"
          description="Build your first quotation with the calculator, submit it for approval, then send it to the customer."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Quote #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Occasion</TableHead>
            <TableHead>Event Date</TableHead>
            <TableHead className="text-right">Guests</TableHead>
            <TableHead className="text-right">Grand Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const client =
              r.clientName ||
              [r.contact?.firstName, r.contact?.lastName].filter(Boolean).join(" ") ||
              "—";
            return (
              <TableRow key={r.id} className="cursor-pointer transition-colors hover:bg-muted/50">
                <TableCell className="numeric font-medium">
                  <Link href={`/quotations/${r.id}`} className="hover:underline">
                    {r.quoteNumber}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{client}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{r.occasion || "—"}</TableCell>
                <TableCell className="numeric text-[13px] text-muted-foreground">
                  {r.eventDate
                    ? new Date(r.eventDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </TableCell>
                <TableCell className="numeric text-right text-muted-foreground">{r.guestCount || "—"}</TableCell>
                <TableCell className="numeric text-right font-semibold">
                  {inr(Number(r.grandTotal))}
                </TableCell>
                <TableCell>
                  <StatusPill {...statusMeta(r.status)} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
