"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Search, FileSignature } from "lucide-react";

import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

// ============================================================
// Offer statuses → hue (mirrors RecOfferStatus).
// ============================================================
type OfferStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";

const STATUS_HUE: Record<OfferStatus, Hue> = {
  DRAFT: "slate",
  SENT: "blue",
  ACCEPTED: "emerald",
  DECLINED: "rose",
  WITHDRAWN: "amber",
};

const STATUS_LABEL: Record<OfferStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

interface OfferRow {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  jobOpeningId: string | null;
  jobTitle: string | null;
  ctc: number;
  joiningDate: string | null;
  status: string;
  createdAt: string;
}

// en-IN INR (whole rupees — annual CTC).
const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function OffersTable({ offers }: { offers: OfferRow[] }) {
  const [query, setQuery] = React.useState("");

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (o) =>
        o.candidateName.toLowerCase().includes(q) ||
        (o.jobTitle ?? "").toLowerCase().includes(q)
    );
  }, [offers, query]);

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by candidate or role…"
          className="h-9 pl-8"
        />
      </div>

      <Card className="min-w-0 overflow-hidden p-0 shadow-card">
        {visible.length === 0 ? (
          <EmptyState
            icon={<FileSignature className="size-5" />}
            title={offers.length === 0 ? "No offers yet" : "No matching offers"}
            description={
              offers.length === 0
                ? "Offers created for candidates will appear here, ready to print as letters."
                : "Try clearing your search."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">CTC (annual)</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Letter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((o) => {
                  const status = (STATUS_LABEL[o.status as OfferStatus]
                    ? (o.status as OfferStatus)
                    : "DRAFT") as OfferStatus;
                  return (
                    <TableRow key={o.id} className="transition-premium hover:bg-muted/40">
                      <TableCell>
                        <div className="min-w-0 leading-tight">
                          <span className="block truncate text-[13px] font-medium text-foreground">
                            {o.candidateName}
                          </span>
                          {o.candidateEmail && (
                            <span className="block truncate text-[11.5px] text-muted-foreground">
                              {o.candidateEmail}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-foreground/80">
                        {o.jobTitle || "—"}
                      </TableCell>
                      <TableCell className="text-right text-[13px] tabular-nums text-foreground">
                        {inrFmt.format(Math.round(o.ctc))}
                      </TableCell>
                      <TableCell className="text-[13px] text-foreground/80">
                        {o.joiningDate ? formatDate(o.joiningDate) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          label={STATUS_LABEL[status]}
                          hue={STATUS_HUE[status]}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="h-7">
                          <Link href={`/recruitment/offers/${o.id}/letter`}>
                            <FileText className="size-3.5" /> View letter
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
