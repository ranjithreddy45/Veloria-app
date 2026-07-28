"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Receipt,
  Wallet,
  Clock,
  ArrowUpRight,
  Sparkles,
  HandCoins,
  ChevronDown,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatINR } from "@/lib/utils";
import type {
  UninvoicedBooking,
  PayoutStatement,
} from "@/actions/finance-revenue.actions";

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function fmtDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

const PAYOUT_HUE: Record<string, Hue> = {
  PENDING: "amber",
  APPROVED: "blue",
  PAID: "emerald",
  CANCELLED: "slate",
};

export function RevenueWorkspace({
  uninvoiced,
  statements,
}: {
  uninvoiced: UninvoicedBooking[];
  statements: PayoutStatement[];
}) {
  const uninvoicedTotal = uninvoiced.reduce((s, b) => s + b.amount, 0);
  const payoutTotal = statements.reduce((s, v) => s + v.total, 0);
  const payoutPending = statements.reduce((s, v) => s + v.pending, 0);

  return (
    <Tabs defaultValue="auto-invoice">
      <TabsList>
        <TabsTrigger value="auto-invoice" className="gap-1.5">
          <Receipt className="size-3.5" /> Auto-invoice
        </TabsTrigger>
        <TabsTrigger value="payouts" className="gap-1.5">
          <HandCoins className="size-3.5" /> Payout statements
        </TabsTrigger>
      </TabsList>

      {/* ---------------- Auto-invoice ---------------- */}
      <TabsContent value="auto-invoice" className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="Confirmed · uninvoiced"
            value={uninvoiced.length}
            accent="amber"
            icon={<FileText className="size-4" />}
            sub="needs invoicing"
          />
          <StatTile
            label="Total uninvoiced"
            value={formatINR(uninvoicedTotal)}
            accent="indigo"
            icon={<Wallet className="size-4" />}
            sub="Contract value awaiting an invoice"
          />
        </div>

        <Card className="overflow-hidden py-0 shadow-card">
          <CardContent className="p-0">
            {uninvoiced.length === 0 ? (
              <EmptyState
                tone="success"
                icon={<Sparkles className="size-5" />}
                title="All confirmed bookings are invoiced ✨"
                description="Every confirmed event already has an invoice. New confirmations will surface here automatically."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uninvoiced.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium">{b.eventName}</div>
                        <div className="text-[11px] text-muted-foreground numeric">
                          {b.bookingNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.contact}
                      </TableCell>
                      <TableCell className="numeric text-muted-foreground">
                        {fmtDate(b.date)}
                      </TableCell>
                      <TableCell className="text-right font-medium numeric">
                        {formatINR(b.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="gap-1"
                        >
                          <Link href={`/invoices/new?bookingId=${b.id}`}>
                            Create invoice
                            <ArrowUpRight className="size-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Payout statements ---------------- */}
      <TabsContent value="payouts" className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="Total payouts"
            value={formatINR(payoutTotal)}
            accent="violet"
            icon={<HandCoins className="size-4" />}
            sub={`${statements.length} vendor${statements.length === 1 ? "" : "s"}`}
          />
          <StatTile
            label="Pending"
            value={formatINR(payoutPending)}
            accent="amber"
            icon={<Clock className="size-4" />}
            sub="Approved or pending settlement"
          />
        </div>

        <Card className="overflow-hidden py-0 shadow-card">
          <CardContent className="p-0">
            {statements.length === 0 ? (
              <EmptyState
                icon={<HandCoins className="size-5" />}
                title="No vendor payouts yet"
                description="Vendor payout statements will appear here once payouts are recorded."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statements.map((v) => (
                    <VendorRow key={v.vendorId} v={v} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function VendorRow({ v }: { v: PayoutStatement }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <TableCell>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </TableCell>
        <TableCell>
          <div className="font-medium">{v.vendor}</div>
          <div className="text-[11px] text-muted-foreground numeric">
            {v.count} payout{v.count === 1 ? "" : "s"}
          </div>
        </TableCell>
        <TableCell className="text-right font-medium numeric">
          {formatINR(v.total)}
        </TableCell>
        <TableCell className="text-right numeric text-success">
          {formatINR(v.paid)}
        </TableCell>
        <TableCell className="text-right numeric text-warning">
          {formatINR(v.pending)}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="p-0">
            <div className="px-4 py-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {v.payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">
                        {p.description ?? "—"}
                      </TableCell>
                      <TableCell className="numeric text-muted-foreground">
                        {fmtDate(p.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          label={p.status}
                          hue={PAYOUT_HUE[p.status] ?? "neutral"}
                          size="xs"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium numeric">
                        {formatINR(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
