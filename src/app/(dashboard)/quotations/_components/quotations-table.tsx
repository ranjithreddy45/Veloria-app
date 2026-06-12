"use client";

import Link from "next/link";
import { StatusPill } from "@/components/shared/status-pill";
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
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No quotations yet. Create one with the calculator.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
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
              <TableRow key={r.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/quotations/${r.id}`} className="hover:underline">
                    {r.quoteNumber}
                  </Link>
                </TableCell>
                <TableCell>{client}</TableCell>
                <TableCell>{r.occasion || "—"}</TableCell>
                <TableCell>
                  {r.eventDate
                    ? new Date(r.eventDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.guestCount || "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
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
