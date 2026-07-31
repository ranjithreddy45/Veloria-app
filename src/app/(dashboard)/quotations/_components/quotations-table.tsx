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
      {/* This screen does NOT use the shared DataTable (it renders a plain
          <Table>), so it does not inherit the shell's stacked-card treatment.
          Seven columns force a sideways drag at 375px and push the Grand Total
          off-screen, so below `md` each quote becomes a tappable card. */}
      <ul className="divide-y md:hidden">
        {rows.map((r) => {
          const client =
            r.clientName ||
            [r.contact?.firstName, r.contact?.lastName].filter(Boolean).join(" ") ||
            "—";
          return (
            <li key={r.id}>
              <Link
                href={`/quotations/${r.id}`}
                className="block space-y-2 p-3.5 transition-colors active:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="numeric text-[13px] font-semibold">
                      {r.quoteNumber}
                    </p>
                    <p className="truncate text-[13px] font-medium text-foreground/90">
                      {client}
                    </p>
                  </div>
                  {/* shrink-0: the grand total is the reason this list exists —
                      it must never be the thing that gets clipped. */}
                  <p className="numeric shrink-0 text-[15px] font-semibold">
                    {inr(Number(r.grandTotal))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                  <StatusPill {...statusMeta(r.status)} size="xs" />
                  {r.occasion && <span className="truncate">{r.occasion}</span>}
                  {r.eventDate && (
                    <span className="numeric">
                      {new Date(r.eventDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {r.guestCount ? (
                    <span className="numeric">{r.guestCount} guests</span>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block">
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
    </div>
  );
}
